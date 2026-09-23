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
export function timingSafeEqual(a: string, b: string): boolean {
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

  let dbHadError = false;
  let dbHasCode = false;

  // 1. Check database (authoritative source) — targeted query for efficiency
  try {
    const { db } = await import("@/lib/db");
    const codeRecord = await db.siteSetting.findUnique({
      where: { key: "admin_access_code" },
    });
    // If a code record exists in DB, use ONLY the DB value.
    // This prevents any old code from still working after a change.
    if (codeRecord && codeRecord.value) {
      return timingSafeEqual(codeRecord.value, providedCode);
    }
    dbHasCode = !!codeRecord?.value;
  } catch (dbError) {
    dbHadError = true;
    console.error(
      "[Admin Code] DB query failed:",
      dbError instanceof Error ? dbError.message : String(dbError)
    );
  }

  // 2a. If the DB errored (unreachable/misconfigured) we MUST NOT silently
  //     accept an env-var fallback in production: that would let a stale
  //     ADMIN_ACCESS_CODE keep working after the code was rotated in the DB,
  //     which is exactly the "old code still works" bug. Fail closed instead.
  if (dbHadError) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[Admin Code] DB verification unavailable in production. " +
        "Refusing to authenticate admin code (fail-closed). Check FIREBASE_SERVICE_ACCOUNT_KEY."
      );
      return false;
    }
    // In development, DB may legitimately be unavailable (no local emulator):
    // fall through to the env var so local testing still works.
  }

  // 2. Fallback: check env var (only when the DB has NO admin_access_code record)
  if (!dbHasCode) {
    const effectiveCode = getEnvCode();
    if (effectiveCode.length > 0 && timingSafeEqual(providedCode, effectiveCode)) return true;
    return false;
  }

  return false;
}

/** Get the current effective admin code from env (used only for display). */
export function getAdminCode(): string {
  return getEnvCode();
}
