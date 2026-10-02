import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage directories
const DATA_DIR = path.resolve(__dirname, 'data');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const VIDEOS_DIR = path.resolve(UPLOADS_DIR, 'videos');
const THUMBNAILS_DIR = path.resolve(UPLOADS_DIR, 'thumbnails');
const DB_FILE = path.resolve(DATA_DIR, 'videos.json');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR, VIDEOS_DIR, THUMBNAILS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

interface VideoRecord {
  id: string;
  ownerToken: string;
  originalFileName: string;
  fileSize: number;
  format: string;
  uploadDate: string;
  storageFileName: string;
  hasThumbnail: boolean;
  duration?: number;
}

// Read database
function readDatabase(): VideoRecord[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([]), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading video database:', err);
    return [];
  }
}

// Write database
function writeDatabase(videos: VideoRecord[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(videos, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing video database:', err);
  }
}

// Active upload sessions map in memory
interface UploadSession {
  uploadId: string;
  videoId: string;
  ownerToken: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageFileName: string;
  targetFilePath: string;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: Set<number>;
  createdAt: number;
  hasThumbnail: boolean;
}

const activeSessions = new Map<string, UploadSession>();

// Cleanup stale upload sessions older than 24h
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.createdAt > 24 * 60 * 60 * 1000) {
      if (fs.existsSync(session.targetFilePath)) {
        try {
          fs.unlinkSync(session.targetFilePath);
        } catch (_) {}
      }
      activeSessions.delete(id);
    }
  }
}, 60 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Enable Cross-Origin Resource Sharing (CORS) for GitHub Pages & public requests
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range, x-upload-id, x-chunk-index, x-chunk-offset, x-owner-token');
    res.header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check for free host pinging / uptime monitors (e.g. Render / Koyeb)
  app.get('/health', (req, res) => res.json({ status: 'ok', service: 'nextcut-backend', uptime: process.uptime() }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'nextcut-backend', uptime: process.uptime() }));

  // Parse JSON payloads (thumbnails, init metadata, etc.)
  app.use(express.json({ limit: '15mb' }));

  // Helper to generate secure random video ID (e.g. 14 alphanumeric chars, unpredictable)
  function generateVideoId(): string {
    return crypto.randomBytes(9).toString('base64url').replace(/[-_]/g, 'a').slice(0, 12);
  }

  // 1. Initialize Chunked Upload
  app.post('/api/upload/init', (req, res) => {
    try {
      const { fileName, fileSize, fileType, thumbnailBase64 } = req.body;

      if (!fileName || !fileSize) {
        return res.status(400).json({ error: 'Missing fileName or fileSize' });
      }

      // Check supported formats
      const ext = path.extname(fileName).toLowerCase();
      const validExtensions = ['.mp4', '.mov', '.webm', '.m4v'];
      if (!validExtensions.includes(ext) && !fileType?.includes('video/')) {
        return res.status(400).json({ error: 'This video format is not supported. Please upload MP4, MOV, or WEBM.' });
      }

      // Transparent Free Tier Storage Check (e.g. 20 GB free limit per deployment)
      const MAX_FREE_STORAGE_BYTES = 20 * 1024 * 1024 * 1024; // 20GB
      const currentVideos = readDatabase();
      const totalUsedBytes = currentVideos.reduce((acc, v) => acc + (v.fileSize || 0), 0);

      if (totalUsedBytes + fileSize > MAX_FREE_STORAGE_BYTES) {
        return res.status(400).json({
          error: `Storage limit reached (${(MAX_FREE_STORAGE_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB free limit). Please delete existing videos to free up space. NextCut Studio is 100% free with no paid upgrades.`
        });
      }

      const videoId = generateVideoId();
      const ownerToken = crypto.randomBytes(24).toString('hex');
      const uploadId = crypto.randomBytes(16).toString('hex');

      // Preserve original extension
      const safeExt = ext || '.mp4';
      const storageFileName = `${videoId}${safeExt}`;
      const targetFilePath = path.resolve(VIDEOS_DIR, storageFileName);

      // Default chunk size 2MB for fast responsive parallel uploading
      const chunkSize = 2 * 1024 * 1024;
      const totalChunks = Math.ceil(fileSize / chunkSize);

      // Pre-create/truncate the target file so direct chunk offset writes can stream without delay
      const fd = fs.openSync(targetFilePath, 'w');
      fs.closeSync(fd);

      // Save thumbnail if provided
      let hasThumbnail = false;
      if (thumbnailBase64 && typeof thumbnailBase64 === 'string') {
        try {
          const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
          const thumbBuffer = Buffer.from(base64Data, 'base64');
          const thumbPath = path.resolve(THUMBNAILS_DIR, `${videoId}.jpg`);
          fs.writeFileSync(thumbPath, thumbBuffer);
          hasThumbnail = true;
        } catch (thumbErr) {
          console.warn('Could not save client thumbnail:', thumbErr);
        }
      }

      activeSessions.set(uploadId, {
        uploadId,
        videoId,
        ownerToken,
        fileName,
        fileSize,
        fileType: fileType || 'video/mp4',
        storageFileName,
        targetFilePath,
        chunkSize,
        totalChunks,
        receivedChunks: new Set<number>(),
        createdAt: Date.now(),
        hasThumbnail
      });

      return res.json({
        uploadId,
        videoId,
        ownerToken,
        chunkSize,
        totalChunks
      });
    } catch (err: any) {
      console.error('Error initializing upload:', err);
      return res.status(500).json({ error: 'Failed to initialize upload session' });
    }
  });

  // 2. Upload Chunk (Binary streaming directly to disk offset)
  app.post('/api/upload/chunk', express.raw({ type: 'application/octet-stream', limit: '20mb' }), (req, res) => {
    try {
      const uploadId = req.headers['x-upload-id'] as string;
      const chunkIndex = parseInt(req.headers['x-chunk-index'] as string, 10);
      const chunkOffset = parseInt(req.headers['x-chunk-offset'] as string, 10);
      const ownerToken = req.headers['x-owner-token'] as string;

      if (!uploadId || isNaN(chunkIndex) || isNaN(chunkOffset)) {
        return res.status(400).json({ error: 'Missing upload chunk headers' });
      }

      const session = activeSessions.get(uploadId);
      if (!session) {
        return res.status(404).json({ error: 'Upload session not found or expired' });
      }

      if (session.ownerToken !== ownerToken) {
        return res.status(403).json({ error: 'Unauthorized upload attempt' });
      }

      const chunkBuffer = req.body as Buffer;
      if (!chunkBuffer || chunkBuffer.length === 0) {
        return res.status(400).json({ error: 'Empty chunk data received' });
      }

      // Write chunk directly to file at calculated byte offset
      const fd = fs.openSync(session.targetFilePath, 'r+');
      fs.writeSync(fd, chunkBuffer, 0, chunkBuffer.length, chunkOffset);
      fs.closeSync(fd);

      session.receivedChunks.add(chunkIndex);

      return res.json({
        success: true,
        chunkIndex,
        receivedCount: session.receivedChunks.size,
        totalChunks: session.totalChunks
      });
    } catch (err: any) {
      console.error('Error writing chunk:', err);
      return res.status(500).json({ error: 'Failed to save chunk' });
    }
  });

  // 3. Complete Upload & Register Video
  app.post('/api/upload/complete', (req, res) => {
    try {
      const { uploadId, ownerToken, duration } = req.body;

      if (!uploadId || !ownerToken) {
        return res.status(400).json({ error: 'Missing uploadId or ownerToken' });
      }

      const session = activeSessions.get(uploadId);
      if (!session) {
        return res.status(404).json({ error: 'Upload session not found or expired' });
      }

      if (session.ownerToken !== ownerToken) {
        return res.status(403).json({ error: 'Unauthorized completion request' });
      }

      // Confirm file exists on disk
      if (!fs.existsSync(session.targetFilePath)) {
        return res.status(500).json({ error: 'Uploaded file missing from storage' });
      }

      const stats = fs.statSync(session.targetFilePath);
      if (stats.size === 0) {
        return res.status(400).json({ error: 'Uploaded file is empty' });
      }

      // Save record in database
      const videos = readDatabase();
      const newRecord: VideoRecord = {
        id: session.videoId,
        ownerToken: session.ownerToken,
        originalFileName: session.fileName,
        fileSize: stats.size,
        format: session.fileType,
        uploadDate: new Date().toISOString(),
        storageFileName: session.storageFileName,
        hasThumbnail: session.hasThumbnail,
        duration: duration ? Number(duration) : undefined
      };

      videos.unshift(newRecord);
      writeDatabase(videos);

      // Cleanup active session
      activeSessions.delete(uploadId);

      return res.json({
        success: true,
        videoId: newRecord.id,
        ownerToken: newRecord.ownerToken,
        fileSize: newRecord.fileSize,
        originalFileName: newRecord.originalFileName
      });
    } catch (err: any) {
      console.error('Error completing upload:', err);
      return res.status(500).json({ error: 'Failed to finalize video' });
    }
  });

  // 4. Get Video Public Info (Client watch view or owner view)
  // Strictly returns only public safe data: NO ownerToken, NO storage paths, NO other videos
  app.get('/api/videos/:id', (req, res) => {
    try {
      const { id } = req.params;
      const videos = readDatabase();
      const video = videos.find((v) => v.id === id);

      if (!video) {
        return res.status(404).json({ error: 'This video has been deleted or is no longer available' });
      }

      // Verify file still exists on disk
      const filePath = path.resolve(VIDEOS_DIR, video.storageFileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'This video has been deleted or is no longer available' });
      }

      return res.json({
        id: video.id,
        originalFileName: video.originalFileName,
        fileSize: video.fileSize,
        format: video.format,
        uploadDate: video.uploadDate,
        hasThumbnail: video.hasThumbnail,
        duration: video.duration
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to retrieve video details' });
    }
  });

  // 5. Video Stream (HTTP 206 Partial Content Range streaming)
  // Preserves 100% original video bit-for-bit quality without re-encoding
  app.get('/api/videos/:id/stream', (req, res) => {
    try {
      const { id } = req.params;
      const videos = readDatabase();
      const video = videos.find((v) => v.id === id);

      if (!video) {
        return res.status(404).json({ error: 'Video not found or deleted' });
      }

      const filePath = path.resolve(VIDEOS_DIR, video.storageFileName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Video file not found on disk' });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      // Determine MIME type
      let contentType = video.format || 'video/mp4';
      if (video.storageFileName.endsWith('.mp4')) contentType = 'video/mp4';
      else if (video.storageFileName.endsWith('.mov')) contentType = 'video/quicktime';
      else if (video.storageFileName.endsWith('.webm')) contentType = 'video/webm';

      if (range) {
        // Range header present (e.g. "bytes=0-1048576" or "bytes=1048576-")
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize) {
          res.status(416).set('Content-Range', `bytes */${fileSize}`).send();
          return;
        }

        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Content-Disposition': 'inline',
          'Cache-Control': 'public, max-age=3600',
        });

        fileStream.pipe(res);
      } else {
        // Full file stream
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': 'inline',
          'Cache-Control': 'public, max-age=3600',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err: any) {
      console.error('Error streaming video:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming video' });
      }
    }
  });

  // 6. Thumbnail Endpoint
  app.get('/api/videos/:id/thumbnail', (req, res) => {
    const { id } = req.params;
    const thumbPath = path.resolve(THUMBNAILS_DIR, `${id}.jpg`);
    if (fs.existsSync(thumbPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(thumbPath).pipe(res);
    }
    return res.status(404).send('No thumbnail');
  });

  // 7. Owner's Videos Endpoint
  // Takes an array of ownerTokens from the owner's browser localStorage and returns only videos they own
  app.post('/api/owner/videos', (req, res) => {
    try {
      const { ownerTokens } = req.body;
      if (!Array.isArray(ownerTokens) || ownerTokens.length === 0) {
        return res.json({ videos: [], totalStorageUsed: 0 });
      }

      const tokenSet = new Set(ownerTokens);
      const allVideos = readDatabase();
      const ownerVideos = allVideos
        .filter((v) => tokenSet.has(v.ownerToken))
        .map((v) => ({
          id: v.id,
          originalFileName: v.originalFileName,
          fileSize: v.fileSize,
          format: v.format,
          uploadDate: v.uploadDate,
          hasThumbnail: v.hasThumbnail,
          duration: v.duration
        }));

      const totalStorageUsed = ownerVideos.reduce((sum, v) => sum + (v.fileSize || 0), 0);

      return res.json({
        videos: ownerVideos,
        totalStorageUsed,
        freeQuotaBytes: 20 * 1024 * 1024 * 1024 // 20 GB free tier
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch owner videos' });
    }
  });

  // 8. Delete Video Endpoint (Strictly protected by ownerToken)
  app.delete('/api/videos/:id', (req, res) => {
    try {
      const { id } = req.params;
      const ownerToken = req.headers['x-owner-token'] as string;

      if (!ownerToken) {
        return res.status(401).json({ error: 'Owner authorization token required' });
      }

      const videos = readDatabase();
      const videoIndex = videos.findIndex((v) => v.id === id);

      if (videoIndex === -1) {
        return res.status(404).json({ error: 'Video not found or already deleted' });
      }

      const video = videos[videoIndex];
      if (video.ownerToken !== ownerToken) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this video' });
      }

      // 1. Delete video file from disk
      const filePath = path.resolve(VIDEOS_DIR, video.storageFileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn('Could not unlink video file:', unlinkErr);
        }
      }

      // 2. Delete thumbnail if exists
      const thumbPath = path.resolve(THUMBNAILS_DIR, `${id}.jpg`);
      if (fs.existsSync(thumbPath)) {
        try {
          fs.unlinkSync(thumbPath);
        } catch (_) {}
      }

      // 3. Remove metadata from database
      videos.splice(videoIndex, 1);
      writeDatabase(videos);

      return res.json({
        success: true,
        message: 'Video permanently deleted from storage and metadata invalidated'
      });
    } catch (err: any) {
      console.error('Error deleting video:', err);
      return res.status(500).json({ error: 'Failed to delete video' });
    }
  });

  // 9. Storage Info Endpoint (100% Free tier transparent metrics)
  app.get('/api/system/storage-info', (req, res) => {
    const allVideos = readDatabase();
    const totalUsedBytes = allVideos.reduce((sum, v) => sum + (v.fileSize || 0), 0);
    const freeTierLimitBytes = 20 * 1024 * 1024 * 1024; // 20GB free allocation

    return res.json({
      freeTierLimitBytes,
      totalUsedBytes,
      totalVideos: allVideos.length,
      is100PercentFree: true,
      provider: 'NextCut Open Storage'
    });
  });

  // Redirect root to base path
  app.get('/', (req, res) => {
    res.redirect('/Nex-cut-studio-/');
  });

  // Setup Vite in Dev or Static files in Production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use('/Nex-cut-studio-', express.static(path.resolve(__dirname, 'dist')));
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NextCut Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NextCut Studio server:', err);
});
