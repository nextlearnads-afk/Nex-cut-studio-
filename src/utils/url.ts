/**
 * URL and Routing utilities for GitHub Pages and Custom Domains
 */
import { getApiBaseUrl } from './apiConfig';

// Normalized base path from Vite (e.g. '/Nex-cut-studio-' or '')
export function getBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.replace(/\/$/, '');
}

/**
 * Returns clean relative application route (e.g. '/manage', '/watch/123')
 * Handles:
 * - Direct path with base: '/Nex-cut-studio-/watch/123' -> '/watch/123'
 * - Hash routing fallback: '#/watch/123' -> '/watch/123'
 * - Query parameter fallback: '?p=/watch/123' or '?/watch/123' -> '/watch/123'
 */
export function getCurrentAppRoute(): string {
  // 1. Check hash
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    return window.location.hash.slice(1);
  }

  // 2. Check query string redirect (standard GitHub Pages SPA redirect trick)
  if (window.location.search) {
    if (window.location.search.startsWith('?/')) {
      return window.location.search.slice(1).split('&')[0];
    }
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p');
    if (p) return p.startsWith('/') ? p : '/' + p;
  }

  // 3. Check pathname
  const pathname = window.location.pathname || '/';
  const base = getBaseUrl();

  let clean = pathname;
  if (base && clean.startsWith(base)) {
    clean = clean.slice(base.length);
  }

  if (!clean || clean === '') {
    clean = '/';
  }

  return clean;
}

/**
 * Push new route with correct base path for GitHub Pages
 */
export function navigateAppRoute(targetRoute: string): void {
  const base = getBaseUrl();
  const normalizedRoute = targetRoute.startsWith('/') ? targetRoute : '/' + targetRoute;
  const fullUrl = `${base}${normalizedRoute}`;

  window.history.pushState({}, '', fullUrl);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export interface ShareLinkOptions {
  backendUrl?: string;
  cloudStreamUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
}

/**
 * Generates the full, shareable client watch link.
 * Persistently routes the client directly to the video source
 * so any device, phone, or incognito browser can load the video.
 */
export function getClientShareLink(videoId: string, options?: ShareLinkOptions): string {
  const base = getBaseUrl();
  const origin = window.location.origin;
  const url = new URL(`${origin}${base}/watch/${videoId}`);

  if (options?.cloudStreamUrl) {
    url.searchParams.set('c', encodeURIComponent(options.cloudStreamUrl));
    if (options.fileName) url.searchParams.set('fn', encodeURIComponent(options.fileName));
    if (options.fileSize) url.searchParams.set('fs', options.fileSize.toString());
    if (options.duration) url.searchParams.set('d', options.duration.toString());
  } else {
    const api = options?.backendUrl || getApiBaseUrl();
    if (api) {
      url.searchParams.set('api', encodeURIComponent(api));
    }
  }

  return url.toString();
}
