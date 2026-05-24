import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { z } from "zod";
import { notifyGoogleUpdate } from "@/lib/google-notify";
import { invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

// Whitelist of allowed setting keys — prevents overwriting sensitive keys like admin_access_code
const ALLOWED_SETTINGS_KEYS = [
  "heroTitle", "heroSubtitle", "heroDescription", "siteOwnerNameSetting",
  "ctaButton1", "ctaButton2", "introVideoUrl", "sectionVisibility",
  "ccpNumber", "ccpHolderName", "ccpWilaya",
  "individualPurchasesEnabled", "siteName", "siteDescription",
  "contactEmail", "contactPhone", "socialFacebook", "socialInstagram",
  "socialYoutube", "socialTwitter", "socialTikTok",
  "ogImage", "ogTitle", "ogDescription",
  "maintenanceMode", "registrationEnabled",
  // Subscription prices (subscription_price_full, subscription_price_courses, etc.)
  "subscription_price_full", "subscription_price_courses", "subscription_price_articles",
  "subscription_price_podcasts", "subscription_price_videos", "subscription_price_pdfs",
  "subscription_price_live",
  // Full plan content type includes & per-item exclusions
  "full_plan_includes", "full_plan_excluded_items",
];

// Keys that must NEVER be written through this endpoint
const BLOCKED_SETTINGS_KEYS = [
  "admin_access_code", "session_secret", "firebase_config",
];

export async function GET(request: NextRequest) {
  try {
    // Verify admin session first (primary auth)
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    // Secondary check: admin code header
    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }
    const settings = await db.siteSetting.findMany({
      orderBy: { key: "asc" },
    });

    // Convert to key-value object
    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error("Fetch settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "admin-settings-put");
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

    // Secondary check: admin code header
    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { settings } = parsed.data;

    // ── Security: Validate setting keys ──
    // Block sensitive keys that must never be written through this endpoint
    const blockedKeys = Object.keys(settings).filter(k => BLOCKED_SETTINGS_KEYS.includes(k));
    if (blockedKeys.length > 0) {
      return NextResponse.json(
        { error: `Cannot modify restricted settings: ${blockedKeys.join(", ")}. Use the dedicated admin code change endpoint.` },
        { status: 403 }
      );
    }

    // Filter to only allowed keys (ignore unknown keys silently for forward compatibility)
    const filteredEntries = Object.entries(settings).filter(([key]) => ALLOWED_SETTINGS_KEYS.includes(key));

    if (filteredEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid settings provided" },
        { status: 400 }
      );
    }

    // Upsert each setting
    await Promise.all(
      filteredEntries.map(([key, value]) =>
        db.siteSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );

    notifyGoogleUpdate("settings");
    invalidateContentCache();
    return NextResponse.json({
      message: "Settings updated successfully",
      count: filteredEntries.length,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
