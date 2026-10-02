/**
 * NextCut Studio Backend & Cloud Storage Configuration
 * Connects the GitHub Pages frontend to persistent remote storage.
 */

const STORAGE_KEY_BACKEND = 'nextcut_backend_url';
const STORAGE_KEY_CLOUDINARY = 'nextcut_cloudinary_config';

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

export function getApiBaseUrl(): string {
  // 1. Check Vite environment variable (set during build or in .env)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '');
  }

  // 2. Check localStorage configured by Owner
  try {
    const saved = localStorage.getItem(STORAGE_KEY_BACKEND);
    if (saved && saved.trim() !== '') {
      return saved.trim().replace(/\/$/, '');
    }
  } catch (_) {}

  // 3. If running locally on dev/prod server
  if (typeof window !== 'undefined' && !window.location.hostname.endsWith('github.io')) {
    return '';
  }

  return '';
}

export function setCustomBackendUrl(url: string): void {
  try {
    const cleaned = url.trim().replace(/\/$/, '');
    if (!cleaned) {
      localStorage.removeItem(STORAGE_KEY_BACKEND);
    } else {
      localStorage.setItem(STORAGE_KEY_BACKEND, cleaned);
    }
  } catch (_) {}
}

export function getCloudinaryConfig(): CloudinaryConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLOUDINARY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

export function setCloudinaryConfig(config: CloudinaryConfig | null): void {
  try {
    if (!config) {
      localStorage.removeItem(STORAGE_KEY_CLOUDINARY);
    } else {
      localStorage.setItem(STORAGE_KEY_CLOUDINARY, JSON.stringify(config));
    }
  } catch (_) {}
}

/**
 * Checks whether persistent remote storage is configured
 */
export function hasPersistentStorageConfigured(): boolean {
  return Boolean(getApiBaseUrl()) || Boolean(getCloudinaryConfig());
}
