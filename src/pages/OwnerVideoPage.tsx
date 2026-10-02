import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Clock,
  HardDrive,
  AlertCircle
} from 'lucide-react';
import { VideoMetadata } from '../types';
import { formatBytes, formatDate } from '../utils/format';
import { getOwnerToken, removeOwnerToken } from '../utils/ownerAuth';
import { VideoPlayer } from '../components/VideoPlayer';
import { DeleteModal } from '../components/DeleteModal';
import { fetchVideoMetadata, deleteVideoById } from '../utils/api';
import { getClientShareLink } from '../utils/url';

interface OwnerVideoPageProps {
  videoId: string;
  onNavigate: (path: string) => void;
}

export const OwnerVideoPage: React.FC<OwnerVideoPageProps> = ({ videoId, onNavigate }) => {
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const clientShareUrl = getClientShareLink(videoId, {
    cloudStreamUrl: video?.cloudStreamUrl,
    fileName: video?.originalFileName,
    fileSize: video?.fileSize,
    duration: video?.duration
  });

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchVideoMetadata(videoId);
        setVideo(data);
      } catch (err: any) {
        setError(err.message || 'Video not found');
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(clientShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const token = getOwnerToken(videoId) || '';

      await deleteVideoById(videoId, token);

      removeOwnerToken(videoId);
      setShowDeleteModal(false);
      onNavigate('/manage');
    } catch (err: any) {
      alert(`Deletion error: ${err.message || 'Could not delete'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
        <p className="mt-3 text-xs text-zinc-400">Loading video preview...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-400">
          <AlertCircle className="h-7 w-7 text-amber-400" />
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-2">Video Not Available</h2>
        <p className="text-sm text-zinc-400 mb-6">
          {error || 'This video has been deleted or is no longer available.'}
        </p>
        <button
          onClick={() => onNavigate('/manage')}
          className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 text-xs sm:text-sm font-medium text-white transition-colors"
        >
          ← Back to My Videos
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Top Bar: Back link & Delete button */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => onNavigate('/manage')}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to My Videos</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(`/watch/${videoId}`)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700/80 bg-zinc-800/60 hover:bg-zinc-700 px-3.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors"
            title="Preview watch page as client"
          >
            <ExternalLink className="h-3.5 w-3.5 text-amber-400" />
            <span>Client View</span>
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-3.5 py-1.5 text-xs font-medium text-red-300 transition-colors"
            title="Delete this video"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Video</span>
          </button>
        </div>
      </div>

      {/* Video Title & Quick Metadata */}
      <div className="mb-4">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
          {video.originalFileName}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="font-mono-numbers">{formatBytes(video.fileSize)}</span>
          <span aria-hidden="true" className="text-zinc-600">·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-zinc-500" />
            <span>Uploaded: {formatDate(video.uploadDate)}</span>
          </span>
          <span aria-hidden="true" className="text-zinc-600">·</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="h-3 w-3" />
            <span>Master Render (100% Original Quality)</span>
          </span>
        </div>
      </div>

      {/* Video Player Container */}
      <div className="mb-8">
        <VideoPlayer videoId={videoId} />
      </div>

      {/* Client Viewing Link Share Box */}
      <div className="rounded-2xl border border-zinc-800 bg-[#10121a] p-5 sm:p-6 mb-8">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Client Viewing Link
          </label>
          <span className="text-[11px] text-zinc-400">Watch-only access · No login required</span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 overflow-hidden rounded-lg border border-zinc-700 bg-black/60 px-3.5 py-2.5 font-mono text-xs sm:text-sm text-zinc-200 truncate select-all">
            {clientShareUrl}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all active:scale-95 shadow-md"
          >
            {copiedLink ? (
              <>
                <Check className="h-4 w-4" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-500 leading-normal">
          This link gives your client an exclusive, watch-only viewing experience. They cannot download, delete, upload, or browse your other videos.
        </p>
      </div>

      {/* Technical Specifications */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5 text-amber-400" />
          <span>Storage & Technical Specs</span>
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-zinc-500">Video ID</div>
            <div className="font-mono text-zinc-200 mt-0.5">{video.id}</div>
          </div>
          <div>
            <div className="text-zinc-500">Format</div>
            <div className="font-mono text-zinc-200 mt-0.5 uppercase">{video.originalFileName.split('.').pop() || 'MP4'}</div>
          </div>
          <div>
            <div className="text-zinc-500">Exact File Size</div>
            <div className="font-mono-numbers text-zinc-200 mt-0.5">{video.fileSize.toLocaleString()} bytes</div>
          </div>
          <div>
            <div className="text-zinc-500">Streaming Protocol</div>
            <div className="text-zinc-200 mt-0.5">HTTP 206 Partial Content</div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        videoTitle={video.originalFileName}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};
