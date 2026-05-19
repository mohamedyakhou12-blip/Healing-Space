import { NextResponse } from "next/server";
import { getFirebaseStatus } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";

/**
 * GET /api/auth/firebase-status
 *
 * Admin-only endpoint to check Firebase configuration status.
 * Helps diagnose Google sign-in issues.
 */
export async function GET() {
  try {
    // Require admin session
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 401 }
      );
    }

    const status = getFirebaseStatus();
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "not configured";
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "not configured";
    const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "not configured";
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "not configured";
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "not configured";

    // Mask API key for security (show first 10 and last 4 chars)
    const maskedApiKey = apiKey.length > 14
      ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`
      : "too short";

    // Check for common issues
    const issues: string[] = [];

    if (!status.ready) {
      issues.push("Firebase Admin SDK is NOT properly initialized — Google token verification will fail (503 error)");
      issues.push("Ensure FIREBASE_SERVICE_ACCOUNT_KEY env var is set correctly in Vercel");
    }

    if (apiKey === "not configured" || apiKey === "") {
      issues.push("NEXT_PUBLIC_FIREBASE_API_KEY is missing — Google sign-in will show network error");
    }

    // Check if the API key appears to be from the old suspended project
    if (apiKey.includes("9fbde") || apiKey === "AIzaSyDWRdDBZ2HkLybd__7XKZo79rbGJnn97v8") {
      issues.push(`API key belongs to the SUSPENDED project (healing-space-9fbde): ${maskedApiKey}. Must be replaced with the new project key.`);
    }

    if (authDomain === "not configured") {
      issues.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is missing");
    }

    return NextResponse.json({
      adminSDK: status,
      clientConfig: {
        apiKey: maskedApiKey,
        authDomain,
        databaseURL: databaseURL === "not configured" ? null : databaseURL,
        projectId,
        storageBucket,
      },
      issues,
      instructions: {
        ar: [
          "إذا ظهر خطأ 'خطأ في الشبكة': تأكد أن مفتاح API صحيح وغير معلق من Google",
          "إذا ظهر خطأ 'النطاق غير مصرح': أضف نطاق موقعك في Firebase Console → Authentication → Settings → Authorized domains",
          "أضف النطاق: healing-space-henna.vercel.app",
          "تأكد أن Google sign-in مفعّل في Firebase Console → Authentication → Sign-in method",
        ],
        en: [
          "If 'Network error': Ensure API key is valid and not suspended by Google",
          "If 'Unauthorized domain': Add your domain in Firebase Console → Authentication → Settings → Authorized domains",
          "Add domain: healing-space-henna.vercel.app",
          "Ensure Google sign-in is enabled in Firebase Console → Authentication → Sign-in method",
        ],
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
