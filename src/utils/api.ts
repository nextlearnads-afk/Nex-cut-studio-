import { VideoMetadata, OwnerVideoSummary } from '../types';
import {
  getClientVideo,
  getClientOwnerVideos,
  deleteClientVideo,
  saveClientVideo
} from './clientStorage';

// Base API prefix
const API_PREFIX = '/api';

export async function fetchVideoMetadata(id: string): Promise<VideoMetadata> {
  try {
    const res = await fetch(`${API_PREFIX}/videos/${id}`);
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await res.json();
    }
  } catch (_) {
    // Server fetch failed, try client storage fallback
  }

  // Fallback to client storage (IndexedDB)
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
  try {
    const res = await fetch(`${API_PREFIX}/owner/videos`, {
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
  } catch (_) {
    // Server fetch failed
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

export async function deleteVideoById(id: string, ownerToken: string): Promise<void> {
  let serverSuccess = false;
  try {
    const res = await fetch(`${API_PREFIX}/videos/${id}`, {
      method: 'DELETE',
      headers: { 'x-owner-token': ownerToken }
    });
    if (res.ok) {
      serverSuccess = true;
    }
  } catch (_) {}

  // Also remove from client storage
  try {
    await deleteClientVideo(id, ownerToken);
  } catch (err: any) {
    if (!serverSuccess) throw err;
  }
}

// Get video playback source (either server stream or client object URL)
export async function resolveVideoPlaybackSource(videoId: string): Promise<string> {
  // Check if we have a local blob in client storage first (e.g. for GitHub Pages)
  const clientRecord = await getClientVideo(videoId);
  if (clientRecord?.blob) {
    return URL.createObjectURL(clientRecord.blob);
  }
  // Otherwise standard server stream route
  return `${API_PREFIX}/videos/${videoId}/stream`;
}
