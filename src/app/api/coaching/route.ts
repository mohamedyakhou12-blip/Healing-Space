import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeHtml } from "@/lib/html-sanitize";
import { REQUEST_LIMITS } from "@/lib/request-limits";

// Zod schema for coaching creation (same as /api/coachings)
const createCoachingSchema = z.object({
  title: z.string().min(1, "Title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH, "Title is too long"),
  titleAr: z.string().min(1, "Arabic title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleFr: z.string().min(1, "French title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleEn: z.string().min(1, "English title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  description: z.string().min(1, "Description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionAr: z.string().min(1, "Arabic description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionFr: z.string().min(1, "French description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionEn: z.string().min(1, "English description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  image: z.string().max(500).optional(),
  duration: z.string().max(50).optional(),
  order: z.number().int().min(0).max(99999).optional(),
  status: z.enum(["published", "draft"]).default("draft"),
  isFree: z.boolean().default(false),
  price: z.number().min(REQUEST_LIMITS.MIN_PRICE).max(REQUEST_LIMITS.MAX_PRICE).optional(),
  category: z.string().max(200).optional(),
  subcategory: z.string().max(200).optional(),
  tags: z.string().max(1000).optional(),
  viewCount: z.number().int().min(0).optional(),
});

// GET /api/coaching — Public: list coaching items (published only)
export async function GET() {
  try {
    const coaching = await db.coaching.findMany({ orderBy: { createdAt: "desc" } });
    // Filter out draft items for non-admin public access
    const published = coaching.filter((c: any) => c.status === "published");
    return NextResponse.json({ success: true, coaching: published });
  } catch (error) {
    console.error("Fetch coaching error:", error);
    return NextResponse.json({ error: "Failed to fetch coaching items" }, { status: 500 });
  }
}

// POST /api/coaching — Admin: create coaching item
export async function POST(request: NextRequest) {
  const rlKey = rateLimitKey(request, "coaching-post");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });

    const body = await request.json();
    const parsed = createCoachingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const coaching = await db.coaching.create({
      data: {
        ...parsed.data,
        description: sanitizeHtml(parsed.data.description),
        descriptionAr: sanitizeHtml(parsed.data.descriptionAr),
        descriptionFr: sanitizeHtml(parsed.data.descriptionFr),
        descriptionEn: sanitizeHtml(parsed.data.descriptionEn),
      },
    });
    return NextResponse.json({ success: true, coaching });
  } catch (error) {
    console.error("Create coaching error:", error);
    return NextResponse.json({ error: "Failed to create coaching item" }, { status: 500 });
  }
}
