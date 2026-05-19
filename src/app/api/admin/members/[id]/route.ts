import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminDb } from "@/lib/firebase-admin";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

/**
 * DELETE /api/admin/members/[id]
 *
 * Admin-only: Delete a user and all their associated data.
 * - Deletes user's notifications, reviews, purchases, payments, subscriptions
 * - Then deletes the user itself
 * - Cannot delete admin users (safety measure)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "admin-members-delete");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
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
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Cannot delete admin users
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.role === "admin") {
      return NextResponse.json({ error: "Cannot delete admin users" }, { status: 403 });
    }

    // Delete related data using Firestore directly (batch delete)
    const collections = ["notifications", "reviews", "purchases", "payments", "subscriptions"];
    for (const col of collections) {
      try {
        const snap = await adminDb.collection(col).where("userId", "==", id).get();
        const batch = adminDb.batch();
        snap.docs.forEach((doc: any) => batch.delete(doc.ref));
        if (snap.docs.length > 0) await batch.commit();
      } catch (e) {
        console.error(`Failed to delete ${col} for user ${id}:`, e);
      }
    }

    // Delete user (use Firestore directly since db.user has no delete method)
    await adminDb.collection("users").doc(id).delete();

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete member error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
