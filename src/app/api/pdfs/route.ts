import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
import { requireAdmin } from "@/lib/session";
import { sanitizeHtml, isUrlSafe } from "@/lib/html-sanitize";
import { REQUEST_LIMITS } from "@/lib/request-limits";
import { cached, invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { gateContentList } from "@/lib/api-content-gate";

const createPdfSchema = z.object({
  title: z.string().min(1, "Title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH, "Title is too long"),
  titleAr: z.string().min(1, "Arabic title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleFr: z.string().min(1, "French title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleEn: z.string().min(1, "English title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  description: z.string().min(1, "Description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionAr: z.string().min(1, "Arabic description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionFr: z.string().min(1, "French description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionEn: z.string().min(1, "English description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  fileUrl: z.string().min(1, "File URL is required").max(500),
  fileSize: z.string().max(50).optional(),
  pageCount: z.number().int().min(0).max(99999).optional(),
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
    // Cache ALL PDFs once, then filter in-memory for different query combos
    const allPdfs = await cached("api:pdfs:all", async () => {
      return await db.pdfResource.findMany();
    }, 30_000);

    // Apply filters from cached data (no extra DB reads)
    let result = allPdfs;
    if (status) {
      result = result.filter((p: any) => p.status === status);
    }
    if (limit) {
      result = result.slice(0, parseInt(limit, 10));
    }

    // Strip premium content for unauthenticated/unsubscribed users
    const gatedResult = await gateContentList(result, "pdfs");

    return NextResponse.json(
      { pdfs: gatedResult },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Fetch PDFs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "pdfs-post");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createPdfSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Validate file URL safety
    if (parsed.data.fileUrl && !isUrlSafe(parsed.data.fileUrl)) {
      return NextResponse.json(
        { error: "Invalid file URL" },
        { status: 400 }
      );
    }

    const pdf = await db.pdfResource.create({
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

    return NextResponse.json({ pdf }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create PDF error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
