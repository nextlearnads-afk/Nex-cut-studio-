import { UploadProgressState } from '../types';
import { saveOwnerToken } from './ownerAuth';
import { extractVideoThumbnail } from './thumbnail';

export interface UploadOptions {
  file: File;
  onProgress: (state: UploadProgressState) => void;
  signal?: AbortSignal;
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

  // Extract client thumbnail in parallel while initiating upload
  const thumbnailPromise = extractVideoThumbnail(file);

  // 2. Initialize Upload on Server
  const { thumbnailBase64, duration } = await thumbnailPromise;

  if (signal?.aborted) {
    throw new Error('Upload cancelled');
  }

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

  if (!initResponse.ok) {
    const errData = await initResponse.json().catch(() => ({}));
    throw new Error(errData.error || `Upload initialization failed (${initResponse.status})`);
  }

  const initData = await initResponse.json();
  const { uploadId, videoId, ownerToken, chunkSize, totalChunks } = initData;

  // 3. Chunk Streaming Loop with Speed and ETA Tracking
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
    if (signal?.aborted) {
      throw new Error('Upload cancelled');
    }

    const startByte = chunkIndex * chunkSize;
    const endByte = Math.min(startByte + chunkSize, file.size);
    const chunkBlob = file.slice(startByte, endByte);
    const currentChunkSize = endByte - startByte;

    // Retry loop for temporary network glitches
    let chunkUploaded = false;
    let attempts = 0;
    const maxAttempts = 4;

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
          const errBody = await chunkResponse.json().catch(() => ({}));
          throw new Error(errBody.error || `Chunk ${chunkIndex} failed with HTTP ${chunkResponse.status}`);
        }

        chunkUploaded = true;
      } catch (err: any) {
        if (signal?.aborted) throw new Error('Upload cancelled');
        if (attempts >= maxAttempts) {
          throw new Error(`Upload failed at chunk ${chunkIndex + 1}/${totalChunks}: ${err.message || 'Network error'}`);
        }
        // Wait briefly before retrying
        await new Promise((res) => setTimeout(res, 800 * attempts));
      }
    }

    uploadedBytes += currentChunkSize;
    bytesSinceLastCheck += currentChunkSize;

    const now = Date.now();
    const timeDelta = (now - lastSpeedCheckTime) / 1000;

    if (timeDelta >= 0.4 || chunkIndex === totalChunks - 1) {
      const instantSpeed = bytesSinceLastCheck / Math.max(timeDelta, 0.05);
      // Exponential moving average for smooth display
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

  // 4. Finalize Video Record
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
    body: JSON.stringify({
      uploadId,
      ownerToken,
      duration
    }),
    signal
  });

  if (!completeResponse.ok) {
    const errBody = await completeResponse.json().catch(() => ({}));
    throw new Error(errBody.error || 'Failed to complete video registration');
  }

  // Automatically save ownership in uploader's browser
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
