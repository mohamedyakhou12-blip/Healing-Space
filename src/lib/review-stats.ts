/**
 * Batch review statistics utility.
 * Replaces N+1 queries with a single query + in-memory grouping.
 */
import { adminDb } from "./firebase-admin";
import { normalizeDoc } from "./db-normalize";

/**
 * Fetch all reviews for multiple content IDs at once and compute stats.
 * Returns a Map of contentId -> { avgRating, reviewCount }
 *
 * This replaces the pattern of:
 *   for each item: fetch reviews -> compute avg  (N+1 queries)
 * With:
 *   fetch all reviews once -> group by contentId -> compute avg  (1 query)
 */
export async function batchReviewStats(
  contentType: "article" | "course" | "podcast" | "video",
  contentIds: string[]
): Promise<Map<string, { avgRating: number; reviewCount: number }>> {
  const result = new Map<string, { avgRating: number; reviewCount: number }>();

  if (contentIds.length === 0) return result;

  // Initialize all IDs with 0 stats
  for (const id of contentIds) {
    result.set(id, { avgRating: 0, reviewCount: 0 });
  }

  try {
    // Determine the field name based on content type
    const fieldName = `${contentType}Id`;

    // Fetch all reviews for these content IDs in batches
    // Firestore 'in' queries support max 30 items per query
    const BATCH_SIZE = 30;
    const allReviews: any[] = [];

    for (let i = 0; i < contentIds.length; i += BATCH_SIZE) {
      const batchIds = contentIds.slice(i, i + BATCH_SIZE);
      const snap = await adminDb
        .collection("reviews")
        .where(fieldName, "in", batchIds)
        .get();

      for (const doc of snap.docs) {
        allReviews.push(normalizeDoc({ id: doc.id, ...doc.data() }));
      }
    }

    // Group reviews by content ID and compute stats
    const grouped = new Map<string, number[]>();
    for (const review of allReviews) {
      const cId = review[fieldName];
      if (!cId) continue;
      if (!grouped.has(cId)) grouped.set(cId, []);
      grouped.get(cId)!.push(review.rating || 0);
    }

    for (const [cId, ratings] of grouped) {
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0;
      result.set(cId, { avgRating, reviewCount: ratings.length });
    }
  } catch (error) {
    console.error("Batch review stats error:", error);
    // Return 0 stats on error rather than failing the whole request
  }

  return result;
}
