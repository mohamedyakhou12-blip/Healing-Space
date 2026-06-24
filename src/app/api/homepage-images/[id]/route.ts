import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
import { invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const updateHomepageImageSchema = z.object({
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
  order: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
  layout: z.enum(["grid", "carousel", "masonry"]).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "homepage-images-put");
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
      return NextResponse.json(
        { error: "Unauthorized - admin access required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateHomepageImageSchema.safeParse(body);

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

    const updated = await db.homepageImage.update({
      where: { id },
      data,
    });

    invalidateContentCache();
    return NextResponse.json({ image: updated });
  } catch (error) {
    console.error("Update homepage image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "homepage-images-delete");
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
      return NextResponse.json(
        { error: "Unauthorized - admin access required" },
        { status: 401 }
      );
    }

    await db.homepageImage.delete({ where: { id } });
    invalidateContentCache();

    return NextResponse.json({ message: "Homepage image deleted successfully" });
  } catch (error) {
    console.error("Delete homepage image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
