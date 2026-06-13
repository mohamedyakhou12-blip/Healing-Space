import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
import { cached, invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeHtml } from "@/lib/html-sanitize";

const updatePodcastSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleAr: z.string().min(1).max(200).optional(),
  titleFr: z.string().min(1).max(200).optional(),
  titleEn: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  descriptionAr: z.string().min(1).max(5000).optional(),
  descriptionFr: z.string().min(1).max(5000).optional(),
  descriptionEn: z.string().min(1).max(5000).optional(),
  audioUrl: z.string().min(1).max(500).optional(),
  image: z.string().max(500).optional(),
  duration: z.string().max(50).optional(),
  episode: z.number().int().min(0).max(99999).optional(),
  isFree: z.boolean().optional(),
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
      return NextResponse.json({ error: "Podcast ID is required" }, { status: 400 });
    }

    const podcast = await cached(
      `api:podcast:${id}`,
      () => db.podcast.findUnique({
        where: { id },
        include: { _count: true },
      })
    );

    if (!podcast) {
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 });
    }

    return NextResponse.json(
      { podcast },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Fetch podcast error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "podcasts-put");
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
    const parsed = updatePodcastSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Sanitize HTML content to prevent XSS
    if (parsed.data.description) parsed.data.description = sanitizeHtml(parsed.data.description);
    if (parsed.data.descriptionAr) parsed.data.descriptionAr = sanitizeHtml(parsed.data.descriptionAr);
    if (parsed.data.descriptionFr) parsed.data.descriptionFr = sanitizeHtml(parsed.data.descriptionFr);
    if (parsed.data.descriptionEn) parsed.data.descriptionEn = sanitizeHtml(parsed.data.descriptionEn);

    const existing = await db.podcast.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 });
    }

    const updated = await db.podcast.update({
      where: { id },
      data: parsed.data,
    });

    invalidateContentCache();
    return NextResponse.json({ podcast: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Update podcast error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "podcasts-delete");
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

    const existing = await db.podcast.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 });
    }

    await db.podcast.delete({ where: { id } });
    invalidateContentCache();
    return NextResponse.json({ message: "Podcast deleted successfully" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Delete podcast error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
