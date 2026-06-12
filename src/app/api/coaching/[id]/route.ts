import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

// GET /api/coaching/[id] — Public: get single coaching item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const coaching = await db.coaching.findUnique({ where: { id } });
    if (!coaching) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, coaching });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PUT /api/coaching/[id] — Admin: update coaching item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rlKey = rateLimitKey(request, "coaching-put");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const coaching = await db.coaching.update({ where: { id }, data: body });
    return NextResponse.json({ success: true, coaching });
  } catch (error) {
    console.error("Update coaching error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE /api/coaching/[id] — Admin: delete coaching item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rlKey = rateLimitKey(request, "coaching-delete");
  if (isRateLimited(rlKey, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });

    const { id } = await params;
    await db.coaching.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete coaching error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
