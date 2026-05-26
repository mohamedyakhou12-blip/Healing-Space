import { NextResponse } from "next/server";

/**
 * GET /api/auth/google-diagnose
 *
 * Diagnostic endpoint to check Google OAuth configuration.
 * Helps identify why Google sign-in might be failing.
 * Only returns non-sensitive configuration info.
 */
export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const redirectUri = `${baseUrl}/api/auth/google-callback`;

  const diagnostics = {
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID
      ? `${process.env.GOOGLE_OAUTH_CLIENT_ID.substring(0, 10)}...`
      : "NOT SET",
    googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET
      ? "SET (length: " + process.env.GOOGLE_OAUTH_CLIENT_SECRET.length + ")"
      : "NOT SET",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "NOT SET",
    vercelUrl: process.env.VERCEL_URL || "NOT SET",
    computedBaseUrl: baseUrl,
    redirectUri,
    sessionSecret: process.env.SESSION_SECRET
      ? "SET (length: " + process.env.SESSION_SECRET.length + ")"
      : "NOT SET",
    nodeEnv: process.env.NODE_ENV || "NOT SET",
    firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "NOT SET",
    firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? "SET (length: " + process.env.FIREBASE_SERVICE_ACCOUNT_KEY.length + ")"
      : "NOT SET",
    requiredRedirectUris: [
      redirectUri,
      "This URI MUST be registered in Google Cloud Console:",
      "APIs & Services > Credentials > OAuth 2.0 Client IDs > Authorized redirect URIs",
    ],
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
