import { NextRequest, NextResponse } from "next/server";
import {
  validateCSRFToken,
  getCSRFCookieName,
  getCSRFHeaderName,
  isCSRFExemptPath,
} from "@/lib/csrf";

/**
 * Security proxy for Next.js 16.
 *
 * Protections:
 * 1. Rate limiting — per IP, with granular limits per route category
 * 2. CSRF Token — Double-Submit Cookie pattern (cookie + custom header)
 * 3. CSRF Origin — rejects cross-origin POST/PUT/DELETE/PATCH (checks Origin/Referer)
 * 4. Body size limit — rejects oversized payloads (max 10MB)
 * 5. Method validation — only standard HTTP methods allowed
 * 6. Security headers — X-Content-Type-Options, X-Frame-Options, etc.
 * 7. X-Request-ID — unique per request for tracing
 * 8. Suspicious user-agent detection
 */

// ── Rate Limiting ──
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // per minute for general
const MAX_AUTH_REQUESTS = 10; // per minute for auth routes
const MAX_ADMIN_REQUESTS = 20; // per minute for admin routes
const MAX_CONTENT_REQUESTS = 30; // per minute for content CRUD routes
const MAX_PAYMENT_REQUESTS = 10; // per minute for payment routes
const MAX_REVIEW_REQUESTS = 15; // per minute for review routes

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.lastReset > RATE_LIMIT_WINDOW * 10) {
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

function checkRateLimit(ip: string, max: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true;
  }

  entry.count++;
  if (entry.count > max) return false;
  return true;
}

// ── CSRF Origin Protection ──
const ALLOWED_ORIGINS = [
  // Production
  "https://healing-space-henna.vercel.app",
  // Old production URL (redirected from, keep for compatibility)
  "https://healing-space-app.vercel.app",
  // Legacy production URL (keep for existing users)
  "https://my-project-mu-five-35.vercel.app",
  // Vercel preview deployments
  ".vercel.app",
  // Local development
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some((allowed) => {
    if (allowed.startsWith(".")) {
      return origin.endsWith(allowed) || origin.includes(allowed.slice(1));
    }
    return origin === allowed;
  });
}

// ── Constants ──
const MAX_BODY_SIZE = 10 * 1024 * 1024;        // 10 MB for regular API
const MAX_UPLOAD_BODY_SIZE = 1100 * 1024 * 1024; // 1.1 GB for file uploads (slightly above 1GB to account for form overhead)

/**
 * Determine the rate limit category for a given API path
 */
function getRateLimitCategory(path: string): { prefix: string; max: number } {
  if (path.startsWith("/api/auth/")) {
    return { prefix: "auth", max: MAX_AUTH_REQUESTS };
  }
  if (path.startsWith("/api/admin/")) {
    return { prefix: "admin", max: MAX_ADMIN_REQUESTS };
  }
  if (path.startsWith("/api/cloudinary/")) {
    return { prefix: "admin", max: MAX_ADMIN_REQUESTS }; // Cloudinary signature is admin-only
  }
  if (path.startsWith("/api/upload")) {
    return { prefix: "admin", max: MAX_ADMIN_REQUESTS }; // Upload is admin/user-only
  }
  if (path.startsWith("/api/payments") || path.startsWith("/api/purchases") || path.startsWith("/api/subscriptions")) {
    return { prefix: "payment", max: MAX_PAYMENT_REQUESTS };
  }
  if (path.startsWith("/api/reviews")) {
    return { prefix: "review", max: MAX_REVIEW_REQUESTS };
  }
  // Content CRUD routes: courses, articles, podcasts, videos, pdfs, live, sliders
  const contentPaths = ["/api/courses", "/api/articles", "/api/podcasts", "/api/videos", "/api/pdfs", "/api/live", "/api/sliders"];
  if (contentPaths.some((cp) => path.startsWith(cp))) {
    return { prefix: "content", max: MAX_CONTENT_REQUESTS };
  }
  // Notifications and other routes
  return { prefix: "api", max: MAX_REQUESTS };
}

/**
 * Proxy for Next.js 16.
 * Adds rate limiting, CSRF protection, and security headers.
 */
export default function proxy(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const path = request.nextUrl.pathname;
  const method = request.method.toUpperCase();

  // ── 1. Method validation ──
  if (!["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].includes(method)) {
    return NextResponse.json(
      { error: "Method not allowed", success: false },
      { status: 405 }
    );
  }

  // ── 2. Granular Rate limiting ──
  if (path.startsWith("/api/")) {
    const { prefix, max } = getRateLimitCategory(path);
    if (!checkRateLimit(`${prefix}:${ip}`, max)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", success: false },
        { status: 429 }
      );
    }
  }

  // ── 3. CSRF Token Validation (Double-Submit Cookie) ──
  // For all state-changing methods, validate that the CSRF cookie matches the CSRF header
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method) && !isCSRFExemptPath(path)) {
    const csrfCookie = request.cookies.get(getCSRFCookieName())?.value;
    const csrfHeader = request.headers.get(getCSRFHeaderName());

    if (!validateCSRFToken(csrfCookie, csrfHeader)) {
      console.warn(
        `[SECURITY] CSRF token validation failed for ${method} ${path} from ${ip}. ` +
        `Cookie: ${csrfCookie ? "present" : "missing"}, Header: ${csrfHeader ? "present" : "missing"}`
      );
      return NextResponse.json(
        {
          error: "CSRF token validation failed. Please refresh the page and try again.",
          success: false,
          code: "CSRF_INVALID",
        },
        { status: 403 }
      );
    }
  }

  // ── 4. CSRF Origin Protection for state-changing methods ──
  // (Additional layer: reject if Origin/Referer is from an untrusted domain)
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");

    if (origin) {
      if (!isAllowedOrigin(origin)) {
        return NextResponse.json(
          { error: "Forbidden: Invalid origin", success: false },
          { status: 403 }
        );
      }
    } else if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (!isAllowedOrigin(refererUrl.origin)) {
          return NextResponse.json(
            { error: "Forbidden: Invalid referer", success: false },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Forbidden: Invalid referer", success: false },
          { status: 403 }
        );
      }
    } else {
      // Both Origin and Referer are missing — this is now BLOCKED
      // Previously we allowed these through, but with CSRF tokens now required,
      // requests without Origin/Referer AND without valid CSRF tokens are rejected.
      // Note: CSRF token check above already handles this case,
      // but we log it for monitoring purposes.
      console.warn(
        `[SECURITY] Mutating request without Origin/Referer: ${method} ${path} from ${ip}`
      );
    }
  }

  // ── 5. Body size check via Content-Length ──
  // Use larger limit for upload route (1GB for videos)
  const maxBodySize = (path.startsWith("/api/upload") || path.startsWith("/api/cloudinary/")) ? MAX_UPLOAD_BODY_SIZE : MAX_BODY_SIZE;
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && parseInt(contentLength, 10) > maxBodySize) {
    const maxLabel = (path.startsWith("/api/upload") || path.startsWith("/api/cloudinary/")) ? "1GB" : "10MB";
    return NextResponse.json(
      { error: `Request body too large (max ${maxLabel})`, success: false },
      { status: 413 }
    );
  }

  // ── 6. Suspicious user agent detection ──
  const userAgent = request.headers.get("user-agent") || "";
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /dirbuster/i,
    /gobuster/i,
    /wfuzz/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userAgent)) {
      console.warn(`[SECURITY] Suspicious user agent detected: ${userAgent} from ${ip}`);
      break;
    }
  }

  // ── 7. Continue request with security headers ──
  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Request-ID", crypto.randomUUID());

  // API-specific headers: prevent caching of API responses
  if (path.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }

  // Remove powered-by header
  response.headers.delete("x-powered-by");

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
  ],
};
