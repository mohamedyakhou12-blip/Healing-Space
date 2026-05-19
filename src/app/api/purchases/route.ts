import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { requireAuth, requireAdmin } from "@/lib/session";
import { REQUEST_LIMITS } from "@/lib/request-limits";

const CONTENT_TYPES = ["courses", "articles", "podcasts", "videos", "pdfs", "live"] as const;

const createPurchaseSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
  contentType: z.enum(CONTENT_TYPES, { message: "Invalid content type" }),
  amount: z.number().positive("Amount must be positive").max(REQUEST_LIMITS.MAX_PRICE, "Amount exceeds maximum allowed"),
  receiptImage: z.string().min(1, "Receipt image is required"),
  ccpNumber: z.string().max(REQUEST_LIMITS.MAX_CCP_LENGTH, "CCP number is too long").optional(),
  contentTitle: z.string().optional(),
  contentTitleAr: z.string().optional(),
});

function validateReceipt(receiptImage: string): string | null {
  // If it's a URL (from Firebase Storage or other), validate the protocol
  if (receiptImage.startsWith("https://") || receiptImage.startsWith("http://")) {
    // Allow Firebase Storage URLs and other HTTPS URLs
    if (receiptImage.includes("firebasestorage.googleapis.com") || receiptImage.includes("storage.googleapis.com")) {
      return null; // Valid Firebase Storage URL
    }
    // Also allow other HTTPS URLs (backward compatibility + external URLs)
    try {
      const url = new URL(receiptImage);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "Invalid receipt URL protocol";
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
      // Auto-delete rejected purchases older than 10 days
      // NOTE: We do NOT auto-delete approved purchases because they represent
      // permanent content access. Deleting them would revoke the user's access.
      // Approved purchases can only be deleted manually by the admin.
      try {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const allPurchases = await db.purchase.findMany({});
        const oldPurchases = allPurchases.filter(
          (p: any) => p.status === "rejected" && p.updatedAt && new Date(p.updatedAt) < tenDaysAgo
        );
        for (const p of oldPurchases) {
          try { await db.purchase.delete({ where: { id: p.id } }); } catch {}
        }
      } catch (e) {
        console.error("Auto-cleanup of old purchases failed:", e);
      }

      // Admin: return all purchases
      const purchases = await db.purchase.findMany({});
      return NextResponse.json({ purchases });
    }

    if (userId) {
      // Regular user: return only their purchases
      const purchases = await db.purchase.findMany({
        where: { userId },
      });
      return NextResponse.json({ purchases });
    }

    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  } catch (error) {
    console.error("Fetch purchases error:", error);
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

    // Rate limiting: max 5 purchase submissions per 5 minutes per IP
    const rlKey = rateLimitKey(request, "purchase-create");
    if (isRateLimited(rlKey, { max: 5, windowMs: 5 * 60_000 })) {
      return NextResponse.json(
        { error: "Too many purchase attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = createPurchaseSchema.safeParse(body);

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

    // Check if user already has a pending purchase for this content
    const existingPurchases = await db.purchase.findMany({
      where: {
        userId,
        contentId: parsed.data.contentId,
        status: "pending",
      },
    });

    if (existingPurchases.length > 0) {
      return NextResponse.json(
        { error: "You already have a pending purchase for this content" },
        { status: 409 }
      );
    }

    // Check if user already purchased and it was approved
    const approvedPurchases = await db.purchase.findMany({
      where: {
        userId,
        contentId: parsed.data.contentId,
        status: "approved",
      },
    });

    if (approvedPurchases.length > 0) {
      return NextResponse.json(
        { error: "You already have access to this content" },
        { status: 409 }
      );
    }

    const purchase = await db.purchase.create({
      data: {
        userId,
        contentId: parsed.data.contentId,
        contentType: parsed.data.contentType,
        amount: parsed.data.amount,
        receiptImage,
        ccpNumber: parsed.data.ccpNumber,
        contentTitle: parsed.data.contentTitle,
        contentTitleAr: parsed.data.contentTitleAr,
        status: "pending",
      },
    });

    return NextResponse.json({ purchase }, { status: 201 });
  } catch (error) {
    console.error("Create purchase error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
