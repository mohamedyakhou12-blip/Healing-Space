/**
 * Client-side API cache with TTL.
 * Prevents redundant fetches when navigating between pages (SPA pattern).
 *
 * In-memory only — responses are NEVER persisted to localStorage because:
 * 1. Content list responses are access-gated server-side per user; caching
 *    them in localStorage would leak premium content across users/sessions
 *    sharing the same browser.
 * 2. Persistent caching makes prices/content stale after admin changes —
 *    a page refresh must always show the latest published values.
 *
 * The memory cache is short-lived and cleared on every page reload.
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// In-memory cache for current session
const memoryCache = new Map<string, CacheEntry<any>>();

// Default TTL: 60 seconds for in-memory caching
const DEFAULT_TTL = 60_000;

/**
 * Fetch with client-side caching (memory only).
 * Returns cached data if fresh, otherwise fetches from API.
 * @param url API URL to fetch
 * @param ttlMs Cache TTL in ms (default 60s)
 */
export async function cachedFetch<T>(
  url: string,
  ttlMs: number = DEFAULT_TTL
): Promise<T> {
  const now = Date.now();

  // Check memory cache first (fastest)
  const memEntry = memoryCache.get(url);
  if (memEntry && memEntry.expiry > now) {
    return memEntry.data as T;
  }

  // Fetch from API
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json() as T;

  // Store in memory cache
  const entry: CacheEntry<T> = { data, expiry: now + ttlMs };
  memoryCache.set(url, entry);

  return data;
}

/**
 * Invalidate a specific cached URL (or the whole cache).
 * Call this after mutations so stale listings are re-fetched immediately.
 */
export function invalidateClientCache(url?: string) {
  if (!url) {
    memoryCache.clear();
    return;
  }

  memoryCache.delete(url);
}

/**
 * Get cache stats for debugging.
 */
export function getClientCacheStats() {
  return {
    memorySize: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
  };
}