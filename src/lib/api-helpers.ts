/**
 * ⚠️ SECURITY WARNING: Admin Code in localStorage
 *
 * The admin code is currently stored in the browser's localStorage.
 * This means:
 * - Any XSS vulnerability in the application could leak the admin code
 * - Browser extensions with broad permissions can read it
 * - The code persists across sessions until explicitly cleared
 * - It is accessible to any JavaScript running on the same origin
 *
 * Mitigation strategies for future improvement:
 * 1. Move to HTTP-only, Secure, SameSite cookies set by the server
 * 2. Use short-lived session tokens instead of the raw admin code
 * 3. Implement CSRF protection on admin endpoints
 * 4. Consider a proper admin authentication flow (OAuth, etc.)
 *
 * Current approach is acceptable because:
 * - The admin code is always validated server-side on every request
 * - The X-Admin-Code header is only a secondary auth factor
 * - Primary auth is via server-side session cookie
 */
const STORAGE_KEY = "healing_space_admin_code";

function getStoredCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Get the current admin code from localStorage only.
 *
 * SECURITY: We no longer expose a hardcoded/fallback admin code on the client.
 * The admin code is obtained through the verify-admin API and stored in localStorage.
 * Server-side middleware validates the session cookie (set by verify-admin)
 * OR the X-Admin-Code header (for backward compatibility during transition).
 *
 * ⚠️ WARNING: localStorage is NOT secure storage. See top-of-file warning.
 * The admin code in localStorage should be considered a convenience token,
 * not a secure credential. Server-side validation remains the security gate.
 */
function getAdminCode(): string | null {
  return getStoredCode();
}

/** Save admin code to localStorage. */
export function setStoredAdminCode(code: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

/** Clear stored admin code (reset to default). */
export function clearStoredAdminCode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Build admin API headers.
 *
 * Sends the stored admin code (if any) via X-Admin-Code header.
 * The server-side session cookie (set by /api/auth/verify-admin)
 * provides the primary authentication layer.
 */
export function adminHeaders(): HeadersInit {
  const code = getAdminCode();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (code) {
    (headers as Record<string, string>)["X-Admin-Code"] = code;
  }
  return headers;
}

/**
 * Build admin API headers for FormData uploads.
 *
 * Does NOT set Content-Type — the browser sets it automatically
 * with the correct multipart/form-data boundary.
 * Only includes the X-Admin-Code header for authentication.
 */
export function adminFormDataHeaders(): HeadersInit {
  const code = getAdminCode();
  const headers: HeadersInit = {};
  if (code) {
    (headers as Record<string, string>)["X-Admin-Code"] = code;
  }
  return headers;
}

export function adminHeadersWithBody(body: Record<string, unknown>): { headers: HeadersInit; body: string } {
  return {
    headers: adminHeaders(),
    body: JSON.stringify(body),
  };
}
