import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

/**
 * Server-side session management using iron-session.
 * Sessions are encrypted cookies — no data stored server-side.
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
    console.warn("[SESSION] Build phase — using temporary build secret");
    return "build-phase-temporary-secret-do-not-use-at-runtime-32ch";
  }

  if (process.env.NODE_ENV === "production") {
    // Fail closed: never sign session cookies without a real secret.
    throw new Error(
      "[SECURITY] SESSION_SECRET is not set. Refusing to start in production. " +
      "Set SESSION_SECRET (at least 32 characters) in your environment before deploying. " +
      "Generate one with: openssl rand -base64 32"
    );
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