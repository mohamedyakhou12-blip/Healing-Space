import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const createSubscriptionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  type: z.enum([
    "full",
    "courses",
    "articles",
    "podcasts",
    "videos",
    "pdfs",
    "live",
  ]),
  status: z.enum(["active", "expired", "cancelled"]).default("active"),
  endDate: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    // Use session to determine identity
    const adminId = await requireAdmin();
    const userId = await requireAuth();

    if (adminId) {
      // Admin: can query any user's subscriptions via ?userId=xxx
      const { searchParams } = new URL(request.url);
      const targetUserId = searchParams.get("userId");
      const whereUserId = targetUserId || adminId;

      const subscriptions = await db.subscription.findMany({
        where: { userId: whereUserId },
      });

      const now = new Date();
      const validSubscriptions = subscriptions.filter(
        (sub: { endDate?: string }) => sub.endDate && new Date(sub.endDate) > now
      );

      return NextResponse.json(
        { subscriptions: validSubscriptions },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    }

    if (userId) {
      // Regular user: return only their own subscriptions
      const subscriptions = await db.subscription.findMany({
        where: { userId },
      });

      // Server-side filter: only return subscriptions that are not expired
      // SECURITY: Missing endDate = expired (not never-expiring)
      const now = new Date();
      const validSubscriptions = subscriptions.filter(
        (sub: { endDate?: string }) => sub.endDate && new Date(sub.endDate) > now
      );

      return NextResponse.json(
        { subscriptions: validSubscriptions },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    }

    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Fetch subscriptions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "subscriptions-post");
  if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // Admin-only: manual subscription creation requires admin session
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Admin access required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: parsed.data.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    let endDate: Date;

    if (parsed.data.endDate) {
      endDate = new Date(parsed.data.endDate);
      // Validate: endDate must be in the future and not more than 1 year
      if (endDate <= now) {
        return NextResponse.json(
          { error: "End date must be in the future" },
          { status: 400 }
        );
      }
      const maxDate = new Date(now);
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      if (endDate > maxDate) {
        return NextResponse.json(
          { error: "End date cannot be more than 1 year in the future" },
          { status: 400 }
        );
      }
    } else {
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30); // Exactly 30 days
    }

    const subscription = await db.subscription.create({
      data: {
        userId: parsed.data.userId,
        type: parsed.data.type,
        status: parsed.data.status,
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
      },
    });

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    console.error("Create subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/subscriptions — Admin: delete a subscription by ID
export async function DELETE(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "subscriptions-delete");
  if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // Admin-only: deleting subscriptions requires admin session
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Admin access required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get("id");

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID is required" },
        { status: 400 }
      );
    }

    await db.subscription.delete({ where: { id: subscriptionId } });

    return NextResponse.json({ success: true, message: "Subscription deleted" });
  } catch (error) {
    console.error("Delete subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
