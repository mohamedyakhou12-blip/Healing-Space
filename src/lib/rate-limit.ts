/**
 * Centralized rate-limiting utility.
 *
 * NOTE: In-memory maps do NOT persist across serverless cold starts.
 * For production-grade rate limiting, configure Vercel KV / Upstash Redis.
 * This implementation remains per-instance but is minimal and safe.
 */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const MAX_MAP_SIZE = 10000;
function cleanStaleEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
  if (rateLimitMap.size > MAX_MAP_SIZE) {
    const entries = [...rateLimitMap.entries()]
      .sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toDelete = entries.slice(0, rateLimitMap.size - MAX_MAP_SIZE / 2);
    for (const [key] of toDelete) rateLimitMap.delete(key);
  }
}

export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
}

export function isRateLimited(
  key: string,
  opts?: RateLimitOptions
): boolean {
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
 * Resolve the real client IP.
 *
 * Security: the FIRST value of `x-forwarded-for` is fully attacker-controlled
 * (headers sent by the client are prepended by trusted proxies). Using it lets
 * an attacker rotate the key on every request and bypass every rate limit.
 * Instead we prefer:
 *   1. `x-real-ip` — set by the trusted edge proxy (Vercel sets it reliably).
 *   2. the LAST value of `x-forwarded-for` — the value appended by the trusted
 *      proxy closest to the server, i.e. the actual client.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for") || "";
  const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 0) return parts[parts.length - 1];

  return "unknown";
}

export function rateLimitKey(request: Request, prefix: string): string {
  return `${prefix}:${getClientIp(request)}`;
}