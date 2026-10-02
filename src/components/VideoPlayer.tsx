import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  PictureInPicture,
  Loader2
} from 'lucide-react';
import { formatDuration } from '../utils/format';
import { resolveVideoPlaybackSource } from '../utils/api';

interface VideoPlayerProps {
  videoId: string;
  posterUrl?: string;
  autoPlay?: boolean;
  customStreamUrl?: string;
  customApiUrl?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  posterUrl,
  autoPlay = false,
  customStreamUrl,
  customApiUrl
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [streamUrl, setStreamUrl] = useState<string>(() => customStreamUrl || `/api/videos/${videoId}/stream`);

  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (customStreamUrl) {
      setStreamUrl(customStreamUrl);
      return;
    }
    let active = true;
    resolveVideoPlaybackSource(videoId, customApiUrl).then((src) => {
      if (active) setStreamUrl(src);
    });
    return () => {
      active = false;
    };
  }, [videoId, customStreamUrl, customApiUrl]);

  // Auto-hide controls when playing and inactive
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 2600);
    }
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
    }
  }, []);

  const seekRelative = useCallback((deltaSeconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + deltaSeconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    resetHideTimer();
  }, [resetHideTimer]);

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.volume = val;
    setVolume(val);
    if (val === 0) {
      videoRef.current.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP failed:', e);
    }
  };

  const changePlaybackRate = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(5);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekRelative]);

  // Video element events
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);

    // Update buffer percentage
    const b = videoRef.current.buffered;
    if (b.length > 0 && videoRef.current.duration) {
      const bufferedEnd = b.end(b.length - 1);
      setBufferedPercent((bufferedEnd / videoRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
    setIsBuffering(false);
    if (autoPlay) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Scrubbing on progress bar
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const targetPercent = clickX / rect.width;
    const newTime = targetPercent * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const hoverX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = hoverX / rect.width;
    setHoverPosition(hoverX);
    setHoverTime(percent * duration);
  };

  const handleProgressMouseLeave = () => {
    setHoverTime(null);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
      className="group relative w-full overflow-hidden rounded-xl bg-black shadow-2xl select-none aspect-video flex items-center justify-center border border-zinc-800/80"
    >
      <video
        ref={videoRef}
        src={streamUrl}
        poster={posterUrl || `/api/videos/${videoId}/thumbnail`}
        preload="metadata"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setShowControls(true);
        }}
        onClick={togglePlay}
        className="h-full w-full object-contain cursor-pointer"
      />

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
            <span className="text-xs font-medium text-zinc-300">Loading original quality stream...</span>
          </div>
        </div>
      )}

      {/* Big Center Play Button Overlay on Pause */}
      {!isPlaying && !isBuffering && (
        <button
          onClick={togglePlay}
          className="absolute flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-amber-500/90 text-black shadow-lg shadow-amber-500/30 transition-all hover:scale-110 active:scale-95 hover:bg-amber-400"
          aria-label="Play video"
        >
          <Play className="h-7 w-7 sm:h-9 sm:w-9 translate-x-0.5 fill-black" />
        </button>
      )}

      {/* Custom Control Overlay Bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-12 transition-opacity duration-300 sm:px-5 sm:pb-4 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
          className="group/progress relative mb-3 h-2 w-full cursor-pointer rounded-full bg-zinc-700/60 transition-all hover:h-3"
        >
          {/* Buffered track */}
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full bg-zinc-500/50"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* Progress track */}
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full bg-amber-400"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Scrubber thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `${progressPercent}%` }}
          />

          {/* Timestamp Hover Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 rounded bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-mono-numbers text-white shadow-lg pointer-events-none"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatDuration(hoverTime)}
            </div>
          )}
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between text-white text-xs sm:text-sm">
          {/* Left Controls: Play/Pause, Rewind, FastForward, Time, Volume */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={togglePlay}
              className="rounded p-1 text-white hover:text-amber-400 transition-colors focus:outline-none"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
            </button>

            <button
              onClick={() => seekRelative(-5)}
              className="rounded p-1 text-zinc-400 hover:text-white transition-colors"
              title="Rewind 5s (←)"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              onClick={() => seekRelative(5)}
              className="rounded p-1 text-zinc-400 hover:text-white transition-colors"
              title="Fast Forward 5s (→)"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                onClick={toggleMute}
                className="rounded p-1 text-zinc-300 hover:text-white transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-zinc-400" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="hidden sm:block h-1 w-14 cursor-pointer accent-amber-400 opacity-70 hover:opacity-100 transition-opacity"
              />
            </div>

            {/* Time Display */}
            <div className="font-mono-numbers text-xs text-zinc-300">
              <span>{formatDuration(currentTime)}</span>
              <span className="text-zinc-500 mx-1">/</span>
              <span className="text-zinc-400">{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Right Controls: Speed Selector, PiP, Fullscreen */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Speed Selector */}
            <div className="relative">
              <select
                value={playbackRate}
                onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
                className="bg-transparent hover:bg-zinc-800/80 rounded px-1.5 py-0.5 text-xs font-mono-numbers text-zinc-300 border border-zinc-700/60 cursor-pointer focus:outline-none"
              >
                <option value="0.5" className="bg-zinc-900 text-white">0.5x</option>
                <option value="0.75" className="bg-zinc-900 text-white">0.75x</option>
                <option value="1" className="bg-zinc-900 text-white">1x</option>
                <option value="1.25" className="bg-zinc-900 text-white">1.25x</option>
                <option value="1.5" className="bg-zinc-900 text-white">1.5x</option>
                <option value="2" className="bg-zinc-900 text-white">2x</option>
              </select>
            </div>

            {/* Picture in Picture */}
            {'pictureInPictureEnabled' in document && (
              <button
                onClick={togglePiP}
                className="hidden sm:block rounded p-1 text-zinc-400 hover:text-white transition-colors"
                title="Picture in Picture"
              >
                <PictureInPicture className="h-4 w-4" />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="rounded p-1 text-zinc-300 hover:text-white transition-colors"
              title="Fullscreen (f)"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
