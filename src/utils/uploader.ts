import { UploadProgressState } from '../types';
import { saveOwnerToken } from './ownerAuth';
import { extractVideoThumbnail } from './thumbnail';
import { saveClientVideo } from './clientStorage';

export interface UploadOptions {
  file: File;
  onProgress: (state: UploadProgressState) => void;
  signal?: AbortSignal;
}

function generateRandomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let res = '';
  for (let i = 0; i < 12; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export async function uploadVideoWithChunks({
  file,
  onProgress,
  signal
}: UploadOptions): Promise<{ videoId: string; ownerToken: string }> {
  // 1. Initial State
  onProgress({
    status: 'preparing',
    percent: 0,
    uploadedBytes: 0,
    totalBytes: file.size,
    speedBytesPerSec: 0,
    estimatedSecondsRemaining: 0,
    fileName: file.name,
    fileSize: file.size
  });

  // Extract client thumbnail in parallel
  const thumbnailPromise = extractVideoThumbnail(file);
  const { thumbnailBase64, duration } = await thumbnailPromise;

  if (signal?.aborted) {
    throw new Error('Upload cancelled');
  }

  // 2. Try server upload first
  let isServerAvailable = false;
  let serverInitData: any = null;

  try {
    const initResponse = await fetch('/api/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'video/mp4',
        thumbnailBase64
      }),
      signal
    });

    const contentType = initResponse.headers.get('content-type') || '';
    if (initResponse.ok && contentType.includes('application/json')) {
      serverInitData = await initResponse.json();
      isServerAvailable = true;
    }
  } catch (_) {
    isServerAvailable = false;
  }

  // A. SERVER PIPELINE (Full-stack mode)
  if (isServerAvailable && serverInitData) {
    const { uploadId, videoId, ownerToken, chunkSize, totalChunks } = serverInitData;

    let uploadedBytes = 0;
    const startTime = Date.now();
    let lastSpeedCheckTime = startTime;
    let bytesSinceLastCheck = 0;
    let currentSpeed = 0;

    onProgress({
      status: 'uploading',
      percent: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
      speedBytesPerSec: 0,
      estimatedSecondsRemaining: 0,
      videoId,
      fileName: file.name,
      fileSize: file.size
    });

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (signal?.aborted) throw new Error('Upload cancelled');

      const startByte = chunkIndex * chunkSize;
      const endByte = Math.min(startByte + chunkSize, file.size);
      const chunkBlob = file.slice(startByte, endByte);
      const currentChunkSize = endByte - startByte;

      let chunkUploaded = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!chunkUploaded && attempts < maxAttempts) {
        attempts++;
        try {
          const chunkResponse = await fetch('/api/upload/chunk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'x-upload-id': uploadId,
              'x-chunk-index': chunkIndex.toString(),
              'x-chunk-offset': startByte.toString(),
              'x-owner-token': ownerToken
            },
            body: chunkBlob,
            signal
          });

          if (!chunkResponse.ok) {
            throw new Error(`Chunk error HTTP ${chunkResponse.status}`);
          }
          chunkUploaded = true;
        } catch (err: any) {
          if (signal?.aborted) throw new Error('Upload cancelled');
          if (attempts >= maxAttempts) throw err;
          await new Promise((res) => setTimeout(res, 600 * attempts));
        }
      }

      uploadedBytes += currentChunkSize;
      bytesSinceLastCheck += currentChunkSize;

      const now = Date.now();
      const timeDelta = (now - lastSpeedCheckTime) / 1000;
      if (timeDelta >= 0.4 || chunkIndex === totalChunks - 1) {
        const instantSpeed = bytesSinceLastCheck / Math.max(timeDelta, 0.05);
        currentSpeed = currentSpeed === 0 ? instantSpeed : currentSpeed * 0.7 + instantSpeed * 0.3;
        lastSpeedCheckTime = now;
        bytesSinceLastCheck = 0;
      }

      const percent = Math.min(Math.round((uploadedBytes / file.size) * 100), 99);
      const remainingBytes = file.size - uploadedBytes;
      const estimatedSecondsRemaining = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;

      onProgress({
        status: 'uploading',
        percent,
        uploadedBytes,
        totalBytes: file.size,
        speedBytesPerSec: currentSpeed,
        estimatedSecondsRemaining,
        videoId,
        fileName: file.name,
        fileSize: file.size
      });
    }

    onProgress({
      status: 'finishing',
      percent: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      speedBytesPerSec: currentSpeed,
      estimatedSecondsRemaining: 0,
      videoId,
      fileName: file.name,
      fileSize: file.size
    });

    const completeResponse = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, ownerToken, duration }),
      signal
    });

    if (!completeResponse.ok) {
      throw new Error('Failed to complete video upload on server');
    }

    saveOwnerToken(videoId, ownerToken);

    onProgress({
      status: 'completed',
      percent: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      speedBytesPerSec: currentSpeed,
      estimatedSecondsRemaining: 0,
      videoId,
      ownerToken,
      fileName: file.name,
      fileSize: file.size
    });

    return { videoId, ownerToken };
  }

  // B. STATIC CLIENT PIPELINE (GitHub Pages Standalone Mode)
  // When running on GitHub Pages where no server backend exists, stores directly in browser IndexedDB
  const videoId = generateRandomId();
  const ownerToken = 'owner_' + generateRandomId() + Date.now().toString(36);

  const chunkSize = 2 * 1024 * 1024;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
  let uploadedBytes = 0;
  const startTime = Date.now();

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    if (signal?.aborted) throw new Error('Upload cancelled');

    const startByte = chunkIndex * chunkSize;
    const endByte = Math.min(startByte + chunkSize, file.size);
    uploadedBytes += endByte - startByte;

    // Small delay to simulate genuine fast chunk writing and display smooth speed/ETA
    await new Promise((res) => setTimeout(res, 60));

    const elapsed = (Date.now() - startTime) / 1000;
    const speed = uploadedBytes / Math.max(elapsed, 0.1);
    const percent = Math.min(Math.round((uploadedBytes / file.size) * 100), 99);
    const remainingSecs = speed > 0 ? (file.size - uploadedBytes) / speed : 0;

    onProgress({
      status: 'uploading',
      percent,
      uploadedBytes,
      totalBytes: file.size,
      speedBytesPerSec: speed,
      estimatedSecondsRemaining: remainingSecs,
      videoId,
      fileName: file.name,
      fileSize: file.size
    });
  }

  // Store original video blob in IndexedDB
  await saveClientVideo({
    id: videoId,
    ownerToken,
    originalFileName: file.name,
    fileSize: file.size,
    format: file.type || 'video/mp4',
    uploadDate: new Date().toISOString(),
    hasThumbnail: Boolean(thumbnailBase64),
    thumbnailDataUrl: thumbnailBase64 || undefined,
    duration,
    blob: file
  });

  saveOwnerToken(videoId, ownerToken);

  onProgress({
    status: 'completed',
    percent: 100,
    uploadedBytes: file.size,
    totalBytes: file.size,
    speedBytesPerSec: file.size / Math.max((Date.now() - startTime) / 1000, 0.1),
    estimatedSecondsRemaining: 0,
    videoId,
    ownerToken,
    fileName: file.name,
    fileSize: file.size
  });

  return { videoId, ownerToken };
}
