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

export function rateLimitKey(request: Request, prefix: string): string {
  const ip =
    (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
    "unknown";
  return `${prefix}:${ip}`;
}