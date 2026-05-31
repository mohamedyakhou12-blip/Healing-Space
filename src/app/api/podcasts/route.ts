import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { sanitizeHtml, isUrlSafe } from "@/lib/html-sanitize";
import { REQUEST_LIMITS } from "@/lib/request-limits";
import { notifyGoogleUpdate } from "@/lib/google-notify";
import { cached, invalidateContentCache } from "@/lib/cache";
import { batchReviewStats } from "@/lib/review-stats";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const createPodcastSchema = z.object({
  title: z.string().min(1, "Title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH, "Title is too long"),
  titleAr: z.string().min(1, "Arabic title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleFr: z.string().min(1, "French title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleEn: z.string().min(1, "English title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  description: z.string().min(1, "Description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionAr: z.string().min(1, "Arabic description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionFr: z.string().min(1, "French description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionEn: z.string().min(1, "English description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  audioUrl: z.string().min(1, "Audio URL is required").max(500),
  image: z.string().max(500).optional(),
  duration: z.string().max(50).optional(),
  episode: z.number().int().min(0).max(99999).optional(),
  status: z.enum(["published", "draft"]).default("draft"),
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
      // SECURITY: Non-admin users can only see published content
      const sessionAdminId = await requireAdmin();
      const effectiveStatus = sessionAdminId ? status : (status || "published");
    const cacheKey = `api:podcasts:${effectiveStatus || "all"}:${limit || "all"}`;

    const data = await cached(cacheKey, async () => {
      const podcasts = await db.podcast.findMany({
        include: { _count: true },
      });

      // Batch fetch review stats instead of N+1
      const podcastIds = podcasts.map((p: any) => p.id);
      const reviewStats = await batchReviewStats("podcast", podcastIds);

      const podcastsWithStats = podcasts.map((podcast: any) => {
        const stats = reviewStats.get(podcast.id) || { avgRating: 0, reviewCount: 0 };
        return {
          ...podcast,
          avgRating: stats.avgRating,
          reviewCount: stats.reviewCount,
        };
      });

      return podcastsWithStats;
    }, 30_000);

    // Apply filters after cache
    let result = data;
    if (status) {
      result = result.filter((p: any) => p.status === status);
    }
    if (limit) {
      result = result.slice(0, parseInt(limit, 10));
    }

    return NextResponse.json(
      { podcasts: result },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Fetch podcasts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "podcasts-post");
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
    const parsed = createPodcastSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Validate audio URL safety
    if (parsed.data.audioUrl && !isUrlSafe(parsed.data.audioUrl)) {
      return NextResponse.json(
        { error: "Invalid audio URL" },
        { status: 400 }
      );
    }

    const podcast = await db.podcast.create({
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

    notifyGoogleUpdate("podcasts");
    return NextResponse.json({ podcast }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create podcast error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
