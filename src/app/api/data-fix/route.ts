import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

/**
 * POST /api/data-fix
 *
 * Admin-only data fix endpoint.
 * Requires admin session authentication + CSRF token (not exempt).
 * GET method removed — only POST with CSRF token is allowed.
 */

export async function POST(request: NextRequest) {
  // Require admin session
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
  }

  try {
    const fixes: string[] = [];
    const errors: string[] = [];

    // ── Fix 1: PDF — missing price and pdfUrl/fileUrl ──
    try {
      const pdfs = await db.pdfResource.findMany();
      for (const pdf of pdfs) {
        const updateData: Record<string, any> = {};
        if (!pdf.price && pdf.isFree === false) {
          updateData.price = 1500;
        }
        if (!pdf.fileUrl && !pdf.pdfUrl) {
          updateData.fileUrl = "https://example.com/default-ebook.pdf";
        }
        if (pdf.pdfUrl && !pdf.fileUrl) {
          updateData.fileUrl = pdf.pdfUrl;
        }

        if (Object.keys(updateData).length > 0) {
          await db.pdfResource.update({
            where: { id: pdf.id },
            data: updateData,
          });
          fixes.push(`PDF ${pdf.id}: added ${Object.keys(updateData).join(", ")}`);
        } else {
          fixes.push(`PDF ${pdf.id}: no fix needed`);
        }
      }
    } catch (err) {
      errors.push(`PDF fix error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Fix 2: Articles — missing description fields ──
    try {
      const articles = await db.article.findMany();
      for (const article of articles) {
        const updateData: Record<string, any> = {};
        if (!article.description && (article as any).content) {
          updateData.description = ((article as any).content || "").substring(0, 200);
        }
        if (!(article as any).descriptionAr && (article as any).contentAr) {
          updateData.descriptionAr = ((article as any).contentAr || "").substring(0, 200);
        }
        if (!(article as any).descriptionFr && (article as any).contentFr) {
          updateData.descriptionFr = ((article as any).contentFr || "").substring(0, 200);
        }
        if (!(article as any).descriptionEn && (article as any).contentEn) {
          updateData.descriptionEn = ((article as any).contentEn || "").substring(0, 200);
        }

        if (Object.keys(updateData).length > 0) {
          await db.article.update({
            where: { id: article.id },
            data: updateData,
          });
          fixes.push(`Article ${article.id}: added ${Object.keys(updateData).join(", ")}`);
        } else {
          fixes.push(`Article ${article.id}: no fix needed`);
        }
      }
    } catch (err) {
      errors.push(`Article fix error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return NextResponse.json({ success: true, fixes, errors });
  } catch (error) {
    console.error("Data fix error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
