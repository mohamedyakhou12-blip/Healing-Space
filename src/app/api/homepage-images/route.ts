import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
import { requireAdmin } from "@/lib/session";
import { cached, invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const createHomepageImageSchema = z.object({
  title: z.string().max(200).optional(),
  titleAr: z.string().max(200).optional(),
  titleFr: z.string().max(200).optional(),
  titleEn: z.string().max(200).optional(),
  caption: z.string().max(500).optional(),
  captionAr: z.string().max(500).optional(),
  captionFr: z.string().max(500).optional(),
  captionEn: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
  descriptionFr: z.string().max(5000).optional(),
  descriptionEn: z.string().max(5000).optional(),
  image: z.string().max(1000).optional(),
  imageUrl: z.string().max(1000).optional(),
  link: z.string().max(500).optional(),
  order: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  layout: z.enum(["grid", "carousel", "masonry"]).default("grid"),
});

export async function GET(request: NextRequest) {
  try {
    // Check if the request is from an admin
    const adminId = await requireAdmin();
    const isAdmin = !!adminId;

    const data = await cached("api:homepage-images", async () => {
      return await db.homepageImage.findMany();
    }, 60_000); // Images change rarely, cache for 60s

    // Non-admins should only see active images
    const filteredData = isAdmin
      ? data
      : data.filter((s: any) => s.isActive !== false);

    return NextResponse.json(
      { images: filteredData },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Fetch homepage images error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "homepage-images-post");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized - admin access required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createHomepageImageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const data = { ...parsed.data };
    // Support both 'image' and 'imageUrl' from frontend
    if (data.imageUrl && !data.image) {
      data.image = data.imageUrl;
      delete data.imageUrl;
    }
    // Require at least one image source
    if (!data.image) {
      return NextResponse.json(
        { error: "Image is required" },
        { status: 400 }
      );
    }
    // Auto-fill multilingual fields if only the base field is provided
    if (data.title && !data.titleAr) data.titleAr = data.title;
    if (data.title && !data.titleFr) data.titleFr = data.title;
    if (data.title && !data.titleEn) data.titleEn = data.title;
    if (data.caption && !data.captionAr) data.captionAr = data.caption;
    if (data.caption && !data.captionFr) data.captionFr = data.caption;
    if (data.caption && !data.captionEn) data.captionEn = data.caption;
    if (data.description && !data.descriptionAr) data.descriptionAr = data.description;
    if (data.description && !data.descriptionFr) data.descriptionFr = data.description;
    if (data.description && !data.descriptionEn) data.descriptionEn = data.description;

    const image = await db.homepageImage.create({ data });

    // Invalidate cache after content mutation
    invalidateContentCache();

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    console.error("Create homepage image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
