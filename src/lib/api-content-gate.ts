/**
 * API Content Gate
 *
 * Protects premium content from being accessed through the API
 * by unauthenticated or unsubscribed users.
 *
 * For each content type, checks if the requesting user is authenticated
 * and has an active subscription (or purchase) that covers the content.
 * If not, sensitive fields (article body, media URLs, etc.) are stripped
 * from the response.
 */

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { canAccessContent, type ContentType } from "@/lib/content-access";

// ---------------------------------------------------------------
// Fields to strip per content type
// ---------------------------------------------------------------

const SENSITIVE_FIELDS: Record<string, string[]> = {
  articles: ["content", "contentAr", "contentFr", "contentEn"],
  videos: ["videoUrl"],
  podcasts: ["audioUrl"],
  pdfs: ["pdfUrl", "fileUrl"],
  live: ["streamUrl", "zoomUrl"],
  courses: [], // Course itself has no sensitive fields; lessons do
};

const LESSON_SENSITIVE_FIELDS = ["videoUrl", "content", "contentAr", "contentFr", "contentEn"];

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface AccessContext {
  userId: string | null;
  isAdmin: boolean;
  activePlans: string[];
  purchasedContentIds: Set<string>;
}

// ---------------------------------------------------------------
// Resolve the access context from the request session
// ---------------------------------------------------------------

async function resolveAccessContext(): Promise<AccessContext> {
  const session = await getSession();
  const userId = session.userId || null;
  const isAdmin = session.isAdmin === true;

  if (!userId) {
    return { userId: null, isAdmin: false, activePlans: [], purchasedContentIds: new Set() };
  }

  if (isAdmin) {
    // Admins get full access — no need to query subscriptions/purchases
    return { userId, isAdmin: true, activePlans: [], purchasedContentIds: new Set() };
  }

  // Fetch active subscriptions
  const now = new Date();
  const subscriptions = await db.subscription.findMany({
    where: { userId, status: "active" },
  });
  const activePlans = subscriptions
    .filter((sub: { status?: string; endDate?: string }) =>
      sub.status === "active" && sub.endDate && new Date(sub.endDate) > now
    )
    .map((sub: { type: string }) => sub.type);

  // Fetch individual purchases
  const purchases = await db.purchase.findMany({
    where: { userId, status: "active" },
  });
  const purchasedContentIds: Set<string> = new Set(
    purchases.map((p: Record<string, any>) => String(p.contentId || ""))
  );

  return { userId, isAdmin, activePlans, purchasedContentIds };
}

// ---------------------------------------------------------------
// Check if a single content item should be fully visible
// ---------------------------------------------------------------

function itemIsAccessible(
  ctx: AccessContext,
  contentType: ContentType,
  item: Record<string, any>
): boolean {
  // Admin → always accessible
  if (ctx.isAdmin) return true;

  // Free content → always accessible
  const isFree = item.isFree === true || (item.price === undefined && item.price !== 0);
  if (isFree) return true;

  // Individually purchased → accessible
  if (item.id && ctx.purchasedContentIds.has(item.id)) return true;

  // Check subscription access
  if (canAccessContent(null, contentType, false, ctx.activePlans)) {
    // canAccessContent with null user + activePlans still checks plans correctly
    // But we need to pass a user-like object for the fallback path.
    // Since we already extracted activePlans, let's just check directly.
    return true;
  }

  // Also check if any active plan covers this content type
  if (ctx.activePlans.includes("full") || ctx.activePlans.includes(contentType)) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------
// Strip sensitive fields from an item (mutates the object)
// ---------------------------------------------------------------

function stripFields(item: Record<string, any>, fields: string[]): Record<string, any> {
  for (const field of fields) {
    if (field in item) {
      item[field] = null;
    }
  }
  return item;
}

// ---------------------------------------------------------------
// Public API: gate a list of content items
// ---------------------------------------------------------------

export async function gateContentList(
  items: Record<string, any>[],
  contentType: ContentType
): Promise<Record<string, any>[]> {
  const ctx = await resolveAccessContext();

  // Admins see everything
  if (ctx.isAdmin) return items;

  const fieldsToStrip = SENSITIVE_FIELDS[contentType] || [];

  return items.map((item) => {
    if (itemIsAccessible(ctx, contentType, item)) {
      return item;
    }
    // Clone to avoid mutating cached data
    const clone = { ...item };
    return stripFields(clone, fieldsToStrip);
  });
}

// ---------------------------------------------------------------
// Public API: gate a single content item
// ---------------------------------------------------------------

export async function gateContentItem(
  item: Record<string, any>,
  contentType: ContentType
): Promise<Record<string, any>> {
  const ctx = await resolveAccessContext();

  // Admins see everything
  if (ctx.isAdmin) return item;

  const fieldsToStrip = SENSITIVE_FIELDS[contentType] || [];

  if (itemIsAccessible(ctx, contentType, item)) {
    return item;
  }

  const clone = { ...item };
  return stripFields(clone, fieldsToStrip);
}

// ---------------------------------------------------------------
// Public API: gate course lessons within a course detail response
// ---------------------------------------------------------------

export async function gateCourseLessons(
  course: Record<string, any>
): Promise<Record<string, any>> {
  const ctx = await resolveAccessContext();

  // Admins see everything
  if (ctx.isAdmin) return course;

  // Check if the user can access the course itself
  const courseAccessible = itemIsAccessible(ctx, "courses", course);

  // Clone to avoid mutating cached data
  const clone = { ...course };

  if (clone.chapters && Array.isArray(clone.chapters)) {
    clone.chapters = clone.chapters.map((chapter: Record<string, any>) => {
      if (!chapter.lessons || !Array.isArray(chapter.lessons)) return chapter;
      const chapterClone = { ...chapter };
      chapterClone.lessons = chapterClone.lessons.map((lesson: Record<string, any>) => {
        // If the course is accessible, lessons are too
        if (courseAccessible) return lesson;
        // Free lessons are always accessible
        if (lesson.isFree === true) return lesson;
        // Individually purchased lessons
        if (lesson.id && ctx.purchasedContentIds.has(lesson.id)) return lesson;
        // Otherwise strip sensitive fields
        const lessonClone = { ...lesson };
        return stripFields(lessonClone, LESSON_SENSITIVE_FIELDS);
      });
      return chapterClone;
    });
  }

  return clone;
}
