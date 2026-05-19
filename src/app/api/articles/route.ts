import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { sanitizeHtml } from "@/lib/html-sanitize";
import { REQUEST_LIMITS } from "@/lib/request-limits";
import { notifyGoogleUpdate } from "@/lib/google-notify";
import { cached, invalidateContentCache } from "@/lib/cache";
import { batchReviewStats } from "@/lib/review-stats";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const createArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH, "Title is too long"),
  titleAr: z.string().min(1, "Arabic title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleFr: z.string().min(1, "French title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleEn: z.string().min(1, "English title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  content: z.string().min(1, "Content is required").max(REQUEST_LIMITS.MAX_CONTENT_LENGTH),
  contentAr: z.string().min(1, "Arabic content is required").max(REQUEST_LIMITS.MAX_CONTENT_LENGTH),
  contentFr: z.string().min(1, "French content is required").max(REQUEST_LIMITS.MAX_CONTENT_LENGTH),
  contentEn: z.string().min(1, "English content is required").max(REQUEST_LIMITS.MAX_CONTENT_LENGTH),
  excerpt: z.string().max(1000).optional(),
  excerptAr: z.string().max(1000).optional(),
  excerptFr: z.string().max(1000).optional(),
  excerptEn: z.string().max(1000).optional(),
  image: z.string().max(500).optional(),
  author: z.string().max(100).optional(),
  status: z.enum(["published", "draft"]).default("draft"),
  isFree: z.boolean().default(false),
  readTime: z.string().max(50).optional(),
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

    const cacheKey = `api:articles:${status || "all"}:${limit || "all"}`;

    const data = await cached(cacheKey, async () => {
      const articles = await db.article.findMany({
        include: { _count: true },
      });

      // Batch fetch review stats instead of N+1
      const articleIds = articles.map((a: any) => a.id);
      const reviewStats = await batchReviewStats("article", articleIds);

      const articlesWithStats = articles.map((article: any) => {
        const stats = reviewStats.get(article.id) || { avgRating: 0, reviewCount: 0 };
        return {
          ...article,
          avgRating: stats.avgRating,
          reviewCount: stats.reviewCount,
        };
      });

      return articlesWithStats;
    }, 30_000);

    // Apply filters (after cache, so cached data serves multiple filter combos)
    let result = data;
    if (status) {
      result = result.filter((a: any) => a.status === status);
    }
    if (limit) {
      result = result.slice(0, parseInt(limit, 10));
    }

    return NextResponse.json(
      { articles: result },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Fetch articles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "articles-post");
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
    const parsed = createArticleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const article = await db.article.create({
      data: {
        ...parsed.data,
        content: sanitizeHtml(parsed.data.content),
        contentAr: sanitizeHtml(parsed.data.contentAr),
        contentFr: sanitizeHtml(parsed.data.contentFr),
        contentEn: sanitizeHtml(parsed.data.contentEn),
        excerpt: parsed.data.excerpt ? sanitizeHtml(parsed.data.excerpt) : undefined,
        excerptAr: parsed.data.excerptAr ? sanitizeHtml(parsed.data.excerptAr) : undefined,
        excerptFr: parsed.data.excerptFr ? sanitizeHtml(parsed.data.excerptFr) : undefined,
        excerptEn: parsed.data.excerptEn ? sanitizeHtml(parsed.data.excerptEn) : undefined,
      },
    });

    // Invalidate cache after content mutation
    invalidateContentCache();

    // Notify Google to re-crawl the articles page
    notifyGoogleUpdate("articles");

    return NextResponse.json({ article }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create article error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
