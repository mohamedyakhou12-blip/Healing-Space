import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const VALID_CONTENT_TYPES = [
  "course",
  "article",
  "podcast",
  "video",
  "pdf",
  "live",
  "coaching",
] as const;

type ContentType = (typeof VALID_CONTENT_TYPES)[number];

function isContentType(value: string): value is ContentType {
  return (VALID_CONTENT_TYPES as readonly string[]).includes(value);
}

const updatePriceSchema = z.object({
  contentType: z.string().min(1, "contentType is required"),
  itemId: z.string().min(1, "itemId is required").max(100),
  price: z.number().min(0).max(1000000).nullable().optional(),
});

// GET /api/prices — Fetch all content items with their prices
export async function GET() {
  try {
    const [courses, articles, podcasts, videos, pdfs, liveSessions, coachings] =
      await Promise.all([
        db.course.findMany({
          include: { _count: false, chapters: false },
        }),
        db.article.findMany({ include: { _count: false } }),
        db.podcast.findMany({ include: { _count: false } }),
        db.video.findMany({ include: { _count: false } }),
        db.pdfResource.findMany(),
        db.liveSession.findMany(),
        db.coaching.findMany(),
      ]);

    // Normalize to flat price items
    const normalize = (item: any, type: string) => ({
      id: item.id,
      title: { ar: item.titleAr, fr: item.titleFr, en: item.titleEn },
      price: item.price ?? null,
      isFree: item.isFree ?? false,
      imageUrl: item.image ?? item.thumbnail ?? null,
      type,
    });

    return NextResponse.json({
      courses: courses.map((c: any) => normalize(c, "course")),
      articles: articles.map((a: any) => normalize(a, "article")),
      podcasts: podcasts.map((p: any) => normalize(p, "podcast")),
      videos: videos.map((v: any) => normalize(v, "video")),
      pdfs: pdfs.map((p: any) => normalize(p, "pdf")),
      liveSessions: liveSessions.map((l: any) => normalize(l, "live")),
      coachings: coachings.map((c: any) => normalize(c, "coaching")),
    });
  } catch (error) {
    console.error("Fetch prices error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/prices — Update the price of a specific content item
export async function PUT(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "prices-put");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
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
    const parsed = updatePriceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { contentType, itemId, price } = parsed.data;

    if (!contentType || !itemId) {
      return NextResponse.json(
        { error: "Missing required fields: contentType and itemId" },
        { status: 400 }
      );
    }

    if (!isContentType(contentType)) {
      return NextResponse.json(
        {
          error: `Invalid contentType. Must be one of: ${VALID_CONTENT_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const collectionMap: Record<string, any> = {
      course: db.course,
      article: db.article,
      podcast: db.podcast,
      video: db.video,
      pdf: db.pdfResource,
      live: db.liveSession,
      coaching: db.coaching,
    };

    const model = collectionMap[contentType];
    if (model && model.update) {
      await model.update({ where: { id: itemId }, data: { price } });
    }

    return NextResponse.json({
      success: true,
      message: `Price updated for ${contentType} ${itemId}`,
    });
  } catch (error) {
    console.error("Update price error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
