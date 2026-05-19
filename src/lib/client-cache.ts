/**
 * Client-side API cache with TTL.
 * Prevents redundant fetches when navigating between pages (SPA pattern).
 * Uses in-memory cache + localStorage for persistence across page refreshes.
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// In-memory cache for current session
const memoryCache = new Map<string, CacheEntry<any>>();

// Default TTL: 60 seconds for client-side (longer than server since user can manually refresh)
const DEFAULT_TTL = 60_000;

/**
 * Fetch with client-side caching.
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

  // Check localStorage cache (survives page refresh)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`cc_${url}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CacheEntry<T>;
        if (parsed.expiry > now) {
          // Restore to memory cache
          memoryCache.set(url, parsed);
          return parsed.data;
        }
        // Expired, remove from localStorage
        localStorage.removeItem(`cc_${url}`);
      }
    } catch {
      // Ignore localStorage errors
    }
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

  // Store in localStorage (only for small responses)
  if (typeof window !== "undefined") {
    try {
      const size = JSON.stringify(data).length;
      if (size < 500_000) { // Only cache responses under 500KB
        localStorage.setItem(`cc_${url}`, JSON.stringify(entry));
      }
    } catch {
      // Ignore localStorage errors (quota exceeded, etc.)
    }
  }

  return data;
}

/**
 * Invalidate a specific cached URL.
 */
export function invalidateClientCache(url?: string) {
  if (!url) {
    memoryCache.clear();
    if (typeof window !== "undefined") {
      // Remove all client cache entries from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("cc_")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
    return;
  }

  memoryCache.delete(url);
  if (typeof window !== "undefined") {
    localStorage.removeItem(`cc_${url}`);
  }
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
