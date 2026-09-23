import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { hash } from "bcryptjs";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeEmail } from "@/lib/sanitize";
import { isReservedAdminEmail } from "@/lib/admin-email";

/**
 * POST /api/auth/reset-password-direct
 *
 * Birthday-based password reset — no email required.
 *
 * Flow:
 *  1. User provides { email, birthday, newPassword }
 *  2. Server looks up user by email in Firestore
 *  3. Verifies birthday matches
 *  4. Updates password (bcrypt hash in Firestore + Firebase Auth if user exists there)
 *  5. Returns success
 */

const resetSchema = z.object({
  email: z.string().email("Invalid email format"),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid birthday format"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

// ── Per-account brute-force lockout (VIS-05) ──
// The birthday-only reset flow is guessable (small date space), and the
// per-IP limiter above can be rotated. Track failed attempts per ACCOUNT so
// birthday brute-force against one user is locked out server-side.
// Same in-memory/per-instance trade-off as lib/rate-limit.ts.
const ACCOUNT_MAX_FAILED_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
type ResetAttemptEntry = { count: number; lockedUntil: number; lastFailedAt: number };
const resetAttempts = new Map<string, ResetAttemptEntry>();
let lastResetPrune = 0;

function pruneResetAttempts(): void {
  const now = Date.now();
  if (now - lastResetPrune < 60_000) return;
  lastResetPrune = now;
  for (const [key, entry] of resetAttempts) {
    if (now - entry.lastFailedAt > ACCOUNT_LOCKOUT_MS) resetAttempts.delete(key);
  }
}

function resetLockRemainingMs(email: string): number {
  pruneResetAttempts();
  const entry = resetAttempts.get(email);
  if (!entry || entry.count < ACCOUNT_MAX_FAILED_ATTEMPTS) return 0;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) {
    resetAttempts.delete(email);
    return 0;
  }
  return remaining;
}

function recordResetFailure(email: string): void {
  const now = Date.now();
  const entry = resetAttempts.get(email) || { count: 0, lockedUntil: 0, lastFailedAt: now };
  entry.count += 1;
  entry.lastFailedAt = now;
  if (entry.count >= ACCOUNT_MAX_FAILED_ATTEMPTS) entry.lockedUntil = now + ACCOUNT_LOCKOUT_MS;
  resetAttempts.set(email, entry);
}

function genericResetError(): NextResponse {
  return NextResponse.json(
    { error: "Invalid email or birthday. Please check your information and try again.", success: false },
    { status: 400 }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: max 5 reset requests per minute per IP
    const rlKey = rateLimitKey(request, "reset-password-direct");
    if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", success: false },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed", success: false },
        { status: 400 }
      );
    }

    const { email: rawEmail, birthday, newPassword } = parsed.data;
    const email = sanitizeEmail(rawEmail);

    // ── Per-account lockout (VIS-05) — blocks birthday brute-force ──
    const lockRemaining = resetLockRemainingMs(email);
    if (lockRemaining > 0) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", success: false },
        { status: 429 }
      );
    }

    // ── Admin account protection ──
    // The reserved admin account must NEVER be resettable through the public
    // birthday flow. The admin credential is controlled solely by the owner
    // via ADMIN_PASSWORD (env var) / the admin dashboard.
    if (isReservedAdminEmail(email)) {
      recordResetFailure(email);
      return genericResetError();
    }

    // Look up user by email
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal whether email exists — use generic message
      recordResetFailure(email);
      return genericResetError();
    }

    // Verify birthday — a stored birthday is REQUIRED. Never accept any date
    // just because the user has none on file, otherwise anyone could reset
    // any account (including an admin-role user) by typing an arbitrary date.
    const storedBirthday = user.birthday;
    if (!storedBirthday) {
      recordResetFailure(email);
      return genericResetError();
    }
    if (storedBirthday !== birthday) {
      // Do not leak whether the birthday matches or not
      recordResetFailure(email);
      return genericResetError();
    }

    // Success — clear this account's failed-attempt state
    resetAttempts.delete(email);

    // Update password in Firestore (bcrypt hash)
    const hashedPassword = await hash(newPassword, 12);
    const updateData: Record<string, unknown> = { password: hashedPassword };
    await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Also try to update in Firebase Auth if the user exists there
    try {
      const { adminAuth, firebaseReady } = await import("@/lib/firebase-admin");
      if (firebaseReady && adminAuth) {
        try {
          const firebaseUser = await adminAuth.getUserByEmail(email);
          await adminAuth.updateUser(firebaseUser.uid, { password: newPassword });
          console.log(`[ResetPasswordDirect] Updated Firebase Auth password for: ${email}`);
        } catch {
          // User doesn't exist in Firebase Auth — that's fine, Firestore is the source of truth
          console.log(`[ResetPasswordDirect] User not found in Firebase Auth (non-critical): ${email}`);
        }
      }
    } catch {
      // Firebase Admin not available — continue
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Direct password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}
