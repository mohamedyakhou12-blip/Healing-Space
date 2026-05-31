import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { setUserSession } from "@/lib/session";
import { adminAuth, firebaseReady } from "@/lib/firebase-admin";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeEmail } from "@/lib/sanitize";

// ═══════════════════════════════════════════════════════════════════════
//  Google Authentication Route — Secure Implementation with Fallback
//
//  Flow:
//  1. Client calls signInWithPopup (Firebase Client SDK)
//  2. Client gets Firebase ID token
//  3. Client sends ID token to this endpoint
//  4. Server verifies token:
//     a. PRIMARY: Firebase Admin SDK verifyIdToken (cryptographically secure)
//     b. FALLBACK: Google tokeninfo endpoint (validates signature via Google)
//  5. Server finds or creates user in database
//  6. Server sets iron-session cookie and returns user data
//
//  Security:
//  - Rate limited (10 req/min per IP)
//  - Token verified server-side (Admin SDK preferred, tokeninfo fallback)
//  - Audience (aud) validated against our Firebase project ID
//  - Issuer (iss) validated as Google
//  - Input validated with Zod
//  - Email sanitized
// ═══════════════════════════════════════════════════════════════════════

const googleSchema = z.object({
  idToken: z.string().optional(),
  credential: z.string().optional(),
  accessToken: z.string().optional(),
}).refine(
  (data) => data.idToken || data.credential || data.accessToken,
  { message: "One of idToken, credential, or accessToken is required" }
);

// Our Firebase project ID — used to validate the token audience claim
const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f";

// Google OAuth Client ID — used by Google Identity Services (GIS)
// GIS JWT tokens have this as their audience instead of the Firebase project ID
const GOOGLE_OAUTH_CLIENT_ID =
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  "873540723647-0ca7nsrgolgd36nk60m49tn46u4759mn.apps.googleusercontent.com";

// ── Google tokeninfo fallback verification ──
// When Firebase Admin SDK is not configured (missing service account key),
// we use Google's public tokeninfo endpoint to verify the ID token.
// This validates the token signature using Google's public keys and
// checks the audience and issuer claims.
interface TokenInfoResult {
  sub: string;       // Google user ID (same as Firebase UID for Google auth)
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;       // Audience — must be our Firebase project
  iss: string;       // Issuer — must be Google
  exp?: number;      // Expiration time
}

async function verifyViaTokenInfo(idToken: string): Promise<{
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
} | null> {
  try {
    console.log("[Google Auth] Attempting tokeninfo fallback verification...");
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("[Google Auth] tokeninfo returned status:", res.status, errorText);
      return null;
    }

    const info: TokenInfoResult = await res.json();

    // Validate audience — the token MUST be for our Firebase project or Google OAuth client
    // Firebase ID tokens have aud = project ID
    // GIS JWT tokens have aud = Google OAuth Client ID
    const validAudiences = [
      FIREBASE_PROJECT_ID,
      `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
      `${FIREBASE_PROJECT_ID}.web.app`,
      GOOGLE_OAUTH_CLIENT_ID,
    ];

    if (!validAudiences.includes(info.aud)) {
      console.error("[Google Auth] tokeninfo: Invalid audience:", info.aud, "Expected one of:", validAudiences);
      return null;
    }

    // Validate issuer — must be Google
    const validIssuers = ["accounts.google.com", "https://accounts.google.com"];
    if (!validIssuers.includes(info.iss)) {
      console.error("[Google Auth] tokeninfo: Invalid issuer:", info.iss);
      return null;
    }

    // Check expiration
    if (info.exp && Date.now() / 1000 > info.exp) {
      console.error("[Google Auth] tokeninfo: Token expired");
      return null;
    }

    // Check email
    if (!info.email || !info.email_verified) {
      console.error("[Google Auth] tokeninfo: Missing or unverified email");
      return null;
    }

    console.log("[Google Auth] tokeninfo verification successful for:", info.email);
    return {
      uid: info.sub,
      email: info.email,
      name: info.name || info.email.split("@")[0],
      photoURL: info.picture,
    };
  } catch (err) {
    console.error("[Google Auth] tokeninfo request failed:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // ── Rate limiting ──
    const rlKey = rateLimitKey(request, "google-auth");
    if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later.", success: false },
        { status: 429 }
      );
    }

    // ── Parse and validate input ──
    const body = await request.json();
    const parsed = googleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed", success: false },
        { status: 400 }
      );
    }

    const { idToken, credential, accessToken } = parsed.data;

    // ── Determine which token to verify ──
    // GIS sends 'credential' (JWT), Firebase SDK sends 'idToken',
    // OAuth2 token client sends 'accessToken' (prefixed with 'access_token:')
    const tokenToVerify = idToken || credential || "";
    const isAccessToken = accessToken?.startsWith("access_token:");

    // ── Verify the token ──
    let uid: string;
    let email: string;
    let name: string;
    let photoURL: string | undefined;
    let phone: string | undefined;
    let verificationMethod: string;

    if (isAccessToken && accessToken) {
      // ── ACCESS TOKEN FLOW (GIS OAuth2 token client fallback) ──
      // Exchange access token for user info via Google userinfo endpoint
      const token = accessToken.replace("access_token:", "");
      console.log("[Google Auth] Verifying via access token...");
      try {
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!userInfoRes.ok) {
          return NextResponse.json(
            { error: "Failed to verify Google access token", success: false },
            { status: 401 }
          );
        }
        const userInfo = await userInfoRes.json();
        if (!userInfo.email || !userInfo.email_verified) {
          return NextResponse.json(
            { error: "Google account email not verified", success: false },
            { status: 401 }
          );
        }
        uid = userInfo.sub;
        email = userInfo.email;
        name = userInfo.name || email.split("@")[0];
        photoURL = userInfo.picture || undefined;
        phone = undefined;
        verificationMethod = "access-token-userinfo";
      } catch (err) {
        console.error("[Google Auth] Access token verification failed:", err);
        return NextResponse.json(
          { error: "Failed to verify Google access token", success: false },
          { status: 401 }
        );
      }
    } else if (firebaseReady && tokenToVerify) {
      // ── PRIMARY: Firebase Admin SDK verification ──
      try {
        const decodedToken = await adminAuth.verifyIdToken(tokenToVerify, true);
        uid = decodedToken.uid;
        email = decodedToken.email || "";
        name = decodedToken.name || email.split("@")[0];
        photoURL = decodedToken.picture || undefined;
        phone = decodedToken.phone_number || undefined;
        verificationMethod = "admin-sdk";
        console.log("[Google Auth] Token verified via Firebase Admin SDK for:", email);
      } catch (verifyError: any) {
        console.error("[Google Auth] Admin SDK verifyIdToken failed:", verifyError?.message);

        const errorCode = verifyError?.code;
        if (errorCode === "auth/id-token-expired") {
          return NextResponse.json(
            { error: "Session expired. Please sign in again.", success: false },
            { status: 401 }
          );
        }
        if (errorCode === "auth/id-token-revoked") {
          return NextResponse.json(
            { error: "Session revoked. Please sign in again.", success: false },
            { status: 401 }
          );
        }

        // Admin SDK failed — try tokeninfo fallback
        const tokenInfoResult = await verifyViaTokenInfo(tokenToVerify);
        if (!tokenInfoResult) {
          return NextResponse.json(
            { error: "Token verification failed. Please try again.", success: false },
            { status: 401 }
          );
        }
        uid = tokenInfoResult.uid;
        email = tokenInfoResult.email;
        name = tokenInfoResult.name;
        photoURL = tokenInfoResult.photoURL;
        phone = undefined;
        verificationMethod = "tokeninfo-fallback";
      }
    } else if (tokenToVerify) {
      // ── FALLBACK: Google tokeninfo verification ──
      console.warn("[Google Auth] Firebase Admin SDK not configured. Using tokeninfo fallback.");
      const tokenInfoResult = await verifyViaTokenInfo(tokenToVerify);
      if (!tokenInfoResult) {
        return NextResponse.json(
          { error: "فشل التحقق من الرمز. يرجى المحاولة مرة أخرى.", success: false },
          { status: 401 }
        );
      }
      uid = tokenInfoResult.uid;
      email = tokenInfoResult.email;
      name = tokenInfoResult.name;
      photoURL = tokenInfoResult.photoURL;
      phone = undefined;
      verificationMethod = "tokeninfo";
    } else {
      return NextResponse.json(
        { error: "No valid token provided", success: false },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Google account has no email address", success: false },
        { status: 400 }
      );
    }

    // Sanitize email
    email = sanitizeEmail(email);

    // ── Find or create the user in database ──
    let user: any;
    let isNewUser = false;
    let dbAvailable = true;

    try {
      // Check by email first
      const existingByEmail = await db.user.findUnique({ where: { email } });

      if (existingByEmail) {
        // Update googleUid and avatar if missing
        const updateData: Record<string, unknown> = {};
        if (!existingByEmail.googleUid) updateData.googleUid = uid;
        if (photoURL && !existingByEmail.avatar) updateData.avatar = photoURL;

        if (Object.keys(updateData).length > 0) {
          await db.user.update({ where: { id: existingByEmail.id }, data: updateData });
        }
        user = existingByEmail;
      } else {
        // Check by googleUid
        const existingByUid = await db.user.findUnique({ where: { googleUid: uid } });

        if (existingByUid) {
          user = existingByUid;
        } else {
          // New user — create account
          isNewUser = true;
          const userData: Record<string, unknown> = {
            googleUid: uid,
            name,
            email,
            role: "user",
            locale: "ar",
            isActive: true,
          };
          if (photoURL) userData.avatar = photoURL;
          if (phone) userData.phone = phone;

          user = await db.user.create({ data: userData });
          console.log("[Google Auth] New user created:", email);
        }
      }
    } catch (dbError) {
      console.error("[Google Auth] Database error during user lookup/create:", dbError);
      // FALLBACK: If database is not available, create a temporary user from token data
      // This allows Google sign-in to work even when Firestore is misconfigured
      console.warn("[Google Auth] Using token-based fallback (no database) for:", email);
      dbAvailable = false;
      user = {
        id: uid,
        name: name,
        email: email,
        role: "user",
        avatar: photoURL || null,
        phone: phone || null,
      };
      isNewUser = true;
    }

    // ── Set the server session (iron-session cookie) ──
    const role = user.role === "admin" ? "admin" : "user";
    try {
      await setUserSession(user.id, role);
    } catch (sessionError) {
      console.error("[Google Auth] Failed to set session:", sessionError);
      return NextResponse.json(
        { error: "Failed to create session. Please try again.", success: false },
        { status: 500 }
      );
    }

    // ── Return user data (NEVER include password or sensitive fields) ──
    console.log(`[Google Auth] Login successful via ${verificationMethod}:`, email);
    return NextResponse.json({
      success: true,
      isNewUser,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || photoURL || null,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("[Google Auth] Unhandled server error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}
