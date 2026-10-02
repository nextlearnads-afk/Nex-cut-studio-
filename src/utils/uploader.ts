import { UploadProgressState } from '../types';
import { saveOwnerToken } from './ownerAuth';
import { extractVideoThumbnail } from './thumbnail';
import { saveClientVideo } from './clientStorage';
import { getApiBaseUrl, getCloudinaryConfig } from './apiConfig';

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
}: UploadOptions): Promise<{ videoId: string; ownerToken: string; cloudStreamUrl?: string }> {
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

  const apiBase = getApiBaseUrl();
  const cloudinaryConfig = getCloudinaryConfig();

  // A. DIRECT CLOUDINARY CLOUD STORAGE (100% Free, 25GB Storage, No credit card)
  if (cloudinaryConfig?.cloudName && cloudinaryConfig?.uploadPreset) {
    return new Promise((resolve, reject) => {
      const videoId = generateRandomId();
      const ownerToken = 'owner_' + generateRandomId() + Date.now().toString(36);
      const startTime = Date.now();
      let lastSpeedCheckTime = startTime;
      let bytesSinceLastCheck = 0;
      let currentSpeed = 0;

      const xhr = new XMLHttpRequest();
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`;

      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Upload cancelled'));
        });
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const now = Date.now();
          const timeDelta = (now - lastSpeedCheckTime) / 1000;
          bytesSinceLastCheck += event.loaded - (xhr as any)._lastLoaded || 0;
          (xhr as any)._lastLoaded = event.loaded;

          if (timeDelta >= 0.4 || event.loaded === event.total) {
            const instantSpeed = bytesSinceLastCheck / Math.max(timeDelta, 0.05);
            currentSpeed = currentSpeed === 0 ? instantSpeed : currentSpeed * 0.7 + instantSpeed * 0.3;
            lastSpeedCheckTime = now;
            bytesSinceLastCheck = 0;
          }

          const percent = Math.min(Math.round((event.loaded / event.total) * 100), 99);
          const remainingBytes = event.total - event.loaded;
          const estimatedSecondsRemaining = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;

          onProgress({
            status: 'uploading',
            percent,
            uploadedBytes: event.loaded,
            totalBytes: event.total,
            speedBytesPerSec: currentSpeed,
            estimatedSecondsRemaining,
            videoId,
            fileName: file.name,
            fileSize: file.size
          });
        }
      };

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            const cloudStreamUrl = response.secure_url || response.url;

            saveOwnerToken(videoId, ownerToken);

            // Also keep metadata in local storage for the owner
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
              cloudStreamUrl
            });

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
              fileSize: file.size,
              cloudStreamUrl
            });

            resolve({ videoId, ownerToken, cloudStreamUrl });
          } catch (e: any) {
            reject(new Error('Failed to parse cloud response: ' + e.message));
          }
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            reject(new Error(errJson.error?.message || `Cloud upload failed (${xhr.status})`));
          } catch (_) {
            reject(new Error(`Cloud upload failed (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during cloud video upload'));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      formData.append('public_id', videoId);

      xhr.open('POST', uploadUrl, true);
      xhr.send(formData);
    });
  }

  // B. PERSISTENT NODE BACKEND PIPELINE (Render.com / Custom backend / Local)
  let isServerAvailable = false;
  let serverInitData: any = null;

  try {
    const initEndpoint = `${apiBase}/api/upload/init`;
    const initResponse = await fetch(initEndpoint, {
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
          const chunkEndpoint = `${apiBase}/api/upload/chunk`;
          const chunkResponse = await fetch(chunkEndpoint, {
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

    const completeEndpoint = `${apiBase}/api/upload/complete`;
    const completeResponse = await fetch(completeEndpoint, {
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

  // C. PERSISTENT STORAGE REQUIRED: No local storage fake fallback.
  // The system strictly requires a persistent server or cloud storage so videos
  // are accessible to client devices worldwide.
  const errorMessage =
    'Persistent storage required for client sharing. GitHub Pages only hosts the website interface. ' +
    'To upload videos that play across different phones and client devices, connect your free Render backend or Cloudinary storage. ' +
    'Click "Storage Setup" in the top bar to connect (100% free, 0 credit card required).';

  onProgress({
    status: 'error',
    percent: 0,
    uploadedBytes: 0,
    totalBytes: file.size,
    speedBytesPerSec: 0,
    estimatedSecondsRemaining: 0,
    errorMessage,
    fileName: file.name,
    fileSize: file.size
  });

  throw new Error(errorMessage);
}
