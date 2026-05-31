import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireAuth } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeHtml } from "@/lib/html-sanitize";

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().max(2000).optional(),
  courseId: z.string().max(100).optional(),
  articleId: z.string().max(100).optional(),
  podcastId: z.string().max(100).optional(),
  videoId: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get("contentType");
    const contentId = searchParams.get("contentId");

    // Build where clause for Firebase
    const whereClause: Array<[string, any, any]> = [];

    if (contentType && contentId) {
      const validTypes = ["course", "article", "podcast", "video"];
      if (!validTypes.includes(contentType)) {
        return NextResponse.json(
          { error: `contentType must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }

      const fieldMap: Record<string, string> = {
        course: "courseId",
        article: "articleId",
        podcast: "podcastId",
        video: "videoId",
      };
      whereClause.push([fieldMap[contentType], "==", contentId]);
    }

    const reviews = await db.review.findMany({
      where: whereClause.length > 0 ? whereClause : undefined,
      orderBy: { createdAt: "desc" },
      includeUser: true,
    });

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) /
          reviews.length
        : 0;

    return NextResponse.json({
      reviews,
      avgRating: Math.round(avgRating * 10) / 10,
      total: reviews.length,
    });
  } catch (error) {
    console.error("Fetch reviews error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "reviews-post");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // Require authenticated user — userId comes from session, not client
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { courseId, articleId, podcastId, videoId } = parsed.data;

    if (!courseId && !articleId && !podcastId && !videoId) {
      return NextResponse.json(
        {
          error:
            "A content reference (courseId, articleId, podcastId, or videoId) is required",
        },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check for existing review
    const existingWhere: Record<string, string> = { userId };
    if (courseId) existingWhere.courseId = courseId;
    if (articleId) existingWhere.articleId = articleId;
    if (podcastId) existingWhere.podcastId = podcastId;
    if (videoId) existingWhere.videoId = videoId;

    const existingReview = await db.review.findFirst({
      where: existingWhere,
    });

    if (existingReview) {
      const updated = await db.review.update({
        where: { id: existingReview.id },
        data: {
          rating: parsed.data.rating,
          comment: sanitizeHtml(parsed.data.comment || ""),
        },
        include: { user: true },
      });
      return NextResponse.json({ review: updated });
    }

    const review = await db.review.create({
      data: {
        ...parsed.data,
        comment: sanitizeHtml(parsed.data.comment || ""),
        userId,
      },
      include: { user: true },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Create review error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
