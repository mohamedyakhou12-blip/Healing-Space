/**
 * Content Access Control
 *
 * Determines whether a user can access specific content based on their subscription.
 *
 * Subscription types: "full", "courses", "articles", "podcasts", "videos", "pdfs", "live"
 * Content types: "courses", "articles", "podcasts", "videos", "pdfs", "live"
 *
 * Rules:
 * - Free content (isFree === true) is always accessible
 * - Users with "full" subscription can access content types specified in fullPlanIncludes
 *   EXCEPT items listed in fullPlanExcludedItems (per-item granularity)
 * - Users with multiple subscriptions can access all subscribed content types
 * - Users with a specific subscription (e.g., "courses") can only access that content type
 * - Admins can access everything
 * - Individual purchases grant permanent access to specific content items
 */

export type SubscriptionType = "full" | "courses" | "articles" | "podcasts" | "videos" | "pdfs" | "live" | "coaching";
export type ContentType = "courses" | "articles" | "podcasts" | "videos" | "pdfs" | "live" | "coaching";

export const ALL_CONTENT_TYPES: ContentType[] = ["courses", "articles", "podcasts", "videos", "pdfs", "live", "coaching"];

/**
 * Get the default set of content types included in the full plan
 */
export function getDefaultFullPlanIncludes(): ContentType[] {
  return ["courses", "articles", "podcasts", "videos", "pdfs", "live", "coaching"];
}

/**
 * Represents a single excluded item from the full plan.
 * When a content type is included in fullPlanIncludes, the admin can still
 * exclude specific items by adding them to the excluded list.
 */
export interface ExcludedItem {
  id: string;        // Content item ID
  type: ContentType; // Content type (for quick lookup)
}

interface UserSubscription {
  plan: string;
  status: "active" | "expired" | "none";
  expiresAt?: string;
}

interface User {
  id: string;
  role?: string;
  subscription?: UserSubscription;
}

/**
 * Check if a user can access a specific content type
 * Supports both single subscription and multiple active subscription plans
 *
 * fullPlanIncludes: Optional array of content types included in the "full" plan.
 *   When provided and non-empty, a "full" subscription only grants access to
 *   the listed content types. When omitted or empty, defaults to ALL content
 *   types (backward compatible).
 */
export function canAccessContent(
  user: User | null,
  contentType: ContentType,
  isFree: boolean,
  activePlans?: string[],
  fullPlanIncludes?: ContentType[]
): boolean {
  // Free content is always accessible
  if (isFree) return true;

  // No user = guest access only (free content)
  if (!user) return false;

  // Admins can access everything
  if (user.role === "admin") return true;

  // Check activePlans array first (supports multiple subscriptions)
  if (activePlans && activePlans.length > 0) {
    // "full" subscription = access to included content types only
    if (activePlans.includes("full")) {
      const included = fullPlanIncludes && fullPlanIncludes.length > 0 ? fullPlanIncludes : ALL_CONTENT_TYPES;
      if (included.includes(contentType)) return true;
    }
    // Check if any active plan matches the content type
    return activePlans.includes(contentType);
  }

  // Fallback: single subscription check (backward compatibility)
  // No subscription = no access to paid content
  if (!user.subscription || user.subscription.status !== "active") return false;

  // Check if subscription has expired
  // SECURITY: Missing expiresAt = expired (not never-expiring)
  if (!user.subscription.expiresAt) return false;
  const expiresAt = new Date(user.subscription.expiresAt);
  if (expiresAt.getTime() <= Date.now()) return false;

  // Full subscription = access to included content types only
  if (user.subscription.plan === "full") {
    const included = fullPlanIncludes && fullPlanIncludes.length > 0 ? fullPlanIncludes : ALL_CONTENT_TYPES;
    return included.includes(contentType);
  }

  // Specific subscription must match content type
  return user.subscription.plan === contentType;
}

/**
 * Check if a user has a valid (non-expired) active subscription
 */
export function hasValidSubscription(user: User | null): boolean {
  if (!user?.subscription) return false;
  if (user.subscription.status !== "active") return false;
  // SECURITY: Missing expiresAt = expired
  if (!user.subscription.expiresAt) return false;
  const expiresAt = new Date(user.subscription.expiresAt);
  if (expiresAt.getTime() <= Date.now()) return false;
  return true;
}

/**
 * Check if a user can access a specific content item (by ID) or via subscription.
 * Also checks if the specific contentId is in the purchasedContentIds array.
 * Supports both single and multiple active subscription plans.
 *
 * fullPlanExcludedItems: Optional array of items excluded from the full plan.
 *   Even if a content type is in fullPlanIncludes, specific items can be excluded.
 *   This gives the admin per-item granularity over what's in the full plan.
 *   When omitted or empty, no items are excluded (backward compatible).
 */
export function canAccessContentById(
  user: User | null,
  contentType: ContentType,
  contentId: string,
  isFree: boolean,
  purchasedContentIds: string[],
  activePlans?: string[],
  fullPlanIncludes?: ContentType[],
  fullPlanExcludedItems?: ExcludedItem[]
): boolean {
  // Free content is always accessible
  if (isFree) return true;

  // No user = guest access only (free content)
  if (!user) return false;

  // Admins can access everything
  if (user.role === "admin") return true;

  // Check if the specific content was purchased (permanent access)
  if (purchasedContentIds && purchasedContentIds.includes(contentId)) {
    return true;
  }

  // Check if this specific item is excluded from the full plan
  // Only applies when user has a "full" subscription
  const hasFullPlan = activePlans && activePlans.length > 0 && activePlans.includes("full");
  if (hasFullPlan && fullPlanExcludedItems && fullPlanExcludedItems.length > 0) {
    const isExcluded = fullPlanExcludedItems.some(item => item.id === contentId);
    if (isExcluded) {
      // Item is excluded from the full plan, but other plan types might still grant access
      // Check if any non-full plan covers this content type
      const nonFullPlans = activePlans.filter(p => p !== "full");
      if (nonFullPlans.includes(contentType)) return true;
      // Also check fallback single subscription
      if (user.subscription?.plan === contentType && user.subscription?.status === "active") {
        if (user.subscription.expiresAt && new Date(user.subscription.expiresAt).getTime() > Date.now()) {
          return true;
        }
      }
      return false;
    }
  }

  // Fall back to subscription-based check
  return canAccessContent(user, contentType, isFree, activePlans, fullPlanIncludes);
}

/**
 * Get the content type label in Arabic
 */
export function getContentTypeLabel(contentType: ContentType, locale: string): string {
  const labels: Record<ContentType, { ar: string; en: string; fr: string }> = {
    courses: { ar: "الدورات", en: "Courses", fr: "Cours" },
    articles: { ar: "المقالات", en: "Articles", fr: "Articles" },
    podcasts: { ar: "البودكاست", en: "Podcasts", fr: "Podcasts" },
    videos: { ar: "الفيديوهات", en: "Videos", fr: "Vidéos" },
    pdfs: { ar: "الكتب الإلكترونية", en: "E-books", fr: "E-books" },
    live: { ar: "البث المباشر", en: "Live Sessions", fr: "Sessions en direct" },
    coaching: { ar: "كوتشنغ", en: "Coaching", fr: "Coaching" },
  };
  const label = labels[contentType] || labels.courses;
  return label[locale as keyof typeof label] || label.ar;
}
