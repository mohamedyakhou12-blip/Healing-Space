import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sanitizeEmail } from "@/lib/sanitize";

/**
 * GET /api/auth/google-callback
 *
 * Google OAuth 2.0 callback — receives the authorization code from Google,
 * exchanges it for user info, creates a session, and redirects to the homepage.
 *
 * ARCHITECTURE DECISION: Instead of returning a 307 redirect (which may lose
 * Set-Cookie headers on some CDN/proxy layers like Vercel), we return a 200
 * HTML page that:
 *   1. Contains the Set-Cookie header (guaranteed to be stored by the browser)
 *   2. Uses JavaScript to redirect to the homepage
 *
 * This approach is proven reliable — browsers always respect Set-Cookie on
 * 200 responses, while 307 redirects may have the cookie silently dropped
 * by CDN layers or browser cookie jar handling.
 *
 * The inline script is allowed by our CSP (script-src includes 'unsafe-inline').
 */

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  "873540723647-0ca7nsrgolgd36nk60m49tn46u4759mn.apps.googleusercontent.com";

const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

// ── Session config (must match session.ts) ──
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "build-phase-temporary-secret-do-not-use-at-runtime";
  }
  if (process.env.NODE_ENV === "production") {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f";
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
    return `hs-session-${projectId}-${apiKey}-derived-key-at-least-32-chars`;
  }
  return "dev-only-fallback-secret-do-not-use-in-prod-32ch";
}

const SESSION_OPTIONS = {
  password: getSessionSecret(),
  cookieName: "healing_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  },
};

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

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

/**
 * Generate an HTML page that redirects the user after session creation.
 * This is used instead of NextResponse.redirect() to ensure the Set-Cookie
 * header is reliably delivered to the browser.
 */
function htmlRedirect(url: string, isError: boolean = false): string {
  const bgColor = isError ? "#fef2f2" : "#f0fdf4";
  const textColor = isError ? "#991b1b" : "#166534";
  const message = isError
    ? "حدث خطأ أثناء تسجيل الدخول بغوغل. يُعاد توجيهك..."
    : "تم تسجيل الدخول بنجاح! يُعاد توجيهك...";
  const messageEn = isError
    ? "An error occurred during Google sign-in. Redirecting..."
    : "Login successful! Redirecting...";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting...</title>
  <style>
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: ${bgColor};
      color: ${textColor};
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      display: inline-block;
      width: 32px;
      height: 32px;
      border: 3px solid ${textColor}33;
      border-top-color: ${textColor};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
    p { margin: 0; color: ${textColor}99; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>${message}</h2>
    <p>${messageEn}</p>
  </div>
  <script>
    // Small delay to ensure the browser processes the Set-Cookie header
    setTimeout(function() {
      window.location.replace("${url.replace(/"/g, "&quot;")}");
    }, 500);
  </script>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // User denied access
  if (error) {
    console.error("[Google Callback] OAuth error:", error);
    const redirectUrl = `/login?error=google_denied`;
    const response = new NextResponse(htmlRedirect(`${getBaseUrl()}${redirectUrl}`, true), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    return response;
  }

  if (!code) {
    console.error("[Google Callback] No authorization code received");
    const redirectUrl = `/login?error=no_code`;
    const response = new NextResponse(htmlRedirect(`${getBaseUrl()}${redirectUrl}`, true), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    return response;
  }

  try {
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}${REDIRECT_PATH}`;

    // Step 1: Exchange authorization code for tokens
    console.log("[Google Callback] Exchanging code for tokens...");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[Google Callback] Token exchange failed:", tokenResponse.status, errorText);
      if (errorText.includes("redirect_uri_mismatch")) {
        console.error(
          "[Google Callback] REDIRECT URI MISMATCH! The URI", redirectUri,
          "must be added in Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client > Authorized redirect URIs"
        );
        const response = new NextResponse(htmlRedirect(`${baseUrl}/login?error=redirect_uri_mismatch`, true), {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
        return response;
      }
      const response = new NextResponse(htmlRedirect(`${baseUrl}/login?error=token_exchange_failed`, true), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      return response;
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();
    console.log("[Google Callback] Tokens received, access_token length:", tokens.access_token?.length);

    // Step 2: Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error("[Google Callback] Failed to get user info:", userInfoResponse.status);
      const response = new NextResponse(htmlRedirect(`${baseUrl}/login?error=user_info_failed`, true), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      return response;
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();
    console.log("[Google Callback] User info received for:", userInfo.email);

    if (!userInfo.email || !userInfo.email_verified) {
      console.error("[Google Callback] Missing or unverified email");
      const response = new NextResponse(htmlRedirect(`${baseUrl}/login?error=email_not_verified`, true), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      return response;
    }

    // Step 3: Find or create user in database
    const email = sanitizeEmail(userInfo.email);
    let user: any;
    let isNewUser = false;

    try {
      const { db } = await import("@/lib/db");
      const existingByEmail = await db.user.findUnique({ where: { email } });

      if (existingByEmail) {
        const updateData: Record<string, unknown> = {};
        if (!existingByEmail.googleUid) updateData.googleUid = userInfo.sub;
        if (userInfo.picture && !existingByEmail.avatar) updateData.avatar = userInfo.picture;
        if (Object.keys(updateData).length > 0) {
          await db.user.update({ where: { id: existingByEmail.id }, data: updateData });
        }
        user = existingByEmail;
      } else {
        const existingByUid = await db.user.findUnique({ where: { googleUid: userInfo.sub } });
        if (existingByUid) {
          user = existingByUid;
        } else {
          isNewUser = true;
          const userData: Record<string, unknown> = {
            googleUid: userInfo.sub,
            name: userInfo.name || email.split("@")[0],
            email,
            role: "user",
            locale: "ar",
            isActive: true,
          };
          if (userInfo.picture) userData.avatar = userInfo.picture;
          user = await db.user.create({ data: userData });
          console.log("[Google Callback] New user created:", email);
        }
      }
    } catch (dbError) {
      console.error("[Google Callback] Database error:", dbError);
      user = {
        id: userInfo.sub,
        name: userInfo.name || email.split("@")[0],
        email,
        role: "user",
        avatar: userInfo.picture || null,
      };
      isNewUser = true;
    }

    // Step 4: Create session and redirect via HTML page
    const role = user.role === "admin" ? "admin" : "user";
    const redirectPath = role === "admin" ? "/admin" : "/";
    const redirectUrl = `${baseUrl}${redirectPath}?login=success`;

    console.log("[Google Callback] Login successful:", email, "role:", role);

    // ── Set session cookie on an HTML response (NOT a 307 redirect) ──
    // Returning an HTML page with Set-Cookie header is more reliable than
    // NextResponse.redirect() because browsers always process Set-Cookie
    // on 200 responses, while 307 redirects may lose the cookie on some
    // CDN/proxy layers (e.g., Vercel's edge network).
    try {
      const htmlContent = htmlRedirect(redirectUrl, false);
      const response = new NextResponse(htmlContent, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });

      // Set the session cookie directly on this response
      const session = await getIronSession(request, response, SESSION_OPTIONS);
      (session as any).userId = user.id;
      (session as any).userRole = role;
      (session as any).isAdmin = role === "admin";
      await session.save();

      console.log("[Google Callback] Session cookie set on HTML response for:", email);
      return response;
    } catch (sessionError) {
      console.error("[Google Callback] Failed to set session:", sessionError);
      const response = new NextResponse(htmlRedirect(`${baseUrl}/login?error=session_failed`, true), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      return response;
    }
  } catch (error) {
    console.error("[Google Callback] Unhandled error:", error);
    const response = new NextResponse(htmlRedirect(`${getBaseUrl()}/login?error=unknown`, true), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    return response;
  }
}
