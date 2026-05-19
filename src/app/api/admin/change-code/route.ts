import { NextRequest, NextResponse } from "next/server";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

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

    // Save new code to database
    try {
      const { db } = await import("@/lib/db");
      await db.siteSetting.upsert({
        where: { key: "admin_access_code" },
        update: { value: newCode },
        create: { key: "admin_access_code", value: newCode },
      });

      // Verify the save by reading back from DB
      const settings: any[] = await db.siteSetting.findMany();
      const found = Array.isArray(settings)
        ? settings.find((s: any) => s && s.key === "admin_access_code" && s.value === newCode)
        : null;

      if (!found) {
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
