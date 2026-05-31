import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { notifyGoogleUpdate } from "@/lib/google-notify";
import { invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeHtml, isUrlSafe } from "@/lib/html-sanitize";

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleAr: z.string().min(1).max(200).optional(),
  titleFr: z.string().min(1).max(200).optional(),
  titleEn: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  descriptionAr: z.string().min(1).max(5000).optional(),
  descriptionFr: z.string().min(1).max(5000).optional(),
  descriptionEn: z.string().min(1).max(5000).optional(),
  image: z.string().url().optional().or(z.literal("")),
  status: z.enum(["published", "draft"]).optional(),
  isFree: z.boolean().optional(),
  price: z.number().min(0).max(1000000).optional(),
  duration: z.string().max(50).optional(),
  instructor: z.string().max(100).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || id.length > 100) {
      return NextResponse.json(
        { error: "Invalid course ID" },
        { status: 400 }
      );
    }

    const course = await db.course.findUnique({
      where: { id },
      include: { chapters: true, reviews: true, _count: true },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // SECURITY: Non-admin users cannot view draft content
    if (course.status === "draft") {
      const adminId = await requireAdmin();
      if (!adminId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const reviews = (course as any).reviews || [];
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) /
          reviews.length
        : 0;

    return NextResponse.json({
      course: {
        ...course,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: reviews.length,
      },
    });
  } catch (error) {
    console.error("Fetch course error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "courses-put");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;

    // SECURITY: Double-check admin access
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateCourseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Sanitize description fields to prevent stored XSS
    const sanitizedData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.description) sanitizedData.description = sanitizeHtml(parsed.data.description);
    if (parsed.data.descriptionAr) sanitizedData.descriptionAr = sanitizeHtml(parsed.data.descriptionAr);
    if (parsed.data.descriptionFr) sanitizedData.descriptionFr = sanitizeHtml(parsed.data.descriptionFr);
    if (parsed.data.descriptionEn) sanitizedData.descriptionEn = sanitizeHtml(parsed.data.descriptionEn);

    const updated = await db.course.update({
      where: { id },
      data: sanitizedData,
      include: { chapters: true },
    });

    notifyGoogleUpdate("courses");
    invalidateContentCache();
    return NextResponse.json({ course: updated });
  } catch (error: unknown) {
    console.error("Update course error:", error);
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
  const rlKey = rateLimitKey(request, "courses-delete");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;

    // SECURITY: Double-check admin access
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    await db.course.delete({ where: { id } });
    invalidateContentCache();

    return NextResponse.json({ message: "Course deleted successfully" });
  } catch (error: unknown) {
    console.error("Delete course error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
