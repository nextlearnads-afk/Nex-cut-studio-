import { VideoMetadata, OwnerVideoSummary } from '../types';

const DB_NAME = 'NextCutStudioDB';
const DB_VERSION = 1;
const STORE_VIDEOS = 'videos';

interface StoredVideoRecord extends VideoMetadata {
  blob?: Blob;
  thumbnailDataUrl?: string;
  ownerToken: string;
}

// Open or create IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
        db.createObjectStore(STORE_VIDEOS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Initial sample cut video generator so the site is never an empty void on GitHub Pages
function createSampleVideoBlob(): Blob {
  // A tiny valid blank/black WebM video header
  const sampleBase64 =
    'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAA14EBqmp0AAAAAAAAA' +
    'oEBoAQAAAAAAAEAAAAAAAZ1AawAAAAAAAC4AAAAAAAAAAAAAAAABAAAAAAAAAOFAawEAAAAAAACWAAAA' +
    'AAAA14EBrkBtAP8BAACAAACAAAABAAAAAQAAAAAAAABgawAAAAAAAAAyAAAAAAAAAAAAAAAAAAAAAAAA' +
    'AAAAAOBAawAAAAAAACcAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4UBrAAAAAAAAAC8AAAAAAAAAAAAAAAAA' +
    'AAAAAAAAAAAAgAAAAA==';
  try {
    const byteCharacters = atob(sampleBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'video/webm' });
  } catch {
    return new Blob([''], { type: 'video/mp4' });
  }
}

// Seed demo videos if store is empty on static hosting
export async function seedDemoVideosIfEmpty(): Promise<void> {
  try {
    const db = await openDB();
    const count = await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE_VIDEOS, 'readonly');
      const store = tx.objectStore(STORE_VIDEOS);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });

    if (count === 0) {
      const demoToken = 'demo_owner_token_01';
      const sampleBlob = createSampleVideoBlob();

      const sampleVideos: StoredVideoRecord[] = [
        {
          id: 'k8Xm92LaQp7Z',
          originalFileName: 'Commercial_Brand_Campaign_Master_Cut.mp4',
          fileSize: 485 * 1024 * 1024, // 485 MB
          format: 'video/mp4',
          uploadDate: new Date(Date.now() - 3600000 * 5).toISOString(),
          hasThumbnail: false,
          duration: 94.5,
          ownerToken: demoToken,
          blob: sampleBlob
        },
        {
          id: 'v4Pn81WzTm2Y',
          originalFileName: 'Documentary_Teaser_ColorGraded_v4.mov',
          fileSize: 1240 * 1024 * 1024, // 1.2 GB
          format: 'video/quicktime',
          uploadDate: new Date(Date.now() - 86400000 * 2).toISOString(),
          hasThumbnail: false,
          duration: 142.0,
          ownerToken: demoToken,
          blob: sampleBlob
        }
      ];

      const tx = db.transaction(STORE_VIDEOS, 'readwrite');
      const store = tx.objectStore(STORE_VIDEOS);
      for (const v of sampleVideos) {
        store.put(v);
      }

      // Also remember ownership in localStorage
      const storageKey = 'nextcut_owner_tokens';
      try {
        const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
        existing['k8Xm92LaQp7Z'] = demoToken;
        existing['v4Pn81WzTm2Y'] = demoToken;
        localStorage.setItem(storageKey, JSON.stringify(existing));
      } catch (_) {}
    }
  } catch (e) {
    console.warn('Demo video seed skipped:', e);
  }
}

export async function saveClientVideo(record: StoredVideoRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIDEOS, 'readwrite');
    const store = tx.objectStore(STORE_VIDEOS);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getClientVideo(id: string): Promise<StoredVideoRecord | null> {
  await seedDemoVideosIfEmpty();
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_VIDEOS, 'readonly');
    const store = tx.objectStore(STORE_VIDEOS);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function getClientOwnerVideos(ownerTokens: string[]): Promise<OwnerVideoSummary[]> {
  await seedDemoVideosIfEmpty();
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_VIDEOS, 'readonly');
    const store = tx.objectStore(STORE_VIDEOS);
    const req = store.getAll();

    req.onsuccess = () => {
      const all: StoredVideoRecord[] = req.result || [];
      const tokenSet = new Set(ownerTokens);
      const filtered = all
        .filter((v) => tokenSet.has(v.ownerToken))
        .map(({ blob, thumbnailDataUrl, ownerToken, ...meta }) => ({
          ...meta,
          status: 'ready'
        }));
      resolve(filtered);
    };

    req.onerror = () => resolve([]);
  });
}

export async function deleteClientVideo(id: string, token: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VIDEOS, 'readwrite');
    const store = tx.objectStore(STORE_VIDEOS);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result as StoredVideoRecord;
      if (!record) {
        return resolve(false);
      }
      if (record.ownerToken !== token) {
        return reject(new Error('Unauthorized: Invalid owner token'));
      }
      const delReq = store.delete(id);
      delReq.onsuccess = () => resolve(true);
      delReq.onerror = () => reject(delReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}
