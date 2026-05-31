/**
 * Google Identity Services (GIS) — Popup-based Google Sign-In
 *
 * WHY: Firebase's signInWithPopup uses OAuth redirect_uri which must be
 * registered in Google Cloud Console. If the redirect_uri is missing or
 * the project was recreated, you get "redirect_uri_mismatch" (Error 400).
 *
 * GIS uses a DIFFERENT flow: it opens a popup and uses postMessage to
 * send the credential (JWT) back. No redirect URIs required!
 *
 * The only requirement is that the domain is listed in "Authorized
 * JavaScript origins" in the OAuth 2.0 Client configuration — which
 * is typically auto-configured by Firebase.
 *
 * FLOW:
 * 1. Load accounts.google.com/gsi/client script
 * 2. Initialize with our Google OAuth Client ID
 * 3. Call google.accounts.id.prompt() or use renderButton()
 * 4. Receive credential (JWT) in callback
 * 5. Send credential to /api/auth/google for server verification
 * 6. Server verifies via Google tokeninfo API and creates session
 */

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ||
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  "873540723647-0ca7nsrgolgd36nk60m49tn46u4759mn.apps.googleusercontent.com";

// GIS script URL
const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";

// Track if script is loaded
let scriptLoaded = false;
let scriptLoading = false;
let scriptLoadPromise: Promise<void> | null = null;

/**
 * Load the Google Identity Services script
 */
export function loadGISScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();

  if (scriptLoading && scriptLoadPromise) return scriptLoadPromise;

  scriptLoading = true;
  scriptLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
    };
    script.onerror = () => {
      scriptLoading = false;
      reject(new Error("Failed to load Google Identity Services script"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Sign in with Google using GIS popup flow
 *
 * Returns a JWT credential string that can be sent to the server
 * for verification.
 */
export async function signInWithGoogleGIS(): Promise<string> {
  await loadGISScript();

  return new Promise((resolve, reject) => {
    const google = (window as any).google;

    if (!google?.accounts?.id) {
      reject(new Error("Google Identity Services not available"));
      return;
    }

    // Initialize GIS
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: any) => {
        if (response.credential) {
          resolve(response.credential);
        } else {
          reject(new Error("No credential received from Google"));
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      // Use popup flow — this doesn't need redirect URIs
      ux_mode: "popup",
    });

    // Open the One Tap / popup prompt
    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed()) {
        const reason = notification.getNotDisplayedReason();
        console.warn("[GIS] Prompt not displayed:", reason);

        if (reason === "suppressed_by_user" || reason === "opt_out_or_no_session") {
          reject(new Error("auth/popup-closed-by-user"));
          return;
        }

        // Try the token client (OAuth2 implicit grant) as fallback
        tryOAuth2TokenClient(google, resolve, reject);
      } else if (notification.isSkippedMoment()) {
        const reason = notification.getSkippedReason();
        console.warn("[GIS] Prompt skipped:", reason);
        tryOAuth2TokenClient(google, resolve, reject);
      } else if (notification.isDismissedMoment()) {
        const reason = notification.getDismissedReason();
        console.warn("[GIS] Prompt dismissed:", reason);
        if (reason === "credential_returned") {
          return;
        }
        reject(new Error("auth/popup-closed-by-user"));
      }
    });
  });
}

/**
 * Fallback: Use Google OAuth2 Token Client (implicit grant)
 * This also doesn't require redirect URIs — it uses postMessage
 */
function tryOAuth2TokenClient(
  google: any,
  resolve: (value: string) => void,
  reject: (reason: any) => void
) {
  try {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: (response: any) => {
        if (response.access_token) {
          resolve(`access_token:${response.access_token}`);
        } else {
          reject(new Error("No access token received from Google OAuth2"));
        }
      },
      error_callback: (error: any) => {
        console.error("[GIS] OAuth2 token client error:", error);
        reject(new Error(error.message || "Google OAuth2 token client failed"));
      },
    });

    tokenClient.requestAccessToken();
  } catch (err) {
    console.error("[GIS] Failed to init OAuth2 token client:", err);
    reject(new Error("Failed to initialize Google OAuth2"));
  }
}

/**
 * Decode the JWT credential to get user info (client-side only)
 */
export function decodeCredential(credential: string): {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
} | null {
  try {
    const parts = credential.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get the Google OAuth Client ID being used
 */
export function getGoogleClientId(): string {
  return GOOGLE_CLIENT_ID;
}
