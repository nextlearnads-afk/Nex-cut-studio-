export interface VideoMetadata {
  id: string;
  originalFileName: string;
  fileSize: number;
  format: string;
  uploadDate: string;
  hasThumbnail: boolean;
  duration?: number;
}

export interface OwnerVideoSummary extends VideoMetadata {
  status?: string;
}

export interface UploadProgressState {
  status: 'idle' | 'preparing' | 'uploading' | 'finishing' | 'completed' | 'error';
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  estimatedSecondsRemaining: number;
  errorMessage?: string;
  videoId?: string;
  ownerToken?: string;
  fileName?: string;
  fileSize?: number;
}
