/**
 * Site Configuration — Single source of truth for the site URL.
 *
 * All pages and utilities should import SITE_URL from here
 * instead of defining their own fallback.
 *
 * The domain is determined by:
 *  1. NEXT_PUBLIC_SITE_URL env var (set in Vercel)
 *  2. Hardcoded fallback (the current production domain)
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://healing-space-henna.vercel.app";
