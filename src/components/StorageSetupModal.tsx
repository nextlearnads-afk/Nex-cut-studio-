import React, { useState, useEffect } from 'react';
import { Server, Cloud, Check, ExternalLink, X, ShieldAlert, Sparkles } from 'lucide-react';
import {
  getApiBaseUrl,
  setCustomBackendUrl,
  getCloudinaryConfig,
  setCloudinaryConfig
} from '../utils/apiConfig';

interface StorageSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const StorageSetupModal: React.FC<StorageSetupModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [tab, setTab] = useState<'backend' | 'cloudinary'>('backend');
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [cloudName, setCloudName] = useState<string>('');
  const [uploadPreset, setUploadPreset] = useState<string>('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setBackendUrl(getApiBaseUrl() || '');
      const cloud = getCloudinaryConfig();
      if (cloud) {
        setCloudName(cloud.cloudName || '');
        setUploadPreset(cloud.uploadPreset || '');
      }
      setTestStatus('idle');
      setTestMessage('');
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const testBackendConnection = async () => {
    if (!backendUrl.trim()) {
      setTestStatus('failed');
      setTestMessage('Please enter a backend URL to test.');
      return;
    }
    setTestStatus('testing');
    try {
      const cleanUrl = backendUrl.trim().replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/health`, { method: 'GET' });
      if (res.ok) {
        setTestStatus('success');
        setTestMessage('Connected successfully! Free backend is online and ready.');
      } else {
        setTestStatus('failed');
        setTestMessage(`Server reachable but returned status ${res.status}.`);
      }
    } catch (e: any) {
      setTestStatus('failed');
      setTestMessage(`Could not connect: ${e.message || 'Network error or CORS issue'}.`);
    }
  };

  const handleSave = () => {
    if (tab === 'backend') {
      setCustomBackendUrl(backendUrl.trim());
    } else {
      if (cloudName.trim() && uploadPreset.trim()) {
        setCloudinaryConfig({
          cloudName: cloudName.trim(),
          uploadPreset: uploadPreset.trim()
        });
      } else {
        setCloudinaryConfig(null);
      }
    }
    setSaveSuccess(true);
    onConfigSaved();
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#0f1117] p-6 shadow-2xl text-[#f0f2f5]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <div className="mb-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Persistent Video Storage</span>
          </div>
          <h2 className="text-xl font-bold text-white">Connect Free Cloud Storage</h2>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
            GitHub Pages is a static host. Connect a 100% free persistent storage system so clients can view your videos from any device or incognito window.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex rounded-lg bg-zinc-900/80 p-1 border border-zinc-800">
          <button
            onClick={() => setTab('backend')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors ${
              tab === 'backend'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>Free Render Backend</span>
          </button>
          <button
            onClick={() => setTab('cloudinary')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-colors ${
              tab === 'cloudinary'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cloud className="h-3.5 w-3.5" />
            <span>Free Cloudinary (25GB)</span>
          </button>
        </div>

        {/* Tab 1: Render.com / Free Node Backend */}
        {tab === 'backend' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Backend API URL
              </label>
              <input
                type="url"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="https://nextcut-backend.onrender.com"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-zinc-500">
                Deploy <code className="text-zinc-400">server.ts</code> to Render.com with 1 click using the included <code className="text-zinc-400">render.yaml</code> (100% free, no credit card).
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={testBackendConnection}
                disabled={testStatus === 'testing'}
                className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
              <a
                href="https://render.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <span>Render.com</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {testMessage && (
              <div
                className={`p-2.5 rounded-lg text-xs ${
                  testStatus === 'success'
                    ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                    : 'bg-red-950/40 border border-red-800 text-red-300'
                }`}
              >
                {testMessage}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Cloudinary Unsigned Cloud Storage */}
        {tab === 'cloudinary' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Cloudinary Cloud Name
              </label>
              <input
                type="text"
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                placeholder="e.g. my-studio"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Unsigned Upload Preset
              </label>
              <input
                type="text"
                value={uploadPreset}
                onChange={(e) => setUploadPreset(e.target.value)}
                placeholder="e.g. nexcut_unsigned"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-400 focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-zinc-500">
                100% Free: 25GB video storage, no credit card required. In Cloudinary Settings &gt; Upload &gt; Upload presets, add an unsigned preset.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <div className="text-xs text-zinc-500">
            {saveSuccess && <span className="text-emerald-400">Settings saved!</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-amber-300"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
