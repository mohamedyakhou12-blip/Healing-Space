import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeEmail } from "@/lib/sanitize";
import { z } from "zod";

/**
 * POST /api/auth/check-email
 *
 * Checks if an email is registered in the system.
 * Returns { exists: true } or { exists: false }.
 * Used by the forgot-password flow to determine the next step.
 */
const schema = z.object({
  email: z.string().email("Invalid email format"),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rlKey = rateLimitKey(request, "check-email");
    if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many requests", success: false },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email", success: false },
        { status: 400 }
      );
    }

    const email = sanitizeEmail(parsed.data.email);

    // Always return success to prevent email enumeration
    // The actual verification happens in the reset-password-direct endpoint
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Check email error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}
