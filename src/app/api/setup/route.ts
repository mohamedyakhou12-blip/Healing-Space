import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
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

    // VIS-06: NO default code fallback — the caller must always supply one.
    // (Previously fell back to the public "HEAL2024SPACE" default.)
    if (!requestedCode || typeof requestedCode !== "string" || requestedCode.trim().length < 4) {
      return NextResponse.json(
        { error: "An admin code of at least 4 characters is required", success: false },
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

    // Create the admin_access_code in the database (explicit code only)
    const newCode = requestedCode.trim();

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
    let dbHasCode = false;
    let dbHadError = false;

    try {
      const settings: any[] = await db.siteSetting.findMany();
      dbHasCode = Array.isArray(settings) && settings.some(
        (s: any) => s && s.key === "admin_access_code"
      );
    } catch (err) {
      // VIS-06: never leak internal DB error details to the client.
      dbHadError = true;
      console.error(
        "[Setup] DB check failed:",
        err instanceof Error ? err.message : String(err)
      );
    }

    return NextResponse.json({
      setupComplete: dbHasCode,
      envCodeSet: !!process.env.ADMIN_ACCESS_CODE,
      dbError: dbHadError ? "database unavailable" : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
