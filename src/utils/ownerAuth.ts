const STORAGE_KEY = 'nextcut_owner_tokens';

export function getStoredOwnerTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse owner tokens:', err);
    return {};
  }
}

export function saveOwnerToken(videoId: string, token: string): void {
  try {
    const current = getStoredOwnerTokens();
    current[videoId] = token;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save owner token:', err);
  }
}

export function getOwnerToken(videoId: string): string | null {
  const current = getStoredOwnerTokens();
  return current[videoId] || null;
}

export function isOwnerOf(videoId: string): boolean {
  return Boolean(getOwnerToken(videoId));
}

export function getAllOwnerTokens(): string[] {
  const current = getStoredOwnerTokens();
  return Object.values(current);
}

export function removeOwnerToken(videoId: string): void {
  try {
    const current = getStoredOwnerTokens();
    delete current[videoId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to remove owner token:', err);
  }
}
