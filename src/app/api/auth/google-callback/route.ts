import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sanitizeEmail } from "@/lib/sanitize";

/**
 * GET /api/auth/google-callback
 *
 * Google OAuth 2.0 callback — receives the authorization code from Google,
 * exchanges it for user info, creates a session, and redirects to the homepage.
 *
 * This is the PRIMARY auth flow that bypasses all CORS/COOP issues by
 * handling OAuth entirely server-to-server.
 *
 * CRITICAL FIX: We use getIronSession(request, response, config) to set the
 * session cookie DIRECTLY on the NextResponse.redirect() response object.
 * Using setUserSession() (which calls cookies().set()) does NOT work because
 * cookies set via the next/headers cookies() API are NOT included in
 * explicitly created NextResponse objects.
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // User denied access
  if (error) {
    console.error("[Google Callback] OAuth error:", error);
    return NextResponse.redirect(new URL(`/login?error=google_denied`, getBaseUrl()));
  }

  if (!code) {
    console.error("[Google Callback] No authorization code received");
    return NextResponse.redirect(new URL(`/login?error=no_code`, getBaseUrl()));
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
        return NextResponse.redirect(new URL(`/login?error=redirect_uri_mismatch`, getBaseUrl()));
      }
      return NextResponse.redirect(new URL(`/login?error=token_exchange_failed`, getBaseUrl()));
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();
    console.log("[Google Callback] Tokens received, access_token length:", tokens.access_token?.length);

    // Step 2: Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error("[Google Callback] Failed to get user info:", userInfoResponse.status);
      return NextResponse.redirect(new URL(`/login?error=user_info_failed`, getBaseUrl()));
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();
    console.log("[Google Callback] User info received for:", userInfo.email);

    if (!userInfo.email || !userInfo.email_verified) {
      console.error("[Google Callback] Missing or unverified email");
      return NextResponse.redirect(new URL(`/login?error=email_not_verified`, getBaseUrl()));
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

    // Step 4: Create the redirect response FIRST, then set session cookie on it
    const role = user.role === "admin" ? "admin" : "user";
    const redirectPath = role === "admin" ? "/admin" : "/";
    const redirectUrl = new URL(redirectPath + "?login=success", getBaseUrl());

    console.log("[Google Callback] Login successful:", email, "role:", role);

    // ── CRITICAL FIX: Set session cookie on the redirect response ──
    // We must use getIronSession(request, response, config) so that
    // iron-session sets the Set-Cookie header directly on our
    // NextResponse.redirect() response object. Using setUserSession()
    // (which calls cookies().set()) does NOT work because those cookies
    // are not included in explicitly created NextResponse objects.
    try {
      const response = NextResponse.redirect(redirectUrl);

      // Use iron-session with Request + Response objects directly
      // This ensures the session cookie is set on our redirect response
      const session = await getIronSession(request, response, SESSION_OPTIONS);
      // Cast to any to bypass TypeScript module augmentation issue:
      // The IronSessionData interface is declared in session.ts but
      // TypeScript doesn't see it here because getIronSession(request, response, config)
      // returns IronSession<object> without the module augmentation.
      (session as any).userId = user.id;
      (session as any).userRole = role;
      (session as any).isAdmin = role === "admin";
      await session.save();

      console.log("[Google Callback] Session cookie set on redirect response");

      return response;
    } catch (sessionError) {
      console.error("[Google Callback] Failed to set session:", sessionError);
      return NextResponse.redirect(new URL(`/login?error=session_failed`, getBaseUrl()));
    }
  } catch (error) {
    console.error("[Google Callback] Unhandled error:", error);
    return NextResponse.redirect(new URL(`/login?error=unknown`, getBaseUrl()));
  }
}
