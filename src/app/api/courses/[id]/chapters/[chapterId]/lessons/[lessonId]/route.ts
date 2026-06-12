import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
import { invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const updateLessonSchema = z.object({
  title: z.string().max(200).optional(),
  titleAr: z.string().max(200).optional(),
  titleFr: z.string().max(200).optional(),
  titleEn: z.string().max(200).optional(),
  content: z.string().max(50000).optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
  duration: z.string().max(50).optional(),
  order: z.number().optional(),
  isFree: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string; lessonId: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "courses-lessons-put");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id, chapterId, lessonId } = await params;
    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateLessonSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });

    const lesson = await db.courseLesson.update({ where: { id: lessonId }, data: parsed.data });
    invalidateContentCache();
    return NextResponse.json({ lesson });
  } catch (error) {
    console.error("Update lesson error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string; lessonId: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "courses-lessons-delete");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id, chapterId, lessonId } = await params;
    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });
    }

    await db.courseLesson.delete({ where: { id: lessonId } });
    invalidateContentCache();
    return NextResponse.json({ message: "Lesson deleted successfully" });
  } catch (error) {
    console.error("Delete lesson error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
