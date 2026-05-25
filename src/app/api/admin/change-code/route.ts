import { NextRequest, NextResponse } from "next/server";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";

// ── Admin email — same as in login route ──
const ADMIN_EMAIL = "admine@gmail.com";

export async function PUT(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "admin-change-code-put");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // Verify admin session first (primary auth)
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    const body = await request.json();
    const { currentCode, newCode } = body;

    if (!currentCode || !newCode) {
      return NextResponse.json({ error: "Both currentCode and newCode are required" }, { status: 400 });
    }
    if (newCode.length < 4) {
      return NextResponse.json({ error: "New code must be at least 4 characters" }, { status: 400 });
    }

    // Validate current code
    const isValid = await validateAdminCode(currentCode);
    if (!isValid) {
      return NextResponse.json({ error: "Current admin code is incorrect" }, { status: 403 });
    }

    // Save new code to database (this also serves as the admin login password)
    try {
      await db.siteSetting.upsert({
        where: { key: "admin_access_code" },
        update: { value: newCode },
        create: { key: "admin_access_code", value: newCode },
      });

      // Verify the save by reading back from DB (targeted query)
      const found = await db.siteSetting.findUnique({
        where: { key: "admin_access_code" },
      });

      if (!found || found.value !== newCode) {
        return NextResponse.json({
          error: "Database save could not be verified",
        }, { status: 500 });
      }
    } catch (err: unknown) {
      console.error("Database save failed:", err);
      return NextResponse.json({
        error: "Database save failed",
      }, { status: 500 });
    }

    // Also update the admin user's password hash in the database
    // so the admin can log in via the regular email/password form
    try {
      const adminUser = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
      if (adminUser) {
        const hashedPassword = await hash(newCode, 12);
        await db.user.update({
          where: { id: adminUser.id },
          data: { password: hashedPassword },
        });
        console.log("[Change Code] Updated admin user password hash for:", ADMIN_EMAIL);
      }
    } catch (pwErr) {
      // Non-critical: the login route validates against admin code directly,
      // not against this hash. This is just for consistency.
      console.warn("[Change Code] Failed to update admin user password hash:", pwErr);
    }

    return NextResponse.json({
      message: "Admin code updated successfully",
    });
  } catch (error: any) {
    console.error("Change admin code error:", error);
    return NextResponse.json({
      error: "Internal server error",
    }, { status: 500 });
  }
}
