import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileVideo,
  CheckCircle2,
  Copy,
  ExternalLink,
  AlertCircle,
  Clock,
  Zap,
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { UploadProgressState } from '../types';
import { uploadVideoWithChunks } from '../utils/uploader';
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/format';
import { getClientShareLink } from '../utils/url';

interface UploadPageProps {
  onNavigate: (path: string) => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onNavigate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadProgressState>({
    status: 'idle',
    percent: 0,
    uploadedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
    estimatedSecondsRemaining: 0
  });
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Validate video format
  const validateFile = (file: File): string | null => {
    const validExtensions = ['.mp4', '.mov', '.webm', '.m4v'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
    const hasValidType = file.type.startsWith('video/') || hasValidExt;

    if (!hasValidType) {
      return 'This video format is not supported. Please upload MP4, MOV, or WEBM.';
    }
    return null;
  };

  const handleFileSelection = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState({
        status: 'error',
        percent: 0,
        uploadedBytes: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        estimatedSecondsRemaining: 0,
        errorMessage: validationError
      });
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setUploadState({
      status: 'idle',
      percent: 0,
      uploadedBytes: 0,
      totalBytes: file.size,
      speedBytesPerSec: 0,
      estimatedSecondsRemaining: 0,
      fileName: file.name,
      fileSize: file.size
    });
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  }, []);

  const startUpload = async () => {
    if (!selectedFile) return;

    abortControllerRef.current = new AbortController();

    try {
      await uploadVideoWithChunks({
        file: selectedFile,
        onProgress: (state) => {
          setUploadState(state);
        },
        signal: abortControllerRef.current.signal
      });
    } catch (err: any) {
      setUploadState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err.message || 'Upload failed. Please try again.'
      }));
    }
  };

  const handleCopyLink = () => {
    if (!uploadState.videoId) return;
    const clientUrl = getClientShareLink(uploadState.videoId, {
      cloudStreamUrl: uploadState.cloudStreamUrl,
      fileName: uploadState.fileName,
      fileSize: uploadState.fileSize
    });
    navigator.clipboard.writeText(clientUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadState({
      status: 'idle',
      percent: 0,
      uploadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      estimatedSecondsRemaining: 0
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isUploading =
    uploadState.status === 'preparing' ||
    uploadState.status === 'uploading' ||
    uploadState.status === 'finishing';

  const clientShareLink = uploadState.videoId
    ? getClientShareLink(uploadState.videoId, {
        cloudStreamUrl: uploadState.cloudStreamUrl,
        fileName: uploadState.fileName,
        fileSize: uploadState.fileSize
      })
    : '';

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Title & Brand Intro */}
      <div className="mb-8 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Editor Workspace</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          Upload Your Video
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
          Upload client cuts in bit-for-bit original quality. Get a private, watch-only link to send directly to your client with zero registration or compression.
        </p>
      </div>

      {/* Main Upload Card */}
      <div className="rounded-2xl border border-zinc-800 bg-[#10121a] p-6 sm:p-8 shadow-xl">
        {/* Hidden Native File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.webm,.m4v,video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelection(e.target.files[0]);
            }
          }}
        />

        {/* 1. SUCCESS STATE */}
        {uploadState.status === 'completed' && (
          <div className="py-4 text-center sm:text-left animate-in fade-in duration-200">
            <div className="mb-6 flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-black">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white">Video Uploaded Successfully</h3>
                <p className="text-xs text-emerald-300/90 mt-0.5">
                  Stored in original bit-for-bit master quality · Ready for client review
                </p>
              </div>
            </div>

            {/* Share Link Box */}
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/90 p-5">
              <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-2">
                Your Client Link
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1 overflow-hidden rounded-lg border border-zinc-700 bg-black/60 px-3.5 py-2.5 font-mono text-xs sm:text-sm text-amber-300 truncate select-all">
                  {clientShareLink}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95"
                >
                  <Copy className="h-4 w-4" />
                  <span>{copiedLink ? 'Copied to Clipboard!' : 'Copy Link'}</span>
                </button>
                <button
                  onClick={() => onNavigate(`/video/${uploadState.videoId}`)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 text-xs sm:text-sm font-medium transition-all"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open Video</span>
                </button>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Send this private link to your client. They will see only the clean video player with zero admin or file controls.
              </p>
            </div>

            {/* Actions: Upload Another / Go to Manage */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
              <button
                onClick={resetUpload}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                ← Upload another video
              </button>
              <button
                onClick={() => onNavigate('/manage')}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                <span>View all my uploaded videos</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 2. UPLOADING STATE (Live Progress UI) */}
        {isUploading && (
          <div className="py-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-base font-semibold text-white">
                  {uploadState.status === 'finishing' ? 'Finalizing stream...' : 'Uploading...'}
                </h3>
              </div>
              <span className="font-mono-numbers text-2xl font-bold text-amber-400">
                {uploadState.percent}%
              </span>
            </div>

            {/* Glowing Smooth Progress Bar */}
            <div className="relative mb-6 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-200 shadow-sm"
                style={{ width: `${uploadState.percent}%` }}
              />
            </div>

            {/* Metrics Grid: Formatted Size, Speed, ETA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Uploaded Size</div>
                <div className="font-mono-numbers text-sm font-semibold text-white mt-0.5">
                  {formatBytes(uploadState.uploadedBytes)} / {formatBytes(uploadState.totalBytes)}
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-400" />
                  <span>Upload Speed</span>
                </div>
                <div className="font-mono-numbers text-sm font-semibold text-amber-300 mt-0.5">
                  {formatSpeed(uploadState.speedBytesPerSec)}
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3 text-zinc-400" />
                  <span>Estimated Time</span>
                </div>
                <div className="font-mono-numbers text-sm font-semibold text-zinc-300 mt-0.5">
                  {formatTimeRemaining(uploadState.estimatedSecondsRemaining)}
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-zinc-500">
              High-speed direct chunked streaming · Original bit-for-bit quality preserved
            </p>
          </div>
        )}

        {/* 3. IDLE / SELECTION STATE */}
        {!isUploading && uploadState.status !== 'completed' && (
          <div>
            {/* Drag & Drop Zone */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`group relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                dragActive
                  ? 'border-amber-400 bg-amber-400/5 scale-[0.99]'
                  : 'border-zinc-700/80 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-900/70'
              }`}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80 text-amber-400 group-hover:scale-105 transition-transform shadow-inner">
                <UploadCloud className="h-8 w-8" />
              </div>

              <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                Drag and drop your video here
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 mb-4">
                or click to browse from your computer
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
                <span className="rounded bg-zinc-800/80 px-2 py-0.5 font-medium text-zinc-300">MP4</span>
                <span className="rounded bg-zinc-800/80 px-2 py-0.5 font-medium text-zinc-300">MOV</span>
                <span className="rounded bg-zinc-800/80 px-2 py-0.5 font-medium text-zinc-300">WEBM</span>
                <span className="text-zinc-600">·</span>
                <span>Any file size up to 20 GB free quota</span>
              </div>
            </div>

            {/* Error Message if any */}
            {uploadState.status === 'error' && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{uploadState.errorMessage || 'Upload failed. Please try again.'}</span>
              </div>
            )}

            {/* Selected File Details Bar */}
            {selectedFile && (
              <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-amber-400">
                      <FileVideo className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-white text-sm truncate">{selectedFile.name}</div>
                      <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                        <span>{formatBytes(selectedFile.size)}</span>
                        <span>·</span>
                        <span className="uppercase">{selectedFile.name.split('.').pop() || 'VIDEO'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      Select Video
                    </button>
                    <button
                      type="button"
                      onClick={startUpload}
                      className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 rounded-lg transition-all shadow-md active:scale-95"
                    >
                      <UploadCloud className="h-4 w-4" />
                      <span>Upload Video</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!selectedFile && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-6 py-2.5 text-xs sm:text-sm font-medium text-white transition-all shadow-sm"
                >
                  <UploadCloud className="h-4 w-4 text-amber-400" />
                  <span>Select Video</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor Guarantees & Features */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Zero Compression</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your original bit-for-bit render is preserved with identical resolution, FPS, bitrate, and audio fidelity.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>Fast Chunked Upload</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Uploaded in direct parallel chunks with automatic retry on spotty client internet connections.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white mb-1">
            <FileVideo className="h-4 w-4 text-blue-400" />
            <span>Private Client Link</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Clients see only the clean watch page with custom player. Zero logins, zero public gallery, zero download prompts.
          </p>
        </div>
      </div>
    </div>
  );
};
