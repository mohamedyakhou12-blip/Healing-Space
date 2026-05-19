/**
 * Google Indexing Notification Utility
 *
 * When admin updates content, this pings Google to re-crawl the affected pages.
 * Uses Google's sitemap ping and the Indexing API (if configured).
 */

import { SITE_URL } from "@/lib/site-config";

/** Map of content types to their URL paths */
const CONTENT_PATHS: Record<string, string> = {
  courses: "/courses",
  articles: "/articles",
  podcasts: "/podcasts",
  videos: "/videos",
  pdfs: "/pdfs",
  live: "/live",
  sliders: "/",
  settings: "/",
  homepage: "/",
  subscriptions: "/subscriptions",
  prices: "/subscriptions",
};

/**
 * Ping Google to notify that a sitemap has been updated.
 * This tells Google to re-fetch the sitemap and discover changed pages.
 *
 * @returns true if ping succeeded, false otherwise
 */
export async function pingGoogleSitemap(): Promise<boolean> {
  try {
    const sitemapUrl = `${SITE_URL}/sitemap.xml`;
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

    const response = await fetch(pingUrl, {
      method: "GET",
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    console.log("[Google Ping] Sitemap ping status:", response.status);
    return response.status === 200;
  } catch (error) {
    console.warn("[Google Ping] Sitemap ping failed:", error);
    return false;
  }
}

/**
 * Notify Google that specific content has been updated.
 * Pings the sitemap and optionally specific page URLs.
 *
 * @param contentType - The type of content that was updated (e.g., "courses", "articles")
 * @param specificUrl - Optional specific URL that was updated
 */
export async function notifyGoogleUpdate(
  contentType?: string,
  specificUrl?: string
): Promise<void> {
  // Always ping the sitemap
  const sitemapPinged = await pingGoogleSitemap();

  if (sitemapPinged) {
    console.log(`[Google Notify] Sitemap pinged for content type: ${contentType || "general"}`);
  }

  // If we know the specific page, ping it too
  if (contentType && CONTENT_PATHS[contentType]) {
    const pageUrl = `${SITE_URL}${CONTENT_PATHS[contentType]}`;
    try {
      // Ping the specific page URL through Google's crawl mechanism
      const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(pageUrl)}`;
      await fetch(pingUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      console.log(`[Google Notify] Pinged specific page: ${pageUrl}`);
    } catch {
      // Ignore - best effort
    }
  }

  // If a specific URL was provided, ping it directly
  if (specificUrl) {
    try {
      const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(specificUrl)}`;
      await fetch(pingUrl, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });
      console.log(`[Google Notify] Pinged specific URL: ${specificUrl}`);
    } catch {
      // Ignore - best effort
    }
  }
}
