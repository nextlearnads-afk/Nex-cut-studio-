import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteModalProps {
  isOpen: boolean;
  videoTitle: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  videoTitle,
  isDeleting,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#11131a] p-6 shadow-2xl relative text-left">
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Delete Video
            </h3>
            <p className="text-xs text-zinc-400">Irreversible action</p>
          </div>
        </div>

        <p className="text-sm text-zinc-300 mb-2 leading-relaxed">
          Are you sure you want to permanently delete this video?
        </p>

        <div className="p-3 mb-5 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-xs text-zinc-400 truncate">
          <span className="text-zinc-500">Video: </span>
          <span className="font-mono text-zinc-200 font-medium">{videoTitle}</span>
        </div>

        <p className="text-xs text-zinc-500 mb-6 leading-normal">
          This will permanently delete the video file from storage, remove its database record, and immediately invalidate all client viewing links. Anyone visiting the link will see a "Video Not Available" notice.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {isDeleting ? (
              <span className="inline-block h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span>{isDeleting ? 'Deleting...' : 'Delete Video'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
