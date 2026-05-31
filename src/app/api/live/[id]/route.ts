import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { notifyGoogleUpdate } from "@/lib/google-notify";
import { invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeHtml, isUrlSafe } from "@/lib/html-sanitize";

const updateLiveSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleAr: z.string().min(1).max(200).optional(),
  titleFr: z.string().min(1).max(200).optional(),
  titleEn: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  descriptionAr: z.string().min(1).max(5000).optional(),
  descriptionFr: z.string().min(1).max(5000).optional(),
  descriptionEn: z.string().min(1).max(5000).optional(),
  streamUrl: z.string().max(500).optional(),
  zoomUrl: z.string().max(500).optional(),
  image: z.string().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(["live", "upcoming", "ended"]).optional(),
  duration: z.string().max(50).optional(),
  isFree: z.boolean().optional(),
  price: z.number().min(0).max(1000000).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Live session ID is required" }, { status: 400 });
    }

    const liveSession = await db.liveSession.findUnique({ where: { id } });

    if (!liveSession) {
      return NextResponse.json({ error: "Live session not found" }, { status: 404 });
    }

    // SECURITY: Non-admin users cannot view draft content
    if (liveSession.status === "draft") {
      const adminId = await requireAdmin();
      if (!adminId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ liveSession });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Fetch live session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "live-put");
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
    const parsed = updateLiveSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const existing = await db.liveSession.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Live session not found" }, { status: 404 });
    }

    const sanitizedData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.description) sanitizedData.description = sanitizeHtml(parsed.data.description);
    if (parsed.data.descriptionAr) sanitizedData.descriptionAr = sanitizeHtml(parsed.data.descriptionAr);
    if (parsed.data.descriptionFr) sanitizedData.descriptionFr = sanitizeHtml(parsed.data.descriptionFr);
    if (parsed.data.descriptionEn) sanitizedData.descriptionEn = sanitizeHtml(parsed.data.descriptionEn);
    if (parsed.data.streamUrl && !isUrlSafe(parsed.data.streamUrl)) {
      sanitizedData.streamUrl = "";
    }
    if (parsed.data.zoomUrl && !isUrlSafe(parsed.data.zoomUrl)) {
      sanitizedData.zoomUrl = "";
    }

    const updated = await db.liveSession.update({
      where: { id },
      data: sanitizedData,
    });

    notifyGoogleUpdate("live");
    invalidateContentCache();
    return NextResponse.json({ liveSession: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Update live session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "live-delete");
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

    const existing = await db.liveSession.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Live session not found" }, { status: 404 });
    }

    await db.liveSession.delete({ where: { id } });
    invalidateContentCache();
    return NextResponse.json({ message: "Live session deleted successfully" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Delete live session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
