/**
 * CSRF Token Utilities — Double-Submit Cookie Pattern
 *
 * Security model:
 * 1. Server generates a cryptographically random CSRF token
 * 2. Token is set as a cookie (sent automatically by browser)
 * 3. Token is also returned in response body for client-side storage
 * 4. Client must send the token in a custom X-CSRF-Token header
 * 5. Middleware validates cookie value === header value
 *
 * This is secure because:
 * - An attacker cannot read the cookie from a different origin (Same-Origin Policy)
 * - An attacker cannot set custom headers on cross-origin requests (CORS preflight)
 * - Therefore, the attacker cannot make both the cookie and header match
 */

const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "X-CSRF-Token";
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure random token
 */
export function generateCSRFToken(): string {
  const bytes = new Uint8Array(CSRF_TOKEN_LENGTH);
  // Use Web Crypto API (available in Edge Runtime)
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get the CSRF cookie name
 */
export function getCSRFCookieName(): string {
  return CSRF_COOKIE_NAME;
}

/**
 * Get the CSRF header name
 */
export function getCSRFHeaderName(): string {
  return CSRF_HEADER_NAME;
}

/**
 * Validate CSRF token: compare cookie value with header value
 * Uses timing-safe comparison to prevent timing attacks
 */
export function validateCSRFToken(
  cookieToken: string | undefined | null,
  headerToken: string | undefined | null
): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }

  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  // Timing-safe comparison
  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if a path should be exempt from CSRF validation
 * (e.g., the CSRF token endpoint itself, webhooks, etc.)
 */
export function isCSRFExemptPath(path: string): boolean {
  const exemptPaths = [
    "/api/csrf-token",               // The token endpoint itself
    "/api/auth/google",              // Google auth callback (may not have CSRF token yet)
    "/api/auth/login",               // Login endpoint (user doesn't have CSRF token before auth)
    "/api/auth/register",            // Registration endpoint (user doesn't have CSRF token before auth)
    "/api/auth/verify-admin",        // Admin code verification (happens during auth flow)
    "/api/auth/logout",              // Logout endpoint (should always work)
    "/api/auth/session",             // Session check (GET only, but just in case)
    "/api/upload",                   // File uploads use FormData + admin code auth (not CSRF token)
    "/api/cloudinary/signature",     // Cloudinary signed upload params (JSON + admin auth)
  ];
  return exemptPaths.some((exempt) => path.startsWith(exempt));
}
