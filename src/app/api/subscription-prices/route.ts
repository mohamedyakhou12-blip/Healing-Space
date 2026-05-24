import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ALL_CONTENT_TYPES, type ContentType, type ExcludedItem } from "@/lib/content-access";

// Default subscription prices (DA)
const DEFAULT_PRICES: Record<string, number> = {
  full: 2000,
  courses: 500,
  articles: 500,
  podcasts: 500,
  videos: 500,
  pdfs: 500,
  live: 500,
  coaching: 500,
};

// GET /api/subscription-prices — Public endpoint to fetch subscription prices
export async function GET() {
  try {
    const settings = await db.siteSetting.findMany({
      orderBy: { key: "asc" },
    });

    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    // Read prices from settings, fall back to defaults
    const prices: Record<string, number> = {};
    for (const [plan, defaultPrice] of Object.entries(DEFAULT_PRICES)) {
      const key = `subscription_price_${plan}`;
      const storedValue = settingsMap[key];
      prices[plan] = storedValue ? parseInt(storedValue, 10) : defaultPrice;
    }

    // Read full_plan_includes setting
    let fullPlanIncludes: ContentType[] = ALL_CONTENT_TYPES;
    const storedIncludes = settingsMap["full_plan_includes"];
    if (storedIncludes) {
      try {
        const parsed = JSON.parse(storedIncludes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          fullPlanIncludes = parsed.filter((t: string) => ALL_CONTENT_TYPES.includes(t as ContentType));
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    // Read full_plan_excluded_items setting (per-item exclusions)
    let fullPlanExcludedItems: ExcludedItem[] = [];
    const storedExcluded = settingsMap["full_plan_excluded_items"];
    if (storedExcluded) {
      try {
        const parsed = JSON.parse(storedExcluded);
        if (Array.isArray(parsed)) {
          fullPlanExcludedItems = parsed.filter(
            (item: { id?: string; type?: string }) =>
              item.id && item.type && ALL_CONTENT_TYPES.includes(item.type as ContentType)
          );
        }
      } catch {
        // Invalid JSON, use empty array
      }
    }

    return NextResponse.json({ prices, fullPlanIncludes, fullPlanExcludedItems });
  } catch (error) {
    console.error("Fetch subscription prices error:", error);
    // Return defaults on error
    return NextResponse.json({ prices: DEFAULT_PRICES, fullPlanIncludes: ALL_CONTENT_TYPES, fullPlanExcludedItems: [] });
  }
}
