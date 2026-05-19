import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireAdmin } from "@/lib/session";
import { validateAdminCode } from "@/lib/admin-code";
import { REQUEST_LIMITS } from "@/lib/request-limits";
import { sanitizeHtml } from "@/lib/html-sanitize";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const updatePurchaseSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
  adminNote: z.string().max(REQUEST_LIMITS.MAX_ADMIN_NOTE_LENGTH, "Admin note is too long").optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "purchases-put");
  if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // SECURITY: Double-check admin access (session + admin code)
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json(
        { error: "Unauthorized - admin session required" },
        { status: 401 }
      );
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const { id } = await params;

    const body = await request.json();
    const parsed = updatePurchaseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { status, adminNote } = parsed.data;

    // Sanitize admin note HTML to prevent XSS
    const sanitizedAdminNote = adminNote ? sanitizeHtml(adminNote) : undefined;

    const existing = await db.purchase.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    const purchase = await db.purchase.update({
      where: { id },
      data: { status, adminNote: sanitizedAdminNote },
    });

    // Content type translations for notifications
    const contentTypeNames: Record<string, Record<string, string>> = {
      courses: { ar: "دورة", fr: "Cours", en: "Course" },
      articles: { ar: "مقال", fr: "Article", en: "Article" },
      podcasts: { ar: "بودكاست", fr: "Podcast", en: "Podcast" },
      videos: { ar: "فيديو", fr: "Vidéo", en: "Video" },
      pdfs: { ar: "كتاب إلكتروني", fr: "E-book", en: "E-book" },
      live: { ar: "جلسة مباشرة", fr: "Session en direct", en: "Live Session" },
    };
    const contentName = contentTypeNames[existing.contentType] || { ar: "محتوى", fr: "Contenu", en: "Content" };
    const contentTitle = existing.contentTitleAr || existing.contentTitle || contentName.ar;

    // If approved, notify user
    if (status === "approved") {
      await db.notification.create({
        data: {
          userId: existing.userId,
          title: "Purchase Approved",
          titleAr: "تم قبول الشراء",
          titleFr: "Achat approuvé",
          titleEn: "Purchase Approved",
          message: `Your purchase of "${contentTitle}" has been approved. You now have access.`,
          messageAr: `تم قبول شرائك لـ "${contentTitle}". يمكنك الآن الوصول إليه.`,
          messageFr: `Votre achat de "${contentTitle}" a été approuvé. Vous y avez maintenant accès.`,
          messageEn: `Your purchase of "${contentTitle}" has been approved. You now have access.`,
          type: "payment",
          link: "/profile",
        },
      });
    }

    // If rejected, notify user with reason
    if (status === "rejected") {
      const reason = adminNote || "";
      await db.notification.create({
        data: {
          userId: existing.userId,
          title: "Purchase Rejected",
          titleAr: "تم رفض الشراء",
          titleFr: "Achat rejeté",
          titleEn: "Purchase Rejected",
          message: reason
            ? `Your purchase of "${contentTitle}" was rejected. Reason: ${reason}`
            : `Your purchase of "${contentTitle}" was rejected. Please try again.`,
          messageAr: reason
            ? `تم رفض شرائك لـ "${contentTitle}". السبب: ${reason}`
            : `تم رفض شرائك لـ "${contentTitle}". يرجى المحاولة مرة أخرى.`,
          messageFr: reason
            ? `Votre achat de "${contentTitle}" a été rejeté. Raison : ${reason}`
            : `Votre achat de "${contentTitle}" a été rejeté. Veuillez réessayer.`,
          messageEn: reason
            ? `Your purchase of "${contentTitle}" was rejected. Reason: ${reason}`
            : `Your purchase of "${contentTitle}" was rejected. Please try again.`,
          type: "warning",
          link: "/payment",
        },
      });
    }

    return NextResponse.json({ purchase });
  } catch (error) {
    console.error("Update purchase error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/purchases/[id]
 *
 * Admin-only: Delete a purchase record.
 * Only rejected purchases can be deleted (to clean up the admin panel).
 * Approved purchases CANNOT be deleted because they represent permanent
 * content access — deleting them would revoke the user's access.
 * Pending purchases can be deleted (effectively rejecting them).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "purchases-delete");
  if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // Verify admin session
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Purchase ID is required" }, { status: 400 });
    }

    const purchase = await db.purchase.findUnique({ where: { id } });
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    // Cannot delete approved purchases — they represent permanent access
    if (purchase.status === "approved") {
      return NextResponse.json(
        { error: "Cannot delete approved purchases. This would revoke the user's permanent access to the content." },
        { status: 403 }
      );
    }

    // Delete the purchase record (only pending or rejected)
    await db.purchase.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Purchase deleted successfully." });
  } catch (error) {
    console.error("Delete purchase error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
