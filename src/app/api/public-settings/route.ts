import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cached } from "@/lib/cache";

/**
 * GET /api/public-settings
 *
 * Returns only non-sensitive site settings for public consumption.
 * SECURITY: Uses an ALLOW-LIST approach — only explicitly approved keys
 * are returned. Any new setting is hidden by default until added to the
 * allow list, preventing accidental data exposure.
 */

// Keys that are SAFE to expose to the public (allow-list approach)
const PUBLIC_KEYS = new Set([
  "site_name",
  "site_name_ar",
  "site_name_fr",
  "site_description",
  "site_description_ar",
  "site_description_fr",
  "hero_title",
  "hero_title_ar",
  "hero_title_fr",
  "hero_subtitle",
  "hero_subtitle_ar",
  "hero_subtitle_fr",
  "hero_image",
  "individualPurchasesEnabled",
  // All subscription prices are public — shown on pricing page
  "subscription_price_full",
  "subscription_price_courses",
  "subscription_price_articles",
  "subscription_price_podcasts",
  "subscription_price_videos",
  "subscription_price_pdfs",
  "subscription_price_live",
  "subscription_price_coaching",
  // CCP payment info — needed on payment page for all users
  "ccpNumber",
  "ccpHolderName",
  "ccpWilaya",
  // Social links
  "whatsapp_number",
  "whatsapp_link",
  "facebook_link",
  "instagram_link",
  "youtube_link",
  "tiktok_link",
  // Full plan config — needed for content access checks on client
  "full_plan_includes",
  "full_plan_excluded_items",
]);

export async function GET() {
  try {
    const settingsMap = await cached("api:public-settings", async () => {
      const settings = await db.siteSetting.findMany({
        orderBy: { key: "asc" },
      });
      const map: Record<string, string> = {};
      for (const setting of settings) {
        // SECURITY: Only include explicitly allowed keys
        if (!PUBLIC_KEYS.has(setting.key)) continue;
        map[setting.key] = setting.value;
      }
      return map;
    }, 60_000); // Settings change rarely, cache for 60s

    return NextResponse.json(
      { settings: settingsMap },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ settings: {} }, { status: 200 });
  }
}
