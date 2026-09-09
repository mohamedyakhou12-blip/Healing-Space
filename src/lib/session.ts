import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

/**
 * Server-side session management using iron-session.
 * Sessions are encrypted cookies ó no data stored server-side.
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

  if (process.env.NEXT_PHASE === "phase-production-build") {
    console.warn("[SESSION] Build phase ó using temporary build secret");
    return "build-phase-temporary-secret-do-not-use-at-runtime-32ch";
  }

  if (process.env.NODE_ENV === "production") {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "";
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f";
    const derived = `hs-session-${projectId}-${Buffer.from(serviceAccount).toString("base64").substring(0, 32)}-key`;

    if (derived.length >= 32) {
      console.warn(
        "[SESSION] Warning: SESSION_SECRET not set! Deriving from service account. " +
        "SET SESSION_SECRET env var for proper security!"
      );
      return derived;
    }

    console.error(
      "[SESSION] Warning: SESSION_SECRET not set! Using insecure fallback. " +
      "SET SESSION_SECRET env var immediately!"
    );
    return "production-fallback-please-set-session-secret-32ch";
  }

  console.warn(
    "[SECURITY] Warning: SESSION_SECRET not set! Using development fallback."
  );
  return "dev-only-fallback-secret-do-not-use-in-prod-32ch";
}

export const SESSION_OPTIONS = {
  password: getSessionSecret(),
  cookieName: "healing_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

export async function getUserFromSession(): Promise<string | null> {
  const session = await getSession();
  return session.userId || null;
}

export async function requireAuth(): Promise<string | null> {
  const session = await getSession();
  return session.userId || null;
}

export async function requireAdmin(): Promise<string | null> {
  const session = await getSession();
  if (session.isAdmin && session.userId) {
    return session.userId;
  }
  return null;
}

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

export async function clearSession(): Promise<void> {
  const session = await getSession();
  session.userId = null;
  session.userRole = null;
  session.isAdmin = false;
  await session.save();
}