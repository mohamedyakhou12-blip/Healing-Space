import { NextRequest, NextResponse } from "next/server";
import { setUserSession } from "@/lib/session";
import { sanitizeEmail } from "@/lib/sanitize";

/**
 * GET /api/auth/google-callback
 *
 * Google OAuth 2.0 callback — receives the authorization code from Google,
 * exchanges it for user info, creates a session, and redirects to the homepage.
 *
 * This is the PRIMARY auth flow that doesn't depend on Firebase Client SDK.
 * It bypasses all CORS/COOP issues by handling OAuth server-to-server.
 *
 * IMPORTANT: The session cookie MUST be set on the redirect response.
 * In Next.js App Router, cookies set via iron-session's save() may not
 * propagate to NextResponse.redirect(). We use the cookies() API to
 * explicitly copy the session cookie to the redirect response.
 */

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  "873540723647-0ca7nsrgolgd36nk60m49tn46u4759mn.apps.googleusercontent.com";

const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

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
      // Check for redirect_uri_mismatch error
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
        // Update googleUid if missing
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
      // Fallback: create temporary user from token data
      user = {
        id: userInfo.sub,
        name: userInfo.name || email.split("@")[0],
        email,
        role: "user",
        avatar: userInfo.picture || null,
      };
      isNewUser = true;
    }

    // Step 4: Set session and redirect
    const role = user.role === "admin" ? "admin" : "user";
    const redirectPath = role === "admin" ? "/admin" : "/";
    const redirectUrl = new URL(redirectPath + "?login=success", getBaseUrl());

    console.log("[Google Callback] Login successful:", email, "role:", role);

    // ── Set session cookie and create redirect response ──
    // We must ensure the session cookie is set on the redirect response.
    // In Next.js App Router, cookies set via iron-session may not
    // automatically be included in NextResponse.redirect() responses.
    try {
      await setUserSession(user.id, role);

      // Create redirect and explicitly copy the session cookie
      const response = NextResponse.redirect(redirectUrl);

      // Read the session cookie that was just set by setUserSession
      // and explicitly add it to the redirect response
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const sessionCookie = cookieStore.get("healing_session");

      if (sessionCookie) {
        response.cookies.set("healing_session", sessionCookie.value, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        });
        console.log("[Google Callback] Session cookie set on redirect response");
      } else {
        console.warn("[Google Callback] Session cookie not found after setUserSession!");
      }

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
