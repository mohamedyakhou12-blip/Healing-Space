import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { sanitizeInput } from "@/lib/sanitize";
import { sanitizeHtml } from "@/lib/html-sanitize";
import { REQUEST_LIMITS } from "@/lib/request-limits";
import { notifyGoogleUpdate } from "@/lib/google-notify";
import { cached, invalidateContentCache } from "@/lib/cache";
import { batchReviewStats } from "@/lib/review-stats";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const createCourseSchema = z.object({
  title: z.string().min(1, "Title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH, "Title is too long"),
  titleAr: z.string().min(1, "Arabic title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleFr: z.string().min(1, "French title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  titleEn: z.string().min(1, "English title is required").max(REQUEST_LIMITS.MAX_TITLE_LENGTH),
  description: z.string().min(1, "Description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionAr: z.string().min(1, "Arabic description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionFr: z.string().min(1, "French description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  descriptionEn: z.string().min(1, "English description is required").max(REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH),
  image: z.string().url("Invalid image URL").optional().or(z.literal("")),
  status: z.enum(["published", "draft"]).default("draft"),
  isFree: z.boolean().default(false),
  price: z.number().min(REQUEST_LIMITS.MIN_PRICE).max(REQUEST_LIMITS.MAX_PRICE).optional(),
  duration: z.string().max(50).optional(),
  instructor: z.string().max(100).optional(),
  chapters: z
    .array(
      z.object({
        title: z.string().max(200),
        titleAr: z.string().max(200),
        titleFr: z.string().max(200),
        titleEn: z.string().max(200),
        order: z.number().default(0),
        lessons: z
          .array(
            z.object({
              title: z.string().max(200),
              titleAr: z.string().max(200),
              titleFr: z.string().max(200),
              titleEn: z.string().max(200),
              content: z.string().max(50000).optional(),
              videoUrl: z.string().url().optional().or(z.literal("")),
              duration: z.string().max(50).optional(),
              order: z.number().default(0),
              isFree: z.boolean().default(false),
            })
          )
          .optional(),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    let status = url.searchParams.get("status");

    // Security: Only admins can view draft content — public users always see published only
    if (status && status !== "published") {
      const adminId = await requireAdmin();
      if (!adminId) {
        status = "published"; // Force non-admins to only see published content
      }
    }

    const cacheKey = `api:courses:${status || "all"}:${limit || "all"}`;

    const data = await cached(cacheKey, async () => {
      const courses = await db.course.findMany({
        include: { chapters: true, _count: true },
        limit: limit ? parseInt(limit, 10) : undefined,
        status: status || undefined,
      });

      // Batch fetch review stats instead of N+1
      const courseIds = courses.map((c: any) => c.id);
      const reviewStats = await batchReviewStats("course", courseIds);

      const coursesWithStats = courses.map((course: any) => {
        const stats = reviewStats.get(course.id) || { avgRating: 0, reviewCount: 0 };
        return {
          ...course,
          avgRating: stats.avgRating,
          reviewCount: stats.reviewCount,
        };
      });

      return coursesWithStats;
    }, 30_000);

    return NextResponse.json(
      { courses: data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Fetch courses error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "courses-post");
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
    const parsed = createCourseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { chapters, ...courseData } = parsed.data;

    // Sanitize HTML in descriptions to prevent XSS
    const sanitizedCourseData = {
      ...courseData,
      description: sanitizeHtml(courseData.description),
      descriptionAr: sanitizeHtml(courseData.descriptionAr),
      descriptionFr: sanitizeHtml(courseData.descriptionFr),
      descriptionEn: sanitizeHtml(courseData.descriptionEn),
    };

    const course = await db.course.create({
      data: sanitizedCourseData,
    });

    if (chapters && chapters.length > 0) {
      for (const chapter of chapters) {
        const { lessons, ...chapterData } = chapter;
        const createdChapter = await db.courseChapter.create({
          data: {
            ...chapterData,
            courseId: course.id,
          },
        });

        if (lessons && lessons.length > 0) {
          await db.courseLesson.createMany({
            data: lessons.map((lesson: any) => ({
              ...lesson,
              chapterId: createdChapter.id,
            })),
          });
        }
      }
    }

    const fullCourse = await db.course.findUnique({
      where: { id: course.id },
      include: { chapters: true },
    });

    // Invalidate cache after content mutation
    invalidateContentCache();

    // Notify Google to re-crawl the courses page
    notifyGoogleUpdate("courses");

    return NextResponse.json({ course: fullCourse }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create course error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
