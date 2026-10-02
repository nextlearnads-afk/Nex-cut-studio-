import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { UploadPage } from './pages/UploadPage';
import { ManagePage } from './pages/ManagePage';
import { OwnerVideoPage } from './pages/OwnerVideoPage';
import { ClientWatchPage } from './pages/ClientWatchPage';
import { getCurrentAppRoute, navigateAppRoute } from './utils/url';
import { seedDemoVideosIfEmpty } from './utils/clientStorage';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => getCurrentAppRoute());

  useEffect(() => {
    // Ensure initial demo videos are seeded if on static GitHub Pages
    seedDemoVideosIfEmpty();

    const handlePopState = () => {
      setCurrentPath(getCurrentAppRoute());
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigate = (path: string) => {
    navigateAppRoute(path);
    setCurrentPath(getCurrentAppRoute());
  };

  // Route 1: Client Watch Page (STRICTLY WATCH ONLY - NO NAVBAR, NO ADMIN)
  const watchMatch = currentPath.match(/^\/watch\/([^/?#]+)/);
  if (watchMatch) {
    const videoId = watchMatch[1];
    return <ClientWatchPage videoId={videoId} />;
  }

  // Route 2: Owner Video Preview & Link Management
  const videoMatch = currentPath.match(/^\/video\/([^/?#]+)/);
  if (videoMatch) {
    const videoId = videoMatch[1];
    return (
      <div className="min-h-screen bg-[#090a0f] text-[#f0f2f5] flex flex-col justify-between selection:bg-amber-500/20">
        <Navbar currentPath={currentPath} onNavigate={navigate} />
        <main className="flex-1">
          <OwnerVideoPage videoId={videoId} onNavigate={navigate} />
        </main>
        <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
          NextCut Studio · Free Video Sharing for Creative Editors
        </footer>
      </div>
    );
  }

  // Route 3: Owner Management Dashboard
  if (currentPath === '/manage') {
    return (
      <div className="min-h-screen bg-[#090a0f] text-[#f0f2f5] flex flex-col justify-between selection:bg-amber-500/20">
        <Navbar currentPath={currentPath} onNavigate={navigate} />
        <main className="flex-1">
          <ManagePage onNavigate={navigate} />
        </main>
        <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
          NextCut Studio · Free Video Sharing for Creative Editors
        </footer>
      </div>
    );
  }

  // Route 4: Owner Upload Page (Default)
  return (
    <div className="min-h-screen bg-[#090a0f] text-[#f0f2f5] flex flex-col justify-between selection:bg-amber-500/20">
      <Navbar currentPath={currentPath} onNavigate={navigate} />
      <main className="flex-1">
        <UploadPage onNavigate={navigate} />
      </main>
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        NextCut Studio · Free Video Sharing for Creative Editors
      </footer>
    </div>
  );
}

