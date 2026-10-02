import { VideoMetadata, OwnerVideoSummary } from '../types';
import { getApiBaseUrl } from './apiConfig';
import {
  getClientVideo,
  getClientOwnerVideos,
  deleteClientVideo,
  saveClientVideo
} from './clientStorage';

function resolveBaseUrl(overrideApiUrl?: string): string {
  if (overrideApiUrl && overrideApiUrl.trim()) {
    return overrideApiUrl.trim().replace(/\/$/, '');
  }
  return getApiBaseUrl();
}

export async function fetchVideoMetadata(id: string, overrideApiUrl?: string): Promise<VideoMetadata> {
  const apiBase = resolveBaseUrl(overrideApiUrl);

  // 1. Try remote persistent backend first
  if (apiBase || !window.location.hostname.endsWith('github.io')) {
    try {
      const endpoint = `${apiBase}/api/videos/${id}`;
      const res = await fetch(endpoint);
      if (res.status === 404) {
        throw new Error('This video has been deleted or is no longer available.');
      }
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch (err: any) {
      if (err.message?.includes('deleted or is no longer available')) {
        throw err;
      }
      // Network error or offline
    }
  }

  // 2. Check local client storage (only as preview fallback on same device)
  const clientRecord = await getClientVideo(id);
  if (clientRecord) {
    const { blob, thumbnailDataUrl, ownerToken, ...meta } = clientRecord;
    return meta;
  }

  throw new Error('This video has been deleted or is no longer available.');
}

export async function fetchOwnerVideosList(
  ownerTokens: string[]
): Promise<{ videos: OwnerVideoSummary[]; totalStorageUsed: number; freeQuotaBytes: number }> {
  const apiBase = resolveBaseUrl();

  if (apiBase || !window.location.hostname.endsWith('github.io')) {
    try {
      const res = await fetch(`${apiBase}/api/owner/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerTokens })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return {
          videos: data.videos || [],
          totalStorageUsed: data.totalStorageUsed || 0,
          freeQuotaBytes: data.freeQuotaBytes || 20 * 1024 * 1024 * 1024
        };
      }
    } catch (_) {}
  }

  // Fallback to client storage
  const clientVideos = await getClientOwnerVideos(ownerTokens);
  const totalStorageUsed = clientVideos.reduce((sum, v) => sum + (v.fileSize || 0), 0);

  return {
    videos: clientVideos,
    totalStorageUsed,
    freeQuotaBytes: 20 * 1024 * 1024 * 1024
  };
}

export async function deleteVideoById(id: string, ownerToken: string, overrideApiUrl?: string): Promise<void> {
  const apiBase = resolveBaseUrl(overrideApiUrl);
  let serverSuccess = false;

  if (apiBase || !window.location.hostname.endsWith('github.io')) {
    try {
      const res = await fetch(`${apiBase}/api/videos/${id}`, {
        method: 'DELETE',
        headers: { 'x-owner-token': ownerToken }
      });
      if (res.ok) {
        serverSuccess = true;
      }
    } catch (_) {}
  }

  // Also remove from local device storage if present
  try {
    await deleteClientVideo(id, ownerToken);
  } catch (err: any) {
    if (!serverSuccess) throw err;
  }
}

// Get video playback source (either remote server stream, direct cloud URL, or local blob)
export async function resolveVideoPlaybackSource(videoId: string, overrideApiUrl?: string): Promise<string> {
  const apiBase = resolveBaseUrl(overrideApiUrl);

  // If remote backend is available, stream from backend
  if (apiBase || !window.location.hostname.endsWith('github.io')) {
    return `${apiBase}/api/videos/${videoId}/stream`;
  }

  // Fallback to local device storage if on same device
  const clientRecord = await getClientVideo(videoId);
  if (clientRecord?.blob) {
    return URL.createObjectURL(clientRecord.blob);
  }

  return `${apiBase}/api/videos/${videoId}/stream`;
}
