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

    // ── Admin account protection ──
    // The reserved admin account must NEVER be resettable through the public
    // birthday flow. The admin credential is controlled solely by the owner
    // via ADMIN_PASSWORD (env var) / the admin dashboard.
    if (isReservedAdminEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email or birthday. Please check your information and try again.", success: false },
        { status: 400 }
      );
    }

    // Look up user by email
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal whether email exists — use generic message
      return NextResponse.json(
        { error: "Invalid email or birthday. Please check your information and try again.", success: false },
        { status: 400 }
      );
    }

    // Verify birthday — a stored birthday is REQUIRED. Never accept any date
    // just because the user has none on file, otherwise anyone could reset
    // any account (including an admin-role user) by typing an arbitrary date.
    const storedBirthday = user.birthday;
    if (!storedBirthday) {
      return NextResponse.json(
        { error: "Invalid email or birthday. Please check your information and try again.", success: false },
        { status: 400 }
      );
    }
    if (storedBirthday !== birthday) {
      // Do not leak whether the birthday matches or not
      return NextResponse.json(
        { error: "Invalid email or birthday. Please check your information and try again.", success: false },
        { status: 400 }
      );
    }

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
