import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const markReadSchema = z.object({
  ids: z.array(z.string().min(1).max(100)).min(1).max(100),
});

const createNotificationSchema = z.object({
  userId: z.string().min(1, "User ID is required").max(100),
  title: z.string().min(1, "Title is required").max(200),
  titleAr: z.string().min(1, "Arabic title is required").max(200),
  titleFr: z.string().min(1, "French title is required").max(200),
  titleEn: z.string().min(1, "English title is required").max(200),
  message: z.string().min(1, "Message is required").max(5000),
  messageAr: z.string().min(1, "Arabic message is required").max(5000),
  messageFr: z.string().min(1, "French message is required").max(5000),
  messageEn: z.string().min(1, "English message is required").max(5000),
  type: z.enum(["info", "success", "warning", "payment"]).default("info"),
  link: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    // Use session to determine identity — no userId from client
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";

    const whereClause: Record<string, any> = { userId };
    if (unreadOnly) whereClause.isRead = false;

    const notifications = await db.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    // Count unread notifications
    const unreadCount = await db.notification.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "notifications-put");
  if (isRateLimited(rlKey, { max: 20, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // User must be authenticated to mark notifications as read
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = markReadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { ids } = parsed.data;

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one notification ID" },
        { status: 400 }
      );
    }

    const result = await db.notification.updateMany({
      where: { id: { in: ids }, userId },  // Security: only mark own notifications (IDOR fix)
      data: { isRead: true },
    });

    return NextResponse.json({
      message: `${result.count} notifications marked as read`,
      count: result.count,
    });
  } catch (error) {
    console.error("Mark notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "notifications-post");
  if (isRateLimited(rlKey, { max: 20, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // Admin-only: creating notifications requires admin session
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Admin access required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createNotificationSchema.safeParse(body);

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

    const notification = await db.notification.create({
      data: parsed.data,
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error("Create notification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
