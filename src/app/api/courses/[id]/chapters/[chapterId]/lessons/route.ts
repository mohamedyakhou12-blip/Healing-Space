import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeHtml, isUrlSafe } from "@/lib/html-sanitize";

const createLessonSchema = z.object({
  title: z.string().max(200),
  titleAr: z.string().max(200),
  titleFr: z.string().max(200),
  titleEn: z.string().max(200),
  content: z.string().max(50000).optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
  duration: z.string().max(50).optional(),
  order: z.number().default(0),
  isFree: z.boolean().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "courses-lessons-post");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id, chapterId } = await params;
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = createLessonSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });

    const sanitizedData: Record<string, unknown> = { ...parsed.data, chapterId };
    if (parsed.data.content) sanitizedData.content = sanitizeHtml(parsed.data.content);
    if (parsed.data.videoUrl && !isUrlSafe(parsed.data.videoUrl)) {
      sanitizedData.videoUrl = "";
    }

    const lesson = await db.courseLesson.create({
      data: sanitizedData,
    });

    invalidateContentCache();
    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    console.error("Create lesson error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
