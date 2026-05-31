import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { notifyGoogleUpdate } from "@/lib/google-notify";
import { invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const updatePdfSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  titleAr: z.string().min(1).max(200).optional(),
  titleFr: z.string().min(1).max(200).optional(),
  titleEn: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  descriptionAr: z.string().min(1).max(5000).optional(),
  descriptionFr: z.string().min(1).max(5000).optional(),
  descriptionEn: z.string().min(1).max(5000).optional(),
  fileUrl: z.string().min(1).max(500).optional(),
  fileSize: z.string().max(50).optional(),
  pageCount: z.number().int().min(0).max(99999).optional(),
  isFree: z.boolean().optional(),
  price: z.number().min(0).max(1000000).optional(),
  status: z.enum(["published", "draft"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "PDF ID is required" }, { status: 400 });
    }

    const pdf = await db.pdfResource.findUnique({ where: { id } });

    if (!pdf) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    // SECURITY: Non-admin users cannot view draft content
    if (pdf.status === "draft") {
      const adminId = await requireAdmin();
      if (!adminId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ pdf });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Fetch PDF error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "pdfs-put");
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
    const parsed = updatePdfSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const existing = await db.pdfResource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    const updated = await db.pdfResource.update({
      where: { id },
      data: parsed.data,
    });

    notifyGoogleUpdate("pdfs");
    invalidateContentCache();
    return NextResponse.json({ pdf: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Update PDF error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "pdfs-delete");
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

    const existing = await db.pdfResource.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    }

    await db.pdfResource.delete({ where: { id } });
    invalidateContentCache();
    return NextResponse.json({ message: "PDF deleted successfully" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Delete PDF error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
