import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
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

  // 1. Rule out a fully signed-in admin session (dashboard) — they may change
  //    the code without re-entering the stored value, since the session itself
  //    is already authenticated.
  const sessionAdminId = await requireAdmin();
  if (sessionAdminId) {
    const body = await request.json();
    const { newCode } = body;
    return changeCode(newCode);
  }

  // 2. Otherwise fall back to code-based auth and require the current code.
  const isAuthorized = await verifyAdminAccess(request);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });
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

  return changeCode(newCode);
}

/**
 * Persist the new admin code to Firestore (siteSettings.admin_access_code)
 * and verify the write by reading it back.
 */
async function changeCode(newCode: string) {
  try {
    const { db } = await import("@/lib/db");
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

  return NextResponse.json({
    message: "Admin code updated successfully",
  });
}
