import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { compare, hash } from "bcryptjs";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeEmail } from "@/lib/sanitize";
import { setUserSession } from "@/lib/session";
import {
  ADMIN_NAME,
  ADMIN_PASSWORD,
  isReservedAdminEmail,
} from "@/lib/admin-email";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const ATTEMPT_COOKIE = "hs_login_attempts";

function readAttemptsCookie(request: NextRequest): { count: number; lockedUntil: number } {
  const cookie = request.cookies.get(ATTEMPT_COOKIE);
  if (!cookie?.value) return { count: 0, lockedUntil: 0 };
  try {
    const parsed = JSON.parse(cookie.value);
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      lockedUntil: typeof parsed.lockedUntil === "number" ? parsed.lockedUntil : 0,
    };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: max 10 login attempts per minute per IP
    const rlKey = rateLimitKey(request, "login");
    if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later.", success: false },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed", success: false },
        { status: 400 }
      );
    }

    let { email, password } = parsed.data;
    email = sanitizeEmail(email);

    // Check cookie-based lockout (persists across cold starts)
    const attemptState = readAttemptsCookie(request);
    if (attemptState.count >= MAX_FAILED_ATTEMPTS && Date.now() < attemptState.lockedUntil) {
      const remainingMinutes = Math.ceil((attemptState.lockedUntil - Date.now()) / 60_000);
      return NextResponse.json(
        {
          error: `Account temporarily locked due to too many failed attempts. Please try again in ${remainingMinutes} minutes.`,
          success: false,
        },
        { status: 429 }
      );
    }

    // ── Reserved admin account ──
    // The admin logs in like a regular user with a fixed email/password.
    // Only ADMIN_PASSWORD is accepted (profile password changes are ignored
    // here) so the owner can never lock themselves out. The user doc is
    // auto-provisioned on first successful login and always elevated to admin.
    if (isReservedAdminEmail(email)) {
      // Trim whitespace — password managers / autofill often append a space.
      const normalizedPassword = password.trim();
      if (normalizedPassword !== ADMIN_PASSWORD) {
        return NextResponse.json(
          { error: "كلمة مرور الأدمن غير صحيحة", success: false },
          { status: 401 }
        );
      }

      let user = await db.user.findUnique({ where: { email } });

      if (!user) {
        const hashedPassword = await hash(ADMIN_PASSWORD, 12);
        user = await db.user.create({
          data: {
            name: ADMIN_NAME,
            email,
            password: hashedPassword,
            role: "admin",
            locale: "ar",
            isActive: true,
            birthday: "2000-01-01",
          },
        });

        try {
          const { adminAuth, firebaseReady } = await import("@/lib/firebase-admin");
          if (firebaseReady && adminAuth) {
            await adminAuth.createUser({
              email,
              displayName: ADMIN_NAME,
              password: ADMIN_PASSWORD,
            });
            console.log(`[Login] Created Firebase Auth user for admin: ${email}`);
          }
        } catch {
          // Non-critical — the admin can still log in via bcrypt
        }
      } else if (user.role !== "admin") {
        const updated = await db.user.update({
          where: { id: user.id },
          data: { role: "admin" },
        });
        user = { ...user, ...updated };
      }

      return buildLoginResponse(request, user, "admin");
    }

    // ── Normal users ──
    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return respondWithFailedAttempt(request, "Invalid credentials");
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated. Please contact support.", success: false },
        { status: 403 }
      );
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      return respondWithFailedAttempt(request, "Invalid credentials");
    }

    return buildLoginResponse(request, user, user.role === "admin" ? "admin" : "user");
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}

async function buildLoginResponse(
  request: NextRequest,
  user: any,
  role: "user" | "admin"
) {
  // Successful login — clear failed attempt cookie
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      avatar: user.avatar,
      phone: user.phone,
      locale: user.locale,
    },
    success: true,
  });

  try {
    const subs = await db.subscription.findMany({
      where: { userId: user.id, status: "active" },
    });
    const now = new Date();
    const validSub = subs.find((sub: any) => {
      return sub.endDate && new Date(sub.endDate).getTime() > now.getTime();
    });
    if (validSub) {
      const userData = JSON.parse(response.body ? await response.text() : "{}");
      userData.user.subscription = {
        plan: validSub.type,
        status: "active",
        expiresAt: validSub.endDate,
      };
      const updated = NextResponse.json(userData);
      updated.cookies.delete(ATTEMPT_COOKIE);
      await setUserSession(user.id, role);
      return updated;
    }
  } catch (e) {
    console.error("Failed to fetch user subscription:", e);
  }

  response.cookies.delete(ATTEMPT_COOKIE);
  await setUserSession(user.id, role);

  return response;
}

function respondWithFailedAttempt(request: NextRequest, message: string) {
  const state = readAttemptsCookie(request);
  const now = Date.now();
  let count = state.count + 1;
  let lockedUntil = state.lockedUntil;

  if (count >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = now + LOCKOUT_DURATION;
  }

  const response = NextResponse.json(
    { error: message, success: false },
    { status: 401 }
  );

  response.cookies.set(ATTEMPT_COOKIE, JSON.stringify({ count, lockedUntil }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.ceil(LOCKOUT_DURATION / 1000),
    path: "/",
  });

  return response;
}