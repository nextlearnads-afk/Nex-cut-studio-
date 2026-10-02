import React, { useState, useEffect } from 'react';
import { Film, AlertCircle, Clock } from 'lucide-react';
import { VideoMetadata } from '../types';
import { formatDate } from '../utils/format';
import { VideoPlayer } from '../components/VideoPlayer';

interface ClientWatchPageProps {
  videoId: string;
}

export const ClientWatchPage: React.FC<ClientWatchPageProps> = ({ videoId }) => {
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/videos/${videoId}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('This video has been deleted or is no longer available.');
          }
          throw new Error('Video not found.');
        }

        const data = await res.json();
        setVideo(data);
      } catch (err: any) {
        setError(err.message || 'This video has been deleted or is no longer available.');
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [videoId]);

  // Loading State
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07080b] p-4 text-center">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-black">
          <Film className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
        <p className="mt-3 text-xs text-zinc-400">Loading private viewing session...</p>
      </div>
    );
  }

  // Error State: Video Deleted or Not Found (Requirement #11 & #16)
  if (error || !video) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07080b] px-4 py-16 text-center select-none">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-amber-400 shadow-xl">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
          Video Not Available
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-md mx-auto leading-relaxed mb-8">
          This video has been deleted or is no longer available.
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono">
          <Film className="h-3.5 w-3.5" />
          <span>NextCut Studio · Private Video Share</span>
        </div>
      </div>
    );
  }

  // Active Client Watch View (Watch Only)
  return (
    <div className="min-h-screen bg-[#07080b] text-[#f0f2f5] flex flex-col justify-between selection:bg-amber-500/20">
      {/* Client Minimal Header - Strictly branding & review mode only */}
      <header className="w-full border-b border-zinc-900 bg-[#07080b]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Brand Logo - Watch Mode (No navigation to admin or upload) */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-sm">
              <Film className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-white">
              NextCut <span className="text-amber-400">Studio</span>
            </span>
          </div>

          {/* Quiet Status Badge */}
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-zinc-300">Client Preview Cut</span>
          </div>
        </div>
      </header>

      {/* Main Video Viewing Theater */}
      <main className="flex-1 flex flex-col items-center justify-center px-3 py-6 sm:px-6 sm:py-10">
        <div className="w-full max-w-5xl">
          {/* Video Title Header */}
          <div className="mb-3 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <h1 className="font-display text-base sm:text-xl font-bold text-white truncate max-w-2xl">
              {video.originalFileName}
            </h1>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock className="h-3 w-3" />
              <span>{formatDate(video.uploadDate)}</span>
            </div>
          </div>

          {/* Dedicated Custom Video Player */}
          <div className="rounded-xl overflow-hidden shadow-2xl shadow-black ring-1 ring-zinc-800">
            <VideoPlayer videoId={videoId} autoPlay={false} />
          </div>

          {/* Subtle client viewing footnote */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Original master playback · Watch only</span>
            <span>NextCut Studio Player</span>
          </div>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="w-full border-t border-zinc-900/60 py-4 text-center text-xs text-zinc-600">
        <span>Powered by NextCut Studio · Private Client Delivery</span>
      </footer>
    </div>
  );
};
