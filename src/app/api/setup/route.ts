import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { validateAdminCode } from "@/lib/admin-code";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

/**
 * POST /api/setup
 *
 * One-time setup endpoint to initialize the admin access code in the database.
 * This should only be called once during initial deployment.
 *
 * After the admin_access_code is set in the DB, this endpoint will refuse to
 * overwrite it (use /api/admin/change-code instead).
 *
 * The default code is "HEAL2024SPACE" (defined in admin-code.ts).
 * Change it immediately after first login via Admin Settings.
 */
export async function POST(request: NextRequest) {
  // Security: Disable setup endpoint in production after initial setup
  // In production, admin code should be set via ADMIN_ACCESS_CODE env var
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Setup endpoint is disabled in production. Set ADMIN_ACCESS_CODE env var instead.", success: false },
      { status: 403 }
    );
  }

  // Rate limiting: max 5 setup attempts per 10 minutes
  const rlKey = rateLimitKey(request, "setup");
  if (isRateLimited(rlKey, { max: 5, windowMs: 10 * 60_000 })) {
    return NextResponse.json(
      { error: "Too many setup attempts. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestedCode = body.code;

    // Validate the requested code
    if (requestedCode && (typeof requestedCode !== "string" || requestedCode.trim().length < 4)) {
      return NextResponse.json(
        { error: "Admin code must be at least 4 characters long", success: false },
        { status: 400 }
      );
    }

    // Check if admin_access_code already exists in DB
    try {
      const settings: any[] = await db.siteSetting.findMany();
      const existingCode = Array.isArray(settings)
        ? settings.find((s: any) => s && s.key === "admin_access_code")
        : null;

      if (existingCode) {
        return NextResponse.json({
          success: false,
          message: "Admin code already exists in the database. Use /api/admin/change-code to update it.",
          codeExists: true,
        }, { status: 409 });
      }
    } catch (dbCheckError) {
      console.error("[Setup] Failed to check existing admin code:", dbCheckError);
      // Continue — we'll try to create it anyway
    }

    // Create the admin_access_code in the database
    const newCode = requestedCode?.trim() || "HEAL2024SPACE";

    try {
      await db.siteSetting.upsert({
        where: { key: "admin_access_code" },
        update: { value: newCode },
        create: { key: "admin_access_code", value: newCode },
      });

      // Verify the save
      const settings: any[] = await db.siteSetting.findMany();
      const saved = Array.isArray(settings)
        ? settings.find((s: any) => s && s.key === "admin_access_code")
        : null;

      if (!saved) {
        return NextResponse.json({
          success: false,
          message: "Admin code was saved but could not be verified in the database.",
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Admin access code has been set up successfully.",
        hint: "IMPORTANT: Change the default code immediately after first login via Admin Settings!",
      });
    } catch (dbWriteError) {
      console.error("[Setup] Failed to save admin code:", dbWriteError);
      return NextResponse.json({
        success: false,
        message: "Failed to save admin code to the database. Check Firebase Admin SDK configuration.",
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[Setup] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}

/**
 * GET /api/setup
 *
 * Check if the admin code has been set up in the database.
 * Returns setup status without revealing the actual code.
 */
export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication for setup status
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    let dbHasCode = false;
    let dbError: string | null = null;

    try {
      const settings: any[] = await db.siteSetting.findMany();
      dbHasCode = Array.isArray(settings) && settings.some(
        (s: any) => s && s.key === "admin_access_code"
      );
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json({
      setupComplete: dbHasCode,
      envCodeSet: !!process.env.ADMIN_ACCESS_CODE,
      dbError,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
