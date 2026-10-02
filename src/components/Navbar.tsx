import React, { useState } from 'react';
import { Film, UploadCloud, Video, HardDrive, Settings } from 'lucide-react';
import { StorageSetupModal } from './StorageSetupModal';
import { getApiBaseUrl, getCloudinaryConfig } from '../utils/apiConfig';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  const [showStorageModal, setShowStorageModal] = useState<boolean>(false);
  const [hasRemote, setHasRemote] = useState<boolean>(() => Boolean(getApiBaseUrl() || getCloudinaryConfig()));

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#090a0f]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Zone 1: Single text element Brand Zone */}
          <button
            onClick={() => onNavigate('/upload')}
            className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-90 focus:outline-none"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-sm shadow-amber-500/20">
              <Film className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white">
              NextCut <span className="text-amber-400">Studio</span>
            </span>
          </button>

          {/* Zone 2: Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-6 text-sm font-medium">
            <button
              onClick={() => onNavigate('/upload')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm transition-colors rounded-md ${
                currentPath === '/upload' || currentPath === '/'
                  ? 'text-white bg-zinc-800/60 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span>Upload</span>
            </button>

            <button
              onClick={() => onNavigate('/manage')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm transition-colors rounded-md ${
                currentPath === '/manage'
                  ? 'text-white bg-zinc-800/60 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Video className="h-4 w-4" />
              <span>My Videos</span>
            </button>
          </nav>

          {/* Zone 3: Direct Action & Storage Setup */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowStorageModal(true)}
              title="Configure free persistent storage backend"
              className={`flex items-center gap-1.5 text-xs border px-2.5 py-1 rounded-full transition-colors ${
                hasRemote
                  ? 'border-emerald-800/80 bg-emerald-950/30 text-emerald-400 hover:bg-emerald-900/40'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <HardDrive className={`h-3 w-3 ${hasRemote ? 'text-emerald-400' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline">{hasRemote ? 'Cloud Storage Active' : 'Storage Setup'}</span>
              <Settings className="h-3 w-3 opacity-60 ml-0.5" />
            </button>

            <button
              onClick={() => onNavigate('/upload')}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-black transition-all hover:bg-zinc-200 active:scale-95 shadow-sm"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Video</span>
            </button>
          </div>
        </div>
      </header>

      {/* Storage Setup Modal */}
      <StorageSetupModal
        isOpen={showStorageModal}
        onClose={() => setShowStorageModal(false)}
        onConfigSaved={() => setHasRemote(Boolean(getApiBaseUrl() || getCloudinaryConfig()))}
      />
    </>
  );
};

