import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const createChapterSchema = z.object({
  title: z.string().max(200),
  titleAr: z.string().max(200),
  titleFr: z.string().max(200),
  titleEn: z.string().max(200),
  order: z.number().default(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "courses-chapters-post");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = createChapterSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });

    const chapter = await db.courseChapter.create({
      data: { ...parsed.data, courseId: id },
    });

    invalidateContentCache();
    return NextResponse.json({ chapter }, { status: 201 });
  } catch (error) {
    console.error("Create chapter error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
