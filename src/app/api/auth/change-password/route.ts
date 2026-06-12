import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { hash, compare } from "bcryptjs";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/session";

/**
 * POST /api/auth/change-password
 *
 * Change password for an authenticated user.
 * Requires current password + new password.
 * Updates both Firestore bcryptjs hash AND Firebase Auth password.
 */
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required", success: false },
        { status: 401 }
      );
    }

    // Rate limiting: max 5 change attempts per minute per IP
    const rlKey = rateLimitKey(request, "change-password");
    if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", success: false },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Validation failed";
      let translatedError = firstError;
      if (firstError.includes("at least 8")) translatedError = "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
      else if (firstError.includes("uppercase")) translatedError = "كلمة المرور يجب أن تحتوي على حرف كبير";
      else if (firstError.includes("lowercase")) translatedError = "كلمة المرور يجب أن تحتوي على حرف صغير";
      else if (firstError.includes("number")) translatedError = "كلمة المرور يجب أن تحتوي على رقم";
      else if (firstError.includes("Current password")) translatedError = "كلمة المرور الحالية مطلوبة";

      return NextResponse.json(
        { error: translatedError, success: false },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    // Find user in Firestore
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: "User not found", success: false },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Current password is incorrect", success: false },
        { status: 401 }
      );
    }

    // Check new password is different from current
    const isSamePassword = await compare(newPassword, user.password);
    if (isSamePassword) {
      return NextResponse.json(
        { error: "New password must be different from current password", success: false },
        { status: 400 }
      );
    }

    // Hash and save new password
    const hashedPassword = await hash(newPassword, 12);
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Also update Firebase Auth password
    try {
      const { adminAuth, firebaseReady } = await import("@/lib/firebase-admin");
      if (firebaseReady && adminAuth && user.email) {
        try {
          const firebaseUser = await adminAuth.getUserByEmail(user.email);
          await adminAuth.updateUser(firebaseUser.uid, { password: newPassword });
        } catch {
          // User might not exist in Firebase Auth — that's OK
        }
      }
    } catch {
      // Firebase Admin not available — continue
    }

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}
