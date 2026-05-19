import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { cached, invalidateContentCache } from "@/lib/cache";

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

    const data = await cached("api:admin:stats", async () => {
      // Run ALL independent queries in parallel (was 12+ sequential, now parallel)
      const [
        activeSubsAll,
        totalMembers,
        activeMembers,
        totalCourses,
        pendingPayments,
        pendingPurchases,
        allReviews,
        totalArticles,
        totalPodcasts,
        totalVideos,
        totalPdfs,
        totalLiveSessions,
        recentPayments,
      ] = await Promise.all([
        db.subscription.findMany({ where: { status: "active" } }),
        db.user.count(),
        db.user.count({ where: { isActive: true } }),
        db.course.count(),
        db.payment.count({ where: { status: "pending" } }),
        db.purchase.findMany({ where: { status: "pending" } }),
        db.review.findMany({}),
        db.article.count(),
        db.podcast.count(),
        db.video.count(),
        db.pdfResource.count(),
        db.liveSession.count(),
        db.payment.findMany({ take: 10, include: { user: true } }),
      ]);

      const now = new Date();
      const trulyActiveSubscriptions = activeSubsAll.filter(
        (sub: { endDate?: string }) => sub.endDate && new Date(sub.endDate) > now
      ).length;

      const avgRating =
        allReviews.length > 0
          ? allReviews.reduce(
              (sum: number, r: any) => sum + (r.rating || 0),
              0
            ) / allReviews.length
          : 0;

      return {
        stats: {
          totalMembers,
          activeMembers,
          totalCourses,
          activeSubscriptions: trulyActiveSubscriptions,
          pendingPayments: pendingPayments + pendingPurchases.length,
          avgRating: Math.round(avgRating * 10) / 10,
          totalReviews: allReviews.length,
          totalArticles,
          totalPodcasts,
          totalVideos,
          totalPdfs,
          totalLiveSessions,
        },
        recentPayments,
      };
    }, 15_000); // Short TTL for admin stats (15s)

    return NextResponse.json(data);
  } catch (error) {
    console.error("Fetch admin stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
