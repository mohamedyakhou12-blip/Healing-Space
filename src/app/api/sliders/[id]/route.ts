import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { notifyGoogleUpdate } from "@/lib/google-notify";
import { invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeHtml, isUrlSafe } from "@/lib/html-sanitize";

const updateSliderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleAr: z.string().max(200).optional(),
  titleFr: z.string().max(200).optional(),
  titleEn: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
  descriptionFr: z.string().max(5000).optional(),
  descriptionEn: z.string().max(5000).optional(),
  image: z.string().max(500).optional(),
  imageUrl: z.string().max(500).optional(),
  link: z.string().max(500).optional(),
  order: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "sliders-put");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;

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
    const parsed = updateSliderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = { ...parsed.data };
    // Sanitize description fields to prevent stored XSS
    if (parsed.data.description) data.description = sanitizeHtml(parsed.data.description);
    if (parsed.data.descriptionAr) data.descriptionAr = sanitizeHtml(parsed.data.descriptionAr);
    if (parsed.data.descriptionFr) data.descriptionFr = sanitizeHtml(parsed.data.descriptionFr);
    if (parsed.data.descriptionEn) data.descriptionEn = sanitizeHtml(parsed.data.descriptionEn);
    // Validate URL fields
    if (parsed.data.link && !isUrlSafe(parsed.data.link)) {
      data.link = "";
    }
    if (parsed.data.image && !isUrlSafe(parsed.data.image)) {
      data.image = "";
    }
    if (parsed.data.imageUrl && !isUrlSafe(parsed.data.imageUrl)) {
      data.imageUrl = "";
    }
    // Support both 'image' and 'imageUrl' from frontend
    if (data.imageUrl && !data.image) {
      data.image = data.imageUrl;
      delete data.imageUrl;
    }

    const updated = await db.slider.update({
      where: { id },
      data,
    });

    notifyGoogleUpdate("sliders");
    invalidateContentCache();
    return NextResponse.json({ slider: updated });
  } catch (error) {
    console.error("Update slider error:", error);
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
  const rlKey = rateLimitKey(request, "sliders-delete");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;

    // SECURITY: Double-check admin access (session + admin code)
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    await db.slider.delete({ where: { id } });
    invalidateContentCache();

    return NextResponse.json({ message: "Slider deleted successfully" });
  } catch (error) {
    console.error("Delete slider error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
