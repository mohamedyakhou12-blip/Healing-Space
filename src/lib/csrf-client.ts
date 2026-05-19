/**
 * Client-side CSRF token management.
 *
 * This module:
 * 1. Fetches CSRF token from the server on initialization
 * 2. Stores it in memory (NOT localStorage — tokens should not persist across sessions)
 * 3. Provides the token for all mutating requests
 * 4. Auto-refreshes the token when it becomes invalid
 *
 * The token is sent via the X-CSRF-Token custom header on every
 * POST/PUT/DELETE/PATCH request. The server's proxy.ts middleware
 * validates this header against the __csrf cookie.
 */

const CSRF_HEADER_NAME = "X-CSRF-Token";
const CSRF_ENDPOINT = "/api/csrf-token";

let csrfToken: string | null = null;
let fetchPromise: Promise<string | null> | null = null;

/**
 * Fetch a new CSRF token from the server.
 * Deduplicates concurrent fetches.
 */
export async function fetchCSRFToken(): Promise<string | null> {
  // If already fetching, return the same promise
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch(CSRF_ENDPOINT);
      if (!res.ok) {
        throw new Error(`CSRF token fetch failed: ${res.status}`);
      }
      const data = await res.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    } catch (err) {
      console.warn("[CSRF] Token fetch error:", err);
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Get the current CSRF token.
 * Returns null if not yet fetched.
 */
export function getCSRFToken(): string | null {
  return csrfToken;
}

/**
 * Set the CSRF token (used after receiving it from the server).
 */
export function setCSRFToken(token: string): void {
  csrfToken = token;
}

/**
 * Clear the CSRF token (used on logout).
 */
export function clearCSRFToken(): void {
  csrfToken = null;
}

/**
 * Get the CSRF header name.
 */
export function getCSRFHeaderName(): string {
  return CSRF_HEADER_NAME;
}

/**
 * Initialize CSRF protection:
 * 1. Fetch the initial CSRF token
 * 2. Override global fetch to automatically include CSRF token
 * 3. Handle CSRF validation failures by refreshing the token
 *
 * Call this once on app startup (e.g., in the root layout or a client component).
 */
export function initCSRFProtection(): void {
  if (typeof window === "undefined") return;

  // Fetch initial token
  fetchCSRFToken().catch((err) => {
    console.warn("[CSRF] Failed to fetch initial token:", err);
  });

  // Override global fetch to add CSRF token to mutating requests
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method || "GET").toUpperCase();

    // Only add CSRF token for mutating requests
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      // Get or fetch the CSRF token
      let token = csrfToken;
      if (!token) {
        try {
          token = await fetchCSRFToken();
        } catch {
          // If we can't get a token, proceed without it
          // The server will reject with 403, and we'll handle it below
        }
      }

      if (token) {
        // Merge headers — handle both Headers object and plain object
        const existingHeaders = init?.headers || {};
        const newHeaders: Record<string, string> = {};

        // Copy existing headers
        if (existingHeaders instanceof Headers) {
          existingHeaders.forEach((value, key) => {
            newHeaders[key] = value;
          });
        } else if (Array.isArray(existingHeaders)) {
          for (const [key, value] of existingHeaders) {
            newHeaders[key] = value;
          }
        } else {
          Object.assign(newHeaders, existingHeaders);
        }

        // Add CSRF token header
        newHeaders[CSRF_HEADER_NAME] = token;

        init = {
          ...init,
          headers: newHeaders,
        };
      }
    }

    // Execute the original fetch
    const response = await originalFetch.call(window, input, init);

    // If CSRF validation failed, refresh the token and retry once
    if (response.status === 403) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data.code === "CSRF_INVALID") {
          console.warn("[CSRF] Token was invalid, refreshing and retrying...");

          // Fetch a new token
          const newToken = await fetchCSRFToken();

          if (newToken) {
            // Retry the request with the new token
            const retryHeaders: Record<string, string> = {};
            const existingHeaders = init?.headers || {};

            if (existingHeaders instanceof Headers) {
              existingHeaders.forEach((value, key) => {
                retryHeaders[key] = value;
              });
            } else if (Array.isArray(existingHeaders)) {
              for (const [key, value] of existingHeaders) {
                retryHeaders[key] = value;
              }
            } else {
              Object.assign(retryHeaders, existingHeaders);
            }

            retryHeaders[CSRF_HEADER_NAME] = newToken;

            const retryInit: RequestInit = {
              ...init,
              headers: retryHeaders,
            };

            return originalFetch.call(window, input, retryInit);
          }
        }
      } catch {
        // If retry fails, return the original response
      }
    }

    return response;
  };
}
