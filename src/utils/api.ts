import { VideoMetadata, OwnerVideoSummary } from '../types';
import { getApiBaseUrl } from './apiConfig';

function resolveBaseUrl(overrideApiUrl?: string): string {
  if (overrideApiUrl && overrideApiUrl.trim()) {
    return overrideApiUrl.trim().replace(/\/$/, '');
  }
  return getApiBaseUrl();
}

/**
 * Fetches video metadata from persistent remote backend.
 * Never relies on local browser storage for client video resolution.
 */
export async function fetchVideoMetadata(id: string, overrideApiUrl?: string): Promise<VideoMetadata> {
  const apiBase = resolveBaseUrl(overrideApiUrl);

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
      throw new Error(`Server returned HTTP ${res.status}`);
    } catch (err: any) {
      if (err.message?.includes('deleted or is no longer available')) {
        throw err;
      }
      throw new Error(err.message || 'Unable to connect to persistent video storage.');
    }
  }

  throw new Error(
    'Unable to connect to remote video storage. Please ensure the viewing link includes the storage endpoint or that the persistent backend is connected.'
  );
}

/**
 * Retrieves the owner's uploaded videos list from persistent backend.
 */
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

  return {
    videos: [],
    totalStorageUsed: 0,
    freeQuotaBytes: 20 * 1024 * 1024 * 1024
  };
}

/**
 * Deletes a video permanently from remote storage and purges database metadata.
 */
export async function deleteVideoById(id: string, ownerToken: string, overrideApiUrl?: string): Promise<void> {
  const apiBase = resolveBaseUrl(overrideApiUrl);

  if (apiBase || !window.location.hostname.endsWith('github.io')) {
    const res = await fetch(`${apiBase}/api/videos/${id}`, {
      method: 'DELETE',
      headers: { 'x-owner-token': ownerToken }
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete video from remote storage (HTTP ${res.status})`);
    }
  }
}

/**
 * Returns the remote streaming URL for video playback via HTTP 206 Partial Content.
 */
export async function resolveVideoPlaybackSource(videoId: string, overrideApiUrl?: string): Promise<string> {
  const apiBase = resolveBaseUrl(overrideApiUrl);
  return `${apiBase}/api/videos/${videoId}/stream`;
}
