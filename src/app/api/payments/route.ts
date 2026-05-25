import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { requireAuth, requireAdmin } from "@/lib/session";
import { validateAdminCode } from "@/lib/admin-code";
import { REQUEST_LIMITS } from "@/lib/request-limits";
import { sanitizeHtml } from "@/lib/html-sanitize";

const createPaymentSchema = z.object({
  subscriptionType: z.enum([
    "full",
    "courses",
    "articles",
    "podcasts",
    "videos",
    "pdfs",
    "live",
    "coaching",
  ]),
  amount: z.number().positive("Amount must be positive").max(REQUEST_LIMITS.MAX_PRICE, "Amount exceeds maximum allowed"),
  receiptImage: z.string().min(1, "Receipt image URL is required"),
  ccpNumber: z.string().max(REQUEST_LIMITS.MAX_CCP_LENGTH, "CCP number is too long").optional(),
});

const updatePaymentSchema = z.object({
  id: z.string().min(1, "Payment ID is required"),
  status: z.enum(["pending", "approved", "rejected"]),
  adminNote: z.string().max(REQUEST_LIMITS.MAX_ADMIN_NOTE_LENGTH, "Admin note is too long").optional(),
});

function validateReceipt(receiptImage: string): string | null {
  // If it's a URL (from Cloudinary, Firebase Storage, etc.), validate it comes from a trusted storage provider
  if (receiptImage.startsWith("https://") || receiptImage.startsWith("http://")) {
    // Only allow URLs from known, trusted storage providers (prevents SSRF)
    const trustedHosts = [
      "firebasestorage.googleapis.com",
      "storage.googleapis.com",
      "res.cloudinary.com",
      "cloudinary.com",
    ];
    try {
      const url = new URL(receiptImage);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "Invalid receipt URL protocol";
      }
      // Block internal/private network URLs (SSRF prevention)
      const hostname = url.hostname.toLowerCase();
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.16.")) {
        return "Invalid receipt URL";
      }
      // Check if the host is from a trusted provider
      const isTrusted = trustedHosts.some(host => hostname === host || hostname.endsWith("." + host));
      if (!isTrusted) {
        return "Receipt URL must be from an approved storage provider";
      }
      return null;
    } catch {
      return "Invalid receipt URL";
    }
  }

  // If it's base64 data URL
  if (receiptImage.startsWith("data:")) {
    const base64Data = receiptImage.split(",")[1] || "";
    const sizeInBytes = Math.ceil(base64Data.length * 0.75);
    if (sizeInBytes > 20 * 1024 * 1024) {
      return "Receipt is too large (max 20MB)";
    }
    return null;
  }

  return "Invalid receipt format";
}

export async function GET(request: NextRequest) {
  try {
    // Check admin FIRST — admins have both userId and isAdmin in session.
    // If we checked userId first, admins would only see their own records.
    const adminId = await requireAdmin();
    const userId = await requireAuth();

    if (adminId) {
      // Auto-delete rejected payments older than 10 days
      // NOTE: We do NOT auto-delete approved payments because they represent
      // valid subscription access. Deleting approved payments would remove
      // the audit trail. Only rejected payments are cleaned up.
      try {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const allPayments = await db.payment.findMany({});
        const oldPayments = allPayments.filter(
          (p: any) => p.status === "rejected" && p.updatedAt && new Date(p.updatedAt) < tenDaysAgo
        );
        for (const p of oldPayments) {
          try { await db.payment.delete({ where: { id: p.id } }); } catch {}
        }
      } catch (e) {
        console.error("Auto-cleanup of old payments failed:", e);
      }

      // Admin: return all payments with user info
      const payments = await db.payment.findMany({
        include: { user: true },
      });
      return NextResponse.json({ payments });
    }

    if (userId) {
      // Regular user: return only their payments
      const payments = await db.payment.findMany({
        where: { userId },
      });
      return NextResponse.json({ payments });
    }

    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  } catch (error) {
    console.error("Fetch payments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authenticated user
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Rate limiting: max 5 payment submissions per 5 minutes per IP
    const rlKey = rateLimitKey(request, "payment-create");
    if (isRateLimited(rlKey, { max: 5, windowMs: 5 * 60_000 })) {
      return NextResponse.json(
        { error: "Too many payment attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Validate CCP number length
    if (parsed.data.ccpNumber && parsed.data.ccpNumber.length > REQUEST_LIMITS.MAX_CCP_LENGTH) {
      return NextResponse.json(
        { error: "CCP number is too long" },
        { status: 400 }
      );
    }

    // Validate receipt image format and size
    const { receiptImage } = parsed.data;
    const receiptError = validateReceipt(receiptImage);
    if (receiptError) {
      return NextResponse.json({ error: receiptError }, { status: 400 });
    }

    const payment = await db.payment.create({
      data: {
        userId,
        subscriptionType: parsed.data.subscriptionType,
        amount: parsed.data.amount,
        receiptImage,
        ccpNumber: parsed.data.ccpNumber,
        status: "pending",
      },
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error("Create payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Admin-only: approving/rejecting payments requires admin session + code
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 401 }
      );
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updatePaymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { id, status, adminNote } = parsed.data;

    // Sanitize admin note HTML to prevent XSS
    const sanitizedAdminNote = adminNote ? sanitizeHtml(adminNote) : undefined;

    const existing = await db.payment.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    const payment = await db.payment.update({
      where: { id },
      data: { status, adminNote: sanitizedAdminNote },
    });

    // If approved, create subscription (check for duplicates)
    if (status === "approved") {
      // Check if user already has an active subscription for this type
      const existingSubs = await db.subscription.findMany({
        where: { userId: existing.userId, status: "active" },
      });
      // If user already has an active subscription for this type, extend it (stack remaining days)
      const existingSubForType = existingSubs.find(
        (sub: any) => sub.type === existing.subscriptionType && new Date(sub.endDate) > new Date()
      );

      if (existingSubForType) {
        // Extend existing subscription: new endDate = max(now, current endDate) + 30 days
        const currentEndDate = new Date(existingSubForType.endDate);
        const now = new Date();
        const baseDate = currentEndDate > now ? currentEndDate : now;
        const newEndDate = new Date(baseDate);
        newEndDate.setDate(newEndDate.getDate() + 30);

        await db.subscription.update({
          where: { id: existingSubForType.id },
          data: { endDate: newEndDate.toISOString() },
        });
      } else {
        // No active subscription for this type — create new one
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 30); // Exactly 30 days

        await db.subscription.create({
          data: {
            userId: existing.userId,
            type: existing.subscriptionType,
            status: "active",
            startDate: now.toISOString(),
            endDate: endDate.toISOString(),
          },
        });
      }

      // Plan type translations for notifications
      const planNames: Record<string, Record<string, string>> = {
        full: { ar: "الكامل", fr: "Complet", en: "Full" },
        courses: { ar: "الدورات", fr: "Cours", en: "Courses" },
        articles: { ar: "المقالات", fr: "Articles", en: "Articles" },
        podcasts: { ar: "البودكاست", fr: "Podcasts", en: "Podcasts" },
        videos: { ar: "الفيديوهات", fr: "Vidéos", en: "Videos" },
        pdfs: { ar: "الكتب", fr: "E-books", en: "E-books" },
        live: { ar: "الجلسات المباشرة", fr: "Sessions en direct", en: "Live Sessions" },
        coaching: { ar: "الكوتشنغ", fr: "Coaching", en: "Coaching" },
      };
      const planLabel = planNames[existing.subscriptionType] || { ar: existing.subscriptionType, fr: existing.subscriptionType, en: existing.subscriptionType };

      // Create notification for user
      await db.notification.create({
        data: {
          userId: existing.userId,
          title: "Payment Approved",
          titleAr: "تم قبول الدفع",
          titleFr: "Paiement approuvé",
          titleEn: "Payment Approved",
          message: `Your ${planLabel.en} subscription is now active.`,
          messageAr: `اشتراكك في ${planLabel.ar} أصبح نشطاً الآن.`,
          messageFr: `Votre abonnement ${planLabel.fr} est maintenant actif.`,
          messageEn: `Your ${planLabel.en} subscription is now active.`,
          type: "payment",
          link: "/profile",
        },
      });
    }

    // If rejected, create notification
    if (status === "rejected") {
      await db.notification.create({
        data: {
          userId: existing.userId,
          title: "Payment Rejected",
          titleAr: "تم رفض الدفع",
          titleFr: "Paiement rejeté",
          titleEn: "Payment Rejected",
          message: adminNote || "Your payment was rejected. Please try again.",
          messageAr:
            adminNote || "تم رفض الدفع الخاص بك. يرجى المحاولة مرة أخرى.",
          messageFr:
            adminNote || "Votre paiement a été rejeté. Veuillez réessayer.",
          messageEn:
            adminNote || "Your payment was rejected. Please try again.",
          type: "warning",
          link: "/payment",
        },
      });
    }

    return NextResponse.json({ payment });
  } catch (error) {
    console.error("Update payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
