import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sanitizeEmail } from "@/lib/sanitize";
import { SESSION_OPTIONS } from "@/lib/session";

/**
 * GET /api/auth/google-callback
 *
 * Google OAuth 2.0 callback — receives the authorization code from Google,
 * exchanges it for user info, creates a session, and redirects to the homepage.
 *
 * ARCHITECTURE DECISION: Returns a 200 HTML page with JS redirect instead of
 * a 307 redirect. This ensures the Set-Cookie header is reliably delivered
 * to the browser. On Vercel's CDN, 307 redirects may lose Set-Cookie headers.
 *
 * Session is set using getIronSession(request, response, SESSION_OPTIONS)
 * with SESSION_OPTIONS imported from session.ts — this eliminates the
 * duplication that previously caused session cookie mismatches.
 */

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  "873540723647-0ca7nsrgolgd36nk60m49tn46u4759mn.apps.googleusercontent.com";

const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

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

/**
 * Generate an HTML page that redirects the user.
 * Uses 200 + JS redirect to guarantee Set-Cookie is delivered.
 */
function htmlRedirect(url: string, isError: boolean = false, errorDetail?: string): string {
  const bgColor = isError ? "#fef2f2" : "#f0fdf4";
  const textColor = isError ? "#991b1b" : "#166534";
  const message = isError
    ? "حدث خطأ أثناء تسجيل الدخول بغوغل. يُعاد توجيهك..."
    : "تم تسجيل الدخول بنجاح! يُعاد توجيهك...";
  const messageEn = isError
    ? "An error occurred during Google sign-in. Redirecting..."
    : "Login successful! Redirecting...";

  // Show error detail if available (for debugging)
  const errorInfo = errorDetail
    ? `<p style="margin-top:8px;font-size:0.8rem;color:${textColor}88;">${errorDetail}</p>`
    : "";

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
    ${errorInfo}
  </div>
  <script>
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

  const baseUrl = getBaseUrl();

  // User denied access
  if (error) {
    console.error("[Google Callback] OAuth error:", error);
    const response = new NextResponse(
      htmlRedirect(`${baseUrl}/login?error=google_denied`, true),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
    return response;
  }

  if (!code) {
    console.error("[Google Callback] No authorization code received");
    const response = new NextResponse(
      htmlRedirect(`${baseUrl}/login?error=no_code`, true),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
    return response;
  }

  try {
    const redirectUri = `${baseUrl}${REDIRECT_PATH}`;

    // Step 1: Exchange authorization code for tokens
    console.log("[Google Callback] Exchanging code for tokens...");
    console.log("[Google Callback] redirect_uri:", redirectUri);
    console.log("[Google Callback] client_id:", GOOGLE_CLIENT_ID ? "SET (" + GOOGLE_CLIENT_ID.substring(0, 10) + "...)" : "EMPTY");
    console.log("[Google Callback] client_secret:", GOOGLE_CLIENT_SECRET ? "SET (length: " + GOOGLE_CLIENT_SECRET.length + ")" : "EMPTY");

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

      let errorType = "token_exchange_failed";
      let detail = `HTTP ${tokenResponse.status}`;

      if (errorText.includes("redirect_uri_mismatch")) {
        errorType = "redirect_uri_mismatch";
        detail = `redirect_uri mismatch — ${redirectUri} must be in Google Cloud Console`;
        console.error(
          "[Google Callback] REDIRECT URI MISMATCH! The URI", redirectUri,
          "must be added in Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client > Authorized redirect URIs"
        );
      } else if (errorText.includes("invalid_client")) {
        detail = "Invalid client — check GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET";
        console.error("[Google Callback] INVALID CLIENT!");
      }

      const response = new NextResponse(
        htmlRedirect(`${baseUrl}/login?error=${errorType}`, true, detail),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
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
      const response = new NextResponse(
        htmlRedirect(`${baseUrl}/login?error=user_info_failed`, true),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
      return response;
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();
    console.log("[Google Callback] User info received for:", userInfo.email);

    if (!userInfo.email || !userInfo.email_verified) {
      console.error("[Google Callback] Missing or unverified email");
      const response = new NextResponse(
        htmlRedirect(`${baseUrl}/login?error=email_not_verified`, true),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
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
      // Fallback: create a temporary user object
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

    console.log("[Google Callback] Login successful:", email, "role:", role, "userId:", user.id);

    // ── Set session cookie on an HTML response ──
    // Using getIronSession(request, response, SESSION_OPTIONS) with
    // SESSION_OPTIONS imported from session.ts (not duplicated).
    // The 200 HTML response guarantees the Set-Cookie header is delivered.
    try {
      const htmlContent = htmlRedirect(redirectUrl, false);
      const response = new NextResponse(htmlContent, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });

      // Set the session cookie on this HTML response
      const session = await getIronSession(request, response, SESSION_OPTIONS);
      (session as any).userId = user.id;
      (session as any).userRole = role;
      (session as any).isAdmin = role === "admin";
      await session.save();

      console.log("[Google Callback] Session cookie set on HTML response for:", email);
      return response;
    } catch (sessionError) {
      console.error("[Google Callback] Failed to set session:", sessionError);
      const response = new NextResponse(
        htmlRedirect(`${baseUrl}/login?error=session_failed`, true, String(sessionError)),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
      return response;
    }
  } catch (error) {
    console.error("[Google Callback] Unhandled error:", error);
    const response = new NextResponse(
      htmlRedirect(`${baseUrl}/login?error=unknown`, true, String(error)),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
    return response;
  }
}
