import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { hash } from "bcryptjs";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/auth/reset-password
 *
 * Resets the user's password after they've verified their identity
 * through Firebase's password reset email flow.
 *
 * SECURITY: Requires a valid Firebase ID token from a user who just
 * completed the password reset flow. This prevents unauthorized password changes.
 *
 * Flow:
 *  1. User clicks Firebase reset link → resets password in Firebase UI
 *  2. Firebase updates the password on their end
 *  3. User comes back to our app and logs in with new password via Firebase
 *  4. We get the idToken from the successful Firebase login
 *  5. We verify the idToken server-side and sync the new bcryptjs hash to Firestore
 */
const resetSchema = z.object({
  idToken: z.string().min(1, "Authentication token is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: max 5 reset attempts per minute per IP
    const rlKey = rateLimitKey(request, "reset-password");
    if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", success: false },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Validation failed";
      let translatedError = firstError;
      if (firstError.includes("at least 8")) translatedError = "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
      else if (firstError.includes("uppercase")) translatedError = "كلمة المرور يجب أن تحتوي على حرف كبير";
      else if (firstError.includes("lowercase")) translatedError = "كلمة المرور يجب أن تحتوي على حرف صغير";
      else if (firstError.includes("number")) translatedError = "كلمة المرور يجب أن تحتوي على رقم";
      else if (firstError.includes("token")) translatedError = "رمز المصادقة مطلوب";

      return NextResponse.json(
        { error: translatedError, success: false },
        { status: 400 }
      );
    }

    const { idToken, newPassword } = parsed.data;

    // Verify the Firebase ID token to ensure the user actually authenticated
    let verifiedEmail: string | null = null;
    try {
      const { adminAuth, firebaseReady } = await import("@/lib/firebase-admin");
      if (!firebaseReady || !adminAuth) {
        return NextResponse.json(
          { error: "Authentication service unavailable. Please try again later.", success: false },
          { status: 503 }
        );
      }
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      verifiedEmail = decodedToken.email || null;
    } catch (error) {
      console.error("[Reset Password] Invalid ID token:", error);
      return NextResponse.json(
        { error: "Invalid or expired authentication token. Please log in again.", success: false },
        { status: 401 }
      );
    }

    if (!verifiedEmail) {
      return NextResponse.json(
        { error: "Could not verify email address. Please try again.", success: false },
        { status: 400 }
      );
    }

    // Find user in Firestore by the VERIFIED email
    const user = await db.user.findUnique({ where: { email: verifiedEmail } });
    if (!user) {
      // Don't reveal user existence
      return NextResponse.json(
        { error: "Password reset failed. Please contact support.", success: false },
        { status: 400 }
      );
    }

    // Hash the new password and update in Firestore
    const hashedPassword = await hash(newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Also update Firebase Auth password if possible
    try {
      const { adminAuth, firebaseReady } = await import("@/lib/firebase-admin");
      if (firebaseReady && adminAuth) {
        try {
          const firebaseUser = await adminAuth.getUserByEmail(verifiedEmail);
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
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}
