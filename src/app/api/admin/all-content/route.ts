import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { cached } from "@/lib/cache";
import { batchReviewStats } from "@/lib/review-stats";

/**
 * GET /api/admin/all-content
 * 
 * Fetches ALL content types in a single request (used by admin dashboard).
 * Returns courses, articles, podcasts, videos, pdfs, and liveSessions.
 * Uses server-side caching to reduce Firestore reads.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin session first
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    const data = await cached("api:admin:all-content", async () => {
      // Fetch all content types in parallel
      const [courses, articles, podcasts, videos, pdfs, liveSessions, coachings] = await Promise.all([
        db.course.findMany({ include: { chapters: true } }),
        db.article.findMany({ include: { _count: true } }),
        db.podcast.findMany({ include: { _count: true } }),
        db.video.findMany({ include: { _count: true } }),
        db.pdfResource.findMany(),
        db.liveSession.findMany(),
        db.coaching.findMany(),
      ]);

      // Batch fetch review stats for all content types at once
      const [courseStats, articleStats, podcastStats, videoStats] = await Promise.all([
        batchReviewStats("course", courses.map((c: any) => c.id)),
        batchReviewStats("article", articles.map((a: any) => a.id)),
        batchReviewStats("podcast", podcasts.map((p: any) => p.id)),
        batchReviewStats("video", videos.map((v: any) => v.id)),
      ]);

      // Merge review stats into content items
      const coursesWithStats = courses.map((c: any) => {
        const stats = courseStats.get(c.id) || { avgRating: 0, reviewCount: 0 };
        return { ...c, avgRating: stats.avgRating, reviewCount: stats.reviewCount };
      });
      const articlesWithStats = articles.map((a: any) => {
        const stats = articleStats.get(a.id) || { avgRating: 0, reviewCount: 0 };
        return { ...a, avgRating: stats.avgRating, reviewCount: stats.reviewCount };
      });
      const podcastsWithStats = podcasts.map((p: any) => {
        const stats = podcastStats.get(p.id) || { avgRating: 0, reviewCount: 0 };
        return { ...p, avgRating: stats.avgRating, reviewCount: stats.reviewCount };
      });
      const videosWithStats = videos.map((v: any) => {
        const stats = videoStats.get(v.id) || { avgRating: 0, reviewCount: 0 };
        return { ...v, avgRating: stats.avgRating, reviewCount: stats.reviewCount };
      });

      return {
        courses: coursesWithStats,
        articles: articlesWithStats,
        podcasts: podcastsWithStats,
        videos: videosWithStats,
        pdfs,
        liveSessions,
        coachings,
      };
    }, 15_000); // 15s TTL for admin content

    return NextResponse.json(data);
  } catch (error) {
    console.error("Fetch admin all-content error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
