import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { ALL_CONTENT_TYPES, type ContentType, type ExcludedItem } from "@/lib/content-access";

/**
 * GET /api/user-access
 *
 * Returns the list of content IDs the authenticated user has purchased (approved)
 * plus any active subscription types they have, and the full plan excluded items.
 * Lightweight endpoint for the frontend to check access.
 *
 * SECURITY: userId is derived from the session, NOT from query params.
 */
export async function GET() {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Fetch approved purchases for this user
    const purchases = await db.purchase.findMany({
      where: {
        userId,
        status: "approved",
      },
    });

    const purchasedContentIds = purchases.map((p: any) => p.contentId);

    // Fetch active subscriptions for this user
    const subscriptions = await db.subscription.findMany({
      where: {
        userId,
        status: "active",
      },
    });

    const activeSubscriptionTypes: string[] = [];
    for (const sub of subscriptions) {
      // SECURITY: Subscription MUST have endDate AND it must be in the future
      // Missing endDate = expired (not never-expiring)
      if (sub.endDate && new Date(sub.endDate) > new Date()) {
        activeSubscriptionTypes.push(sub.type);
      }
    }

    // Read full_plan_includes setting
    let fullPlanIncludes: ContentType[] = ALL_CONTENT_TYPES;
    const allSettings = await db.siteSetting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) {
      settingsMap[s.key] = s.value;
    }
    const fullPlanSetting = settingsMap["full_plan_includes"];
    if (fullPlanSetting) {
      try {
        const parsed = JSON.parse(fullPlanSetting);
        if (Array.isArray(parsed) && parsed.length > 0) {
          fullPlanIncludes = parsed.filter((t: string) => ALL_CONTENT_TYPES.includes(t as ContentType));
        }
      } catch {
        // Invalid JSON, use default
      }
    }

    // Read full_plan_excluded_items setting (per-item exclusions)
    let fullPlanExcludedItems: ExcludedItem[] = [];
    const excludedSetting = settingsMap["full_plan_excluded_items"];
    if (excludedSetting) {
      try {
        const parsed = JSON.parse(excludedSetting);
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

    return NextResponse.json({
      purchasedContentIds,
      activeSubscriptionTypes,
      fullPlanIncludes,
      fullPlanExcludedItems,
    });
  } catch (error) {
    console.error("Fetch user access error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
