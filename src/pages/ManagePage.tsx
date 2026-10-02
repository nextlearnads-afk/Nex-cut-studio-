import React, { useState, useEffect } from 'react';
import {
  Video,
  Copy,
  ExternalLink,
  Trash2,
  UploadCloud,
  Check,
  AlertCircle,
  HardDrive,
  Clock,
  Play
} from 'lucide-react';
import { OwnerVideoSummary } from '../types';
import { getAllOwnerTokens, getOwnerToken, removeOwnerToken } from '../utils/ownerAuth';
import { formatBytes, formatDate } from '../utils/format';
import { DeleteModal } from '../components/DeleteModal';

interface ManagePageProps {
  onNavigate: (path: string) => void;
}

export const ManagePage: React.FC<ManagePageProps> = ({ onNavigate }) => {
  const [videos, setVideos] = useState<OwnerVideoSummary[]>([]);
  const [totalStorageUsed, setTotalStorageUsed] = useState<number>(0);
  const [freeQuotaBytes, setFreeQuotaBytes] = useState<number>(20 * 1024 * 1024 * 1024);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Copy toast state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete modal state
  const [videoToDelete, setVideoToDelete] = useState<OwnerVideoSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const tokens = getAllOwnerTokens();

      if (tokens.length === 0) {
        setVideos([]);
        setTotalStorageUsed(0);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/owner/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerTokens: tokens })
      });

      if (!res.ok) {
        throw new Error('Failed to load your videos');
      }

      const data = await res.json();
      setVideos(data.videos || []);
      setTotalStorageUsed(data.totalStorageUsed || 0);
      if (data.freeQuotaBytes) {
        setFreeQuotaBytes(data.freeQuotaBytes);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleCopyLink = (videoId: string) => {
    const fullUrl = `${window.location.origin}/watch/${videoId}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(videoId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  const confirmDelete = async () => {
    if (!videoToDelete) return;

    try {
      setIsDeleting(true);
      const token = getOwnerToken(videoToDelete.id);

      const res = await fetch(`/api/videos/${videoToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'x-owner-token': token || ''
        }
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete video');
      }

      // Remove from browser owner storage
      removeOwnerToken(videoToDelete.id);

      // Refresh list
      setVideos((prev) => prev.filter((v) => v.id !== videoToDelete.id));
      setTotalStorageUsed((prev) => Math.max(0, prev - videoToDelete.fileSize));
      setVideoToDelete(null);
    } catch (err: any) {
      alert(`Deletion error: ${err.message || 'Could not delete video'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const percentUsed = Math.min(100, Math.round((totalStorageUsed / freeQuotaBytes) * 100));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Top Header & Storage Summary */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            My Videos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Manage your uploaded client project cuts and private share links.
          </p>
        </div>

        {/* 100% Free Storage Quota Banner */}
        <div className="rounded-xl border border-zinc-800 bg-[#12141c] p-3.5 sm:min-w-[280px]">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <span className="flex items-center gap-1.5 font-medium text-zinc-300">
              <HardDrive className="h-3.5 w-3.5 text-amber-400" />
              <span>Free Storage</span>
            </span>
            <span className="font-mono-numbers text-zinc-300 font-medium">
              {formatBytes(totalStorageUsed)} / {formatBytes(freeQuotaBytes)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-300"
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
            <span>100% Free Open Tier</span>
            <span>0 Cards · 0 Upgrades</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
          <p className="mt-3 text-xs text-zinc-400">Loading your videos...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && videos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#10121a]/50 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/60 text-zinc-400">
            <Video className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No videos uploaded yet</h3>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto mb-6">
            Upload your first video to generate private client viewing links in original master quality.
          </p>
          <button
            onClick={() => onNavigate('/upload')}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 px-5 py-2.5 text-xs sm:text-sm font-semibold text-black transition-all shadow-md active:scale-95"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Upload Your First Video</span>
          </button>
        </div>
      )}

      {/* Video Cards Grid */}
      {!loading && videos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((video) => {
            const isCopied = copiedId === video.id;

            return (
              <div
                key={video.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-zinc-800 bg-[#12141c] hover:border-zinc-700 transition-all hover:shadow-lg shadow-black/40"
              >
                <div>
                  {/* Thumbnail / Preview Area */}
                  <div
                    onClick={() => onNavigate(`/video/${video.id}`)}
                    className="relative aspect-video w-full bg-black cursor-pointer overflow-hidden border-b border-zinc-800/80"
                  >
                    {video.hasThumbnail ? (
                      <img
                        src={`/api/videos/${video.id}/thumbnail`}
                        alt={video.originalFileName}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-600">
                        <Video className="h-10 w-10" />
                      </div>
                    )}

                    {/* Play Hover Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg">
                        <Play className="h-5 w-5 fill-black translate-x-0.5" />
                      </div>
                    </div>

                    {/* Status Text (No pill box) */}
                    <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded text-[11px] font-mono-numbers text-emerald-400">
                      Ready to share
                    </div>
                  </div>

                  {/* Info Details */}
                  <div className="p-4">
                    <h3
                      onClick={() => onNavigate(`/video/${video.id}`)}
                      className="font-semibold text-sm text-white truncate cursor-pointer hover:text-amber-400 transition-colors"
                      title={video.originalFileName}
                    >
                      {video.originalFileName}
                    </h3>

                    {/* Unboxed Metadata with Typographic Dot Separator */}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-400">
                      <span className="font-mono-numbers">{formatBytes(video.fileSize)}</span>
                      <span aria-hidden="true" className="text-zinc-600">·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        <span>Uploaded: {formatDate(video.uploadDate)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Row: Copy Link, Open, Delete */}
                <div className="border-t border-zinc-800/80 bg-zinc-900/40 p-3 flex items-center justify-between gap-1">
                  <button
                    onClick={() => handleCopyLink(video.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-2.5 py-1.5 text-xs font-medium transition-colors"
                    title="Copy client viewing link"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-amber-400" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onNavigate(`/video/${video.id}`)}
                    className="flex items-center justify-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white px-2.5 py-1.5 text-xs font-medium transition-colors"
                    title="Open editor preview"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open</span>
                  </button>

                  <button
                    onClick={() => setVideoToDelete(video)}
                    className="flex items-center justify-center rounded-lg p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Permanently delete video"
                    aria-label="Delete video"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={Boolean(videoToDelete)}
        videoTitle={videoToDelete?.originalFileName || ''}
        isDeleting={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setVideoToDelete(null)}
      />
    </div>
  );
};
