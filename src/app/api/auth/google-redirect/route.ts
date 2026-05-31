import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/google-redirect
 *
 * Server-side Google OAuth 2.0 flow — FALLBACK for when Firebase Client SDK
 * popup/redirect fails (e.g., auth/network-request-failed).
 *
 * This approach doesn't use the Firebase Client SDK at all.
 * Instead, it redirects the user directly to Google's OAuth consent screen.
 * After consent, Google redirects back to our callback URL.
 *
 * Flow:
 * 1. User clicks "Sign in with Google" → browser navigates here
 * 2. We redirect to Google OAuth consent screen
 * 3. User consents → Google redirects to /api/auth/google-callback
 * 4. We exchange the code for tokens, verify, and create a session
 * 5. We redirect the user to the homepage (logged in)
 */

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  "873540723647-0ca7nsrgolgd36nk60m49tn46u4759mn.apps.googleusercontent.com";

const REDIRECT_PATH = "/api/auth/google-callback";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}${REDIRECT_PATH}`;

  // Build the Google OAuth URL
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    // State parameter to prevent CSRF
    state: crypto.randomUUID(),
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  console.log("[Google Redirect] Redirecting to Google OAuth:", googleAuthUrl.substring(0, 100) + "...");

  return NextResponse.redirect(googleAuthUrl);
}
