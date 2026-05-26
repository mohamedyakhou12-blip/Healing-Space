import { NextRequest, NextResponse } from "next/server";
import { sanitizeEmail } from "@/lib/sanitize";
import { setUserSession } from "@/lib/session";

/**
 * GET /api/auth/google-callback
 *
 * Google OAuth 2.0 callback — receives the authorization code from Google,
 * exchanges it for user info, creates a session, and redirects to the homepage.
 *
 * ARCHITECTURE: Uses setUserSession() from session.ts (same as admin login)
 * to ensure the session cookie is set using the exact same mechanism that
 * works reliably on Vercel. After setting the session, we return a redirect.
 *
 * If NextResponse.redirect() loses the Set-Cookie on some CDN layers,
 * we fall back to an HTML page with meta-refresh + JS redirect.
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = getBaseUrl();

  // User denied access
  if (error) {
    console.error("[Google Callback] OAuth error:", error);
    return NextResponse.redirect(`${baseUrl}/login?error=google_denied`);
  }

  if (!code) {
    console.error("[Google Callback] No authorization code received");
    return NextResponse.redirect(`${baseUrl}/login?error=no_code`);
  }

  try {
    const redirectUri = `${baseUrl}${REDIRECT_PATH}`;

    // Step 1: Exchange authorization code for tokens
    console.log("[Google Callback] Exchanging code for tokens...");
    console.log("[Google Callback] redirect_uri:", redirectUri);
    console.log("[Google Callback] client_id:", GOOGLE_CLIENT_ID ? "SET" : "EMPTY");
    console.log("[Google Callback] client_secret:", GOOGLE_CLIENT_SECRET ? "SET" : "EMPTY");

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
        return NextResponse.redirect(`${baseUrl}/login?error=redirect_uri_mismatch`);
      }
      if (errorText.includes("invalid_client")) {
        console.error(
          "[Google Callback] INVALID CLIENT! Check GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET env vars."
        );
        return NextResponse.redirect(`${baseUrl}/login?error=token_exchange_failed`);
      }
      return NextResponse.redirect(`${baseUrl}/login?error=token_exchange_failed`);
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();
    console.log("[Google Callback] Tokens received, access_token length:", tokens.access_token?.length);

    // Step 2: Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error("[Google Callback] Failed to get user info:", userInfoResponse.status);
      return NextResponse.redirect(`${baseUrl}/login?error=user_info_failed`);
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();
    console.log("[Google Callback] User info received for:", userInfo.email);

    if (!userInfo.email || !userInfo.email_verified) {
      console.error("[Google Callback] Missing or unverified email");
      return NextResponse.redirect(`${baseUrl}/login?error=email_not_verified`);
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

    // Step 4: Create session using the SAME mechanism as admin login
    const role = user.role === "admin" ? "admin" : "user";
    const redirectPath = role === "admin" ? "/admin" : "/";
    const redirectUrl = `${baseUrl}${redirectPath}?login=success`;

    console.log("[Google Callback] Login successful:", email, "role:", role, "userId:", user.id);

    try {
      // Use the SAME setUserSession() that works for admin login.
      // This uses cookies() from next/headers under the hood, which is the
      // proven reliable way to set cookies on Vercel.
      await setUserSession(user.id, role as "user" | "admin");

      console.log("[Google Callback] Session set successfully via setUserSession()");

      // Return a redirect — the Set-Cookie header should be preserved
      // because setUserSession() uses cookies() which Next.js applies
      // to the returned response.
      const response = NextResponse.redirect(redirectUrl);
      return response;
    } catch (sessionError) {
      console.error("[Google Callback] Failed to set session:", sessionError);

      // FALLBACK: If setUserSession() + redirect doesn't work,
      // try the HTML redirect approach with getIronSession directly
      try {
        const { getIronSession } = await import("iron-session");
        const { SESSION_OPTIONS } = await import("@/lib/session");

        const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting...</title>
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f0fdf4; color: #166534; }
    .container { text-align: center; padding: 2rem; }
    .spinner { display: inline-block; width: 32px; height: 32px; border: 3px solid #16653433; border-top-color: #166534; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
    p { margin: 0; color: #16653499; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0646\u062C\u0627\u062D! \u064A\u064F\u0639\u0627\u062F \u062A\u0648\u062C\u064A\u0647\u0643...</h2>
    <p>Login successful! Redirecting...</p>
  </div>
  <script>
    setTimeout(function() {
      window.location.replace("${redirectUrl.replace(/"/g, "&quot;")}");
    }, 500);
  </script>
</body>
</html>`;

        const htmlResponse = new NextResponse(htmlContent, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });

        const session = await getIronSession(request, htmlResponse, SESSION_OPTIONS);
        (session as any).userId = user.id;
        (session as any).userRole = role;
        (session as any).isAdmin = role === "admin";
        await session.save();

        console.log("[Google Callback] Session set via fallback getIronSession()");
        return htmlResponse;
      } catch (fallbackError) {
        console.error("[Google Callback] Fallback session also failed:", fallbackError);
        return NextResponse.redirect(`${baseUrl}/login?error=session_failed`);
      }
    }
  } catch (error) {
    console.error("[Google Callback] Unhandled error:", error);
    return NextResponse.redirect(`${baseUrl}/login?error=unknown`);
  }
}
