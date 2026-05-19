import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

/**
 * DELETE /api/payments/[id]
 *
 * Admin-only: Delete a payment record.
 * IMPORTANT: This does NOT delete the associated subscription.
 * Deleting a payment is purely for cleanup of the admin panel.
 * The user's subscription (if any) remains intact.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "payments-delete");
  if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // Verify admin session
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Admin access required" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    const payment = await db.payment.findUnique({ where: { id } });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Delete the payment record ONLY (subscription stays intact)
    await db.payment.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Payment deleted successfully. Subscription is preserved." });
  } catch (error) {
    console.error("Delete payment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
