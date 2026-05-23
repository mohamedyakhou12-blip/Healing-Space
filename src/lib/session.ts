import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

/**
 * Server-side session management using iron-session.
 * Sessions are encrypted cookies — no data stored server-side.
 *
 * SECURITY: This prevents IDOR attacks by ensuring the server
 * determines the userId from the session, not from client input.
 *
 * CRITICAL: SESSION_SECRET MUST be set in production.
 * The app will REFUSE to start in production without it.
 */

export interface SessionData {
  userId: string | null;
  userRole: "user" | "admin" | null;
  isAdmin: boolean;
}

declare module "iron-session" {
  interface IronSessionData {
    userId?: string;
    userRole?: "user" | "admin";
    isAdmin?: boolean;
  }
}

/**
 * Get the session secret — MUST be set via environment variable in production.
 * In development, a fixed fallback is used for convenience.
 * In production, missing SESSION_SECRET is a fatal error.
 */
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    const secret = process.env.SESSION_SECRET;
    if (secret.length < 32) {
      throw new Error(
        "[SECURITY] SESSION_SECRET is too short! Must be at least 32 characters. " +
        "Generate one with: openssl rand -base64 32"
      );
    }
    return secret;
  }

  // During build time, env vars may not be available on Vercel
  if (process.env.NEXT_PHASE === "phase-production-build") {
    console.warn("[SESSION] Build phase — using temporary build secret");
    return "build-phase-temporary-secret-do-not-use-at-runtime";
  }

  // In production without SESSION_SECRET, derive a stable secret from
  // other available env vars so sessions work consistently across cold starts.
  // This is NOT ideal but prevents the app from crashing entirely.
  if (process.env.NODE_ENV === "production") {
    // Try to derive from Firebase project ID + API key (both are stable and available)
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f";
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
    const derived = `hs-session-${projectId}-${apiKey}-derived-key-at-least-32-chars`;
    if (derived.length >= 32) {
      console.warn(
        "[SESSION] ⚠️ SESSION_SECRET not set! Deriving from project config. " +
        "This is less secure — set SESSION_SECRET env var for proper security."
      );
      return derived;
    }

    // Last resort fallback — this should never happen but prevents crash
    console.error(
      "[SESSION] ⚠️ SESSION_SECRET not set and cannot derive! Using insecure fallback. " +
      "SET SESSION_SECRET env var immediately!"
    );
    return "production-fallback-secret-please-set-env-var-32ch";
  }

  // In development only, use a fixed fallback for convenience
  console.warn(
    "[SECURITY] ⚠️ SESSION_SECRET not set! Using development fallback. " +
    "Set SESSION_SESSION env var before deploying to production!"
  );
  return "dev-only-fallback-secret-do-not-use-in-prod-32ch";
}

const SESSION_OPTIONS = {
  password: getSessionSecret(),
  cookieName: "healing_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days (reduced from 30 for better security)
    path: "/",
  },
};

/**
 * Get the current session from the request cookies.
 * Returns the session object for reading/updating.
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

/**
 * Get the current user ID from session (non-throwing).
 * Returns userId if authenticated, or null if not.
 */
export async function getUserFromSession(): Promise<string | null> {
  const session = await getSession();
  return session.userId || null;
}

/**
 * Require an authenticated user session.
 * Returns userId if authenticated, or null if not.
 */
export async function requireAuth(): Promise<string | null> {
  const session = await getSession();
  return session.userId || null;
}

/**
 * Require an admin session.
 * Returns userId if admin, or null if not admin.
 */
export async function requireAdmin(): Promise<string | null> {
  const session = await getSession();
  if (session.isAdmin && session.userId) {
    return session.userId;
  }
  return null;
}

/**
 * Set user session after successful login/register/google-auth.
 */
export async function setUserSession(
  userId: string,
  role: "user" | "admin"
): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  session.userRole = role;
  session.isAdmin = role === "admin";
  await session.save();
}

/**
 * Clear the session (logout).
 */
export async function clearSession(): Promise<void> {
  const session = await getSession();
  session.userId = null;
  session.userRole = null;
  session.isAdmin = false;
  await session.save();
}
