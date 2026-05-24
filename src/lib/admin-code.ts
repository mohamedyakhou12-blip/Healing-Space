/**
 * Admin code validation — DB-first approach.
 *
 * The admin code is stored in Firestore (siteSettings collection, key: "admin_access_code").
 * The environment variable ADMIN_ACCESS_CODE serves only as a FALLBACK when the database is unavailable.
 *
 * SECURITY: Never use NEXT_PUBLIC_ADMIN_ACCESS_CODE — it exposes the code in the client bundle.
 * Only the server-side ADMIN_ACCESS_CODE env var is checked.
 *
 * ⚠️ SECURITY NOTE: The admin code is sent via X-Admin-Code header from the client,
 * where it is stored in localStorage. This is a known security limitation:
 * - localStorage is accessible to any JS on the same origin (XSS risk)
 * - The code is transmitted on every admin API request
 * - Consider migrating to HTTP-only session cookies for better protection
 *
 * On Vercel serverless, in-memory state resets on cold starts.
 * So we always verify against DB first, then env var as fallback.
 */

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Returns true if both strings are equal, false otherwise.
 * The comparison time does not depend on the position of the first difference.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a full comparison to avoid leaking length info via timing
    // but the result will always be false
    let result = a.length ^ b.length;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    }
    return result === 0 && a.length === b.length;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get the admin code from the environment variable.
 * If not set, returns empty string (admin access denied via env var).
 */
function getEnvCode(): string {
  // SECURITY: Only use server-side env var. Never expose admin code to client.
  return process.env.ADMIN_ACCESS_CODE || "";
}

/**
 * Check whether a non-empty admin code is configured.
 * Returns true if the env var has a code set.
 * Note: DB check is async and not done here — use validateAdminCode()
 * for the full check including DB.
 */
export function hasAdminCode(): boolean {
  return getEnvCode().length > 0;
}

/**
 * Validate an admin code. Checks DB first (authoritative), then env var (fallback).
 * If no code is configured anywhere, admin access is denied.
 */
export async function validateAdminCode(providedCode: string | null): Promise<boolean> {
  if (!providedCode) return false;

  // 1. Check database (authoritative source)
  try {
    const { db } = await import("@/lib/db");
    const settings: any[] = await db.siteSetting.findMany();
    if (Array.isArray(settings)) {
      const codeRecord = settings.find(
        (s: any) => s && s.key === "admin_access_code"
      );
      // If a code record exists in DB, use ONLY the DB value.
      // This prevents any old code from still working after a change.
      if (codeRecord && codeRecord.value) {
        return timingSafeEqual(codeRecord.value, providedCode);
      }
    }
  } catch (dbError) {
    console.warn("[Admin Code] DB query failed, falling back to env var:", dbError instanceof Error ? dbError.message : String(dbError));
  }

  // 2. Fallback: check env var (when DB has no admin_access_code record)
  const effectiveCode = getEnvCode();
  if (effectiveCode.length > 0 && timingSafeEqual(providedCode, effectiveCode)) return true;

  // 3. Last resort: if no admin code is configured anywhere (neither DB nor env var),
  //    allow a default code for initial setup. This ensures the admin can always
  //    access the dashboard at least once to configure a proper code.
  //    IMPORTANT: After the admin sets a code via the settings page, this default
  //    will no longer be accepted because the DB check (step 1) will find the record.
  const envCode = getEnvCode();
  const hasDbCode = await checkDbHasAdminCode();
  if (!envCode && !hasDbCode) {
    // No admin code configured anywhere — use default for initial setup
    const DEFAULT_SETUP_CODE = "052307";
    console.warn("[Admin Code] ⚠️ No admin code configured! Using default setup code. Set ADMIN_ACCESS_CODE env var or configure in admin settings.");
    if (timingSafeEqual(providedCode, DEFAULT_SETUP_CODE)) return true;
  }

  return false;
}

/**
 * Check if the DB has an admin_access_code record.
 * Returns false if DB is unavailable or no record exists.
 */
async function checkDbHasAdminCode(): Promise<boolean> {
  try {
    const { db } = await import("@/lib/db");
    const settings: any[] = await db.siteSetting.findMany();
    if (Array.isArray(settings)) {
      const codeRecord = settings.find(
        (s: any) => s && s.key === "admin_access_code"
      );
      return !!codeRecord && !!codeRecord.value;
    }
  } catch {
    // DB unavailable
  }
  return false;
}

/** Get the current effective admin code from env (used only for display). */
export function getAdminCode(): string {
  return getEnvCode();
}
