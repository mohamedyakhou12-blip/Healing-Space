import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { compare } from "bcryptjs";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeEmail } from "@/lib/sanitize";
import { setUserSession } from "@/lib/session";
import { validateAdminCode } from "@/lib/admin-code";

// ── Admin email for email/password login ──
// The admin logs in with this email. The password is the admin code itself.
const ADMIN_EMAIL = "admine@gmail.com";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// Track failed login attempts per email for account lockout
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

// Lazy cleanup: no setInterval (leaks in serverless).
// Prune stale entries when the map grows too large.
function cleanStaleAttempts() {
  const now = Date.now();
  for (const [key, entry] of failedAttempts) {
    if (now > entry.lockedUntil) failedAttempts.delete(key);
  }
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  try {
    // Lazy cleanup of stale failed attempt records
    if (failedAttempts.size > 500) cleanStaleAttempts();

    // Rate limiting: max 5 login attempts per minute per IP (reduced from 10)
    const rlKey = rateLimitKey(request, "login");
    if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
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

    // Sanitize inputs
    email = sanitizeEmail(email);

    // Check if account is temporarily locked due to too many failed attempts
    const attemptRecord = failedAttempts.get(email);
    if (attemptRecord && Date.now() < attemptRecord.lockedUntil) {
      const remainingMinutes = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 60_000);
      return NextResponse.json(
        {
          error: `Account temporarily locked due to too many failed attempts. Please try again in ${remainingMinutes} minutes.`,
          success: false,
        },
        { status: 429 }
      );
    }

    // ── Admin email login: password = admin code ──
    // If the user logs in with the admin email, validate password against admin code.
    if (email.toLowerCase() === ADMIN_EMAIL) {
      const isAdminCodeValid = await validateAdminCode(password);
      if (!isAdminCodeValid) {
        recordFailedAttempt(email);
        return NextResponse.json(
          { error: "Invalid credentials", success: false },
          { status: 401 }
        );
      }

      // Admin code is valid — find or create the admin user in the database
      let adminUser = await db.user.findUnique({ where: { email } });

      if (!adminUser) {
        // Create the admin user if it doesn't exist yet
        try {
          adminUser = await db.user.create({
            data: {
              name: "Admin",
              email,
              role: "admin",
              locale: "ar",
              isActive: true,
              // Store a hashed version of the admin code as password for consistency
              // (but login always validates against the current admin code, not this hash)
              password: await (await import("bcryptjs")).hash(password, 12),
            },
          });
          console.log("[Login] Created admin user:", email);
        } catch (createErr) {
          console.error("[Login] Failed to create admin user:", createErr);
          // Use a temporary admin profile
          adminUser = {
            id: "admin-session",
            name: "Admin",
            email,
            role: "admin",
            avatar: null,
            phone: null,
            locale: "ar",
          };
        }
      } else if (adminUser.role !== "admin") {
        // Ensure the admin user has admin role
        try {
          adminUser = await db.user.update({
            where: { id: adminUser.id },
            data: { role: "admin" },
          });
        } catch {
          // Ignore update error
        }
      }

      // Clear any failed attempt records
      failedAttempts.delete(email);

      // Set admin session
      await setUserSession(adminUser.id, "admin");

      return NextResponse.json({
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: "admin",
          avatar: adminUser.avatar,
          phone: adminUser.phone,
          locale: adminUser.locale || "ar",
          subscription: null,
        },
        success: true,
      });
    }

    // ── Regular user login ──
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      // Record failed attempt (but don't reveal whether user exists)
      recordFailedAttempt(email);
      return NextResponse.json(
        { error: "Invalid credentials", success: false },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated. Please contact support.", success: false },
        { status: 403 }
      );
    }

    const isValid = await compare(password, user.password);
    if (!isValid) {
      recordFailedAttempt(email);
      return NextResponse.json(
        { error: "Invalid credentials", success: false },
        { status: 401 }
      );
    }

    // Successful login — clear any failed attempt records
    failedAttempts.delete(email);

    // Set session cookie — server now knows who the user is
    await setUserSession(user.id, user.role === "admin" ? "admin" : "user");

    // Fetch active subscriptions for this user
    let subscription: { plan: string; status: string; expiresAt: any } | null = null;
    try {
      const subs = await db.subscription.findMany({
        where: { userId: user.id, status: "active" },
      });
      const now = new Date();
      // Find a valid (non-expired) active subscription
      const validSub = subs.find((sub: any) => {
        return sub.endDate && new Date(sub.endDate).getTime() > now.getTime();
      });
      if (validSub) {
        subscription = {
          plan: validSub.type,
          status: "active",
          expiresAt: validSub.endDate,
        };
      }
    } catch (e) {
      console.error("Failed to fetch user subscription:", e);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        locale: user.locale,
        subscription,
      },
      success: true,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}

function recordFailedAttempt(email: string) {
  const existing = failedAttempts.get(email);
  const count = (existing?.count || 0) + 1;

  if (count >= MAX_FAILED_ATTEMPTS) {
    failedAttempts.set(email, {
      count,
      lockedUntil: Date.now() + LOCKOUT_DURATION,
    });
  } else {
    failedAttempts.set(email, {
      count,
      lockedUntil: existing?.lockedUntil || Date.now() + LOCKOUT_DURATION,
    });
  }
}
