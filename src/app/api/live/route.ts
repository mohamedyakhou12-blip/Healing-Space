import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { sanitizeHtml, isUrlSafe } from "@/lib/html-sanitize";
import { REQUEST_LIMITS } from "@/lib/request-limits";
import { notifyGoogleUpdate } from "@/lib/google-notify";
import { cached, invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const createLiveSessionSchema = z.object({
  title: z.string().min(1, "Title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH, "Title is too long"),
  titleAr: z.string().min(1, "Arabic title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleFr: z.string().min(1, "French title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleEn: z.string().min(1, "English title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  description: z.string().min(1, "Description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionAr: z.string().min(1, "Arabic description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionFr: z.string().min(1, "French description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionEn: z.string().min(1, "English description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  streamUrl: z.string().max(500).optional(),
  zoomUrl: z.string().max(500).optional(),
  image: z.string().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(["live", "upcoming", "ended"]).default("upcoming"),
  duration: z.string().max(50).optional(),
  isFree: z.boolean().default(false),
  price: z.number().min(REQUEST_LIMITS.MIN_PRICE).max(REQUEST_LIMITS.MAX_PRICE).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    let status = url.searchParams.get("status");

    // Security: Only admins can view draft content
    if (status && status !== "published") {
      const adminId = await requireAdmin();
      if (!adminId) status = "published";
    }
    const cacheKey = `api:live:${status || "all"}:${limit || "all"}`;

    const data = await cached(cacheKey, async () => {
      return await db.liveSession.findMany();
    }, 30_000);

    // Apply filters after cache
    let result = data;
    if (status) {
      result = result.filter((s: any) => s.status === status);
    }
    if (limit) {
      result = result.slice(0, parseInt(limit, 10));
    }

    return NextResponse.json(
      { liveSessions: result },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Fetch live sessions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "live-post");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // SECURITY: Double-check admin access (session + admin code)
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createLiveSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Validate stream/zoom URL safety
    if (parsed.data.streamUrl && !isUrlSafe(parsed.data.streamUrl)) {
      return NextResponse.json(
        { error: "Invalid stream URL" },
        { status: 400 }
      );
    }
    if (parsed.data.zoomUrl && !isUrlSafe(parsed.data.zoomUrl)) {
      return NextResponse.json(
        { error: "Invalid zoom URL" },
        { status: 400 }
      );
    }

    const liveSession = await db.liveSession.create({
      data: {
        ...parsed.data,
        description: sanitizeHtml(parsed.data.description),
        descriptionAr: sanitizeHtml(parsed.data.descriptionAr),
        descriptionFr: sanitizeHtml(parsed.data.descriptionFr),
        descriptionEn: sanitizeHtml(parsed.data.descriptionEn),
      },
    });

    // Invalidate cache after content mutation
    invalidateContentCache();

    notifyGoogleUpdate("live");
    return NextResponse.json({ liveSession }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create live session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
