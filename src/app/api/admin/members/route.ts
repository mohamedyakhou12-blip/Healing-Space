import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { cached, invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    // Verify admin session first (primary auth)
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    // Secondary check: admin code header
    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const data = await cached("api:admin:members", async () => {
      // Fetch all users
      const users = await db.user.findMany();

      // Fetch ALL subscriptions and payments in parallel (instead of per-user)
      const [allSubs, allPendingPayments] = await Promise.all([
        db.subscription.findMany({ where: { status: "active" } }),
        db.payment.findMany({ where: { status: "pending" } }),
      ]);

      const now = new Date();

      // Group by userId for fast lookup
      const subsByUser = new Map<string, any[]>();
      for (const sub of allSubs) {
        if (!subsByUser.has(sub.userId)) subsByUser.set(sub.userId, []);
        subsByUser.get(sub.userId)!.push(sub);
      }

      const pendingByUser = new Map<string, number>();
      for (const pay of allPendingPayments) {
        pendingByUser.set(pay.userId, (pendingByUser.get(pay.userId) || 0) + 1);
      }

      // Enrich users using pre-fetched data (no N+1)
      const enrichedUsers = users.map((user: any) => {
        const userSubs = subsByUser.get(user.id) || [];
        const activeSubscriptions = userSubs.filter((sub: any) => {
          return sub.endDate && new Date(sub.endDate).getTime() > now.getTime();
        });

        return {
          id: user.id,
          name: user.name || "—",
          email: user.email || "—",
          phone: user.phone || "—",
          role: user.role || "user",
          isActive: user.isActive !== false,
          locale: user.locale,
          createdAt: user.createdAt,
          _count: {
            subscriptions: activeSubscriptions.length,
            payments: pendingByUser.get(user.id) || 0,
          },
          subscriptions: activeSubscriptions,
        };
      });

      return { users: enrichedUsers };
    }, 15_000); // 15s TTL

    return NextResponse.json(data);
  } catch (error) {
    console.error("Fetch members error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "admin-members-put");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // Verify admin session first (primary auth)
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    // Secondary check: admin code header
    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, isActive } = body;
    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { isActive },
    });

    // Invalidate members cache
    invalidateContentCache();

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Update member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
