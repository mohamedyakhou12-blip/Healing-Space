/**
 * Server-side in-memory cache with TTL.
 * Reduces Firestore reads by caching API responses for a short period.
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// In-memory cache store (per-serverless-function instance)
const cache = new Map<string, CacheEntry<any>>();

// Default TTL: 30 seconds (good balance between freshness and performance)
const DEFAULT_TTL = 30_000;

/**
 * Get a value from cache, or compute and cache it.
 * @param key Cache key
 * @param fetcher Function to compute the value if not cached
 * @param ttlMs Time-to-live in milliseconds (default 30s)
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL
): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);

  if (entry && entry.expiry > now) {
    return entry.data as T;
  }

  const data = await fetcher();
  cache.set(key, { data, expiry: now + ttlMs });
  return data;
}

/**
 * Invalidate a cache entry (e.g., after admin creates/updates/deletes content).
 */
export function invalidateCache(keyPrefix?: string) {
  if (!keyPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Invalidate all content-related caches (called after any content mutation).
 */
export function invalidateContentCache() {
  invalidateCache("api:");
}

/**
 * Get cache stats (for debugging).
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
