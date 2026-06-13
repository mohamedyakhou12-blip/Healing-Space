import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
import { cached, invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeHtml } from "@/lib/html-sanitize";

const updateArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleAr: z.string().min(1).max(200).optional(),
  titleFr: z.string().min(1).max(200).optional(),
  titleEn: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  contentAr: z.string().min(1).max(50000).optional(),
  contentFr: z.string().min(1).max(50000).optional(),
  contentEn: z.string().min(1).max(50000).optional(),
  excerpt: z.string().max(1000).optional(),
  excerptAr: z.string().max(1000).optional(),
  excerptFr: z.string().max(1000).optional(),
  excerptEn: z.string().max(1000).optional(),
  image: z.string().max(500).optional(),
  author: z.string().max(100).optional(),
  isFree: z.boolean().optional(),
  readTime: z.string().max(50).optional(),
  price: z.number().min(0).max(1000000).optional(),
  status: z.enum(["published", "draft"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    const article = await cached(
      `api:article:${id}`,
      () => db.article.findUnique({
        where: { id },
        include: { _count: true },
      })
    );

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json(
      { article },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Fetch article error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "articles-put");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;

    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateArticleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Sanitize HTML content to prevent XSS
    if (parsed.data.content) parsed.data.content = sanitizeHtml(parsed.data.content);
    if (parsed.data.contentAr) parsed.data.contentAr = sanitizeHtml(parsed.data.contentAr);
    if (parsed.data.contentFr) parsed.data.contentFr = sanitizeHtml(parsed.data.contentFr);
    if (parsed.data.contentEn) parsed.data.contentEn = sanitizeHtml(parsed.data.contentEn);
    if (parsed.data.excerpt) parsed.data.excerpt = sanitizeHtml(parsed.data.excerpt);
    if (parsed.data.excerptAr) parsed.data.excerptAr = sanitizeHtml(parsed.data.excerptAr);
    if (parsed.data.excerptFr) parsed.data.excerptFr = sanitizeHtml(parsed.data.excerptFr);
    if (parsed.data.excerptEn) parsed.data.excerptEn = sanitizeHtml(parsed.data.excerptEn);

    const existing = await db.article.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const updated = await db.article.update({
      where: { id },
      data: parsed.data,
    });

    invalidateContentCache();
    return NextResponse.json({ article: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Update article error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "articles-delete");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;

    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });
    }

    const existing = await db.article.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    await db.article.delete({ where: { id } });
    invalidateContentCache();
    return NextResponse.json({ message: "Article deleted successfully" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Delete article error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
