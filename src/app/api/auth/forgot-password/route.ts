import { NextRequest, NextResponse } from "next/server";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/auth/forgot-password
 *
 * This route is kept for backward compatibility but is no longer used
 * for email-based password reset. The new flow uses birthday verification
 * via /api/auth/reset-password-direct.
 */
export async function POST(request: NextRequest) {
  // Always return success — the actual reset is now done via /api/auth/reset-password-direct
  return NextResponse.json({
    success: true,
    message: "Password reset is now done via birthday verification.",
  });
}
