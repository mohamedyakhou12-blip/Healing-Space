/**
 * Centralized rate-limiting utility.
 *
 * Uses an in-memory map with lazy cleanup (no setInterval).
 * On Vercel serverless, each cold start creates a fresh instance,
 * so rate limiting is per-instance. For production-grade rate limiting,
 * use Vercel KV/Redis or Upstash.
 */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Lazy cleanup: remove stale entries when the map grows too large
const MAX_MAP_SIZE = 10000;
function cleanStaleEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
  // If still too large, remove oldest entries
  if (rateLimitMap.size > MAX_MAP_SIZE) {
    const entries = [...rateLimitMap.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toDelete = entries.slice(0, rateLimitMap.size - MAX_MAP_SIZE / 2);
    for (const [key] of toDelete) rateLimitMap.delete(key);
  }
}

export interface RateLimitOptions {
  /** Maximum number of requests in the window (default: 10) */
  max?: number;
  /** Window duration in ms (default: 60_000 = 1 min) */
  windowMs?: number;
}

/**
 * Check whether the given key is rate-limited.
 * Returns `true` when the limit has been exceeded.
 * Increments the counter on every call.
 */
export function isRateLimited(
  key: string,
  opts?: RateLimitOptions
): boolean {
  // Lazy cleanup: prune on every 100th call
  if (rateLimitMap.size > 1000) {
    cleanStaleEntries();
  }

  const max = opts?.max ?? 10;
  const windowMs = opts?.windowMs ?? 60_000;
  const now = Date.now();

  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  return entry.count > max;
}

/**
 * Build a rate-limit key from the request (IP-based).
 */
export function rateLimitKey(request: Request, prefix: string): string {
  const ip =
    (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
    "unknown";
  return `${prefix}:${ip}`;
}
