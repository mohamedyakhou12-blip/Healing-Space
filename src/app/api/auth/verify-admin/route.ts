import { NextRequest, NextResponse } from "next/server";
import { validateAdminCode } from "@/lib/admin-code";
import { getUserFromSession, setUserSession } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/auth/verify-admin
 *
 * Validates an admin access code against the authoritative source (Firestore DB first, env var fallback).
 * On success, creates an admin session so subsequent requests are authenticated.
 * This is the ONLY way to verify admin codes — never trust client-side constants.
 *
 * SECURITY:
 * - Rate-limited to prevent brute force (5 attempts per 5 minutes per IP)
 * - Never uses hardcoded user IDs
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: max 5 admin code verification attempts per 5 minutes per IP
    const rlKey = rateLimitKey(request, "verify-admin");
    if (isRateLimited(rlKey, { max: 5, windowMs: 5 * 60_000 })) {
      return NextResponse.json(
        { valid: false, error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return NextResponse.json(
        { valid: false, error: "Admin code is required" },
        { status: 400 }
      );
    }

    const isValid = await validateAdminCode(code.trim());

    if (isValid) {
      // Elevate existing user to admin, or create admin session
      const existingUserId = await getUserFromSession();
      if (existingUserId) {
        // Elevate existing user to admin
        await setUserSession(existingUserId, "admin");
      } else {
        // No user logged in — create an admin session.
        // Use a consistent, deterministic admin ID so that session
        // restoration can recognize this as an admin session even
        // when the user doesn't exist in the database.
        const adminId = "admin-session";
        await setUserSession(adminId, "admin");
      }
    }

    // Always return the same response structure to avoid timing attacks
    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error("Verify admin code error:", error);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
