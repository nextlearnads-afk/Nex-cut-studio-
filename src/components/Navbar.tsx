import React from 'react';
import { Film, UploadCloud, Video, HardDrive } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPath, onNavigate }) => {
  return (
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

        {/* Zone 3: Direct Action / Editor Badge */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400 border border-zinc-800 px-2.5 py-1 rounded-full bg-zinc-900/50">
            <HardDrive className="h-3 w-3 text-emerald-400" />
            <span>100% Free · 0 Cards</span>
          </div>

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
  );
};

