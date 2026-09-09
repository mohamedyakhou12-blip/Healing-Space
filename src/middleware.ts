import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware: Protects API routes and manages CORS.
 * Since this is an SPA app (all routes rewritten to "/"),
 * we protect API routes and add security headers.
 */

// Private routes that REQUIRE a session cookie at the middleware layer.
// Public content read endpoints (/api/courses, /api/articles, /api/podcasts,
// /api/videos, /api/pdfs, /api/live, /api/coaching(s), /api/reviews) are NOT
// listed here: guests must be able to browse published content, and every
// mutation (POST/PUT/DELETE) is already protected inside each route handler
// via requireAuth()/requireAdmin()/verifyAdminAccess().
const PROTECTED_API_ROUTES = [
  "/api/auth/profile",
  "/api/auth/logout",
  "/api/subscriptions",
  "/api/payments",
  "/api/purchases",
  "/api/notifications",
  "/api/upload",
  "/api/prices",
];

const ADMIN_API_ROUTES = ["/api/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const isPublic = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/session",
    "/api/auth/verify-admin",
    "/api/csrf-token",
    "/api/public-settings",
    "/api/sliders",
    "/api/homepage-images",
  ].some((route) => pathname === route || pathname.startsWith(route + "/"));

  if (isPublic) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_API_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAdmin = ADMIN_API_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected || isAdmin) {
    const sessionCookie = request.cookies.get("healing_session");

    if (!sessionCookie || !sessionCookie.value) {
      if (isAdmin) {
        const adminCode = request.headers.get("x-admin-code");
        if (!adminCode) {
          return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
          );
        }
        return NextResponse.next();
      }

      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
  }

  const response = NextResponse.next();

  // Restrict CORS to the site's own origin only. Reflecting any arbitrary
  // Origin alongside Access-Control-Allow-Credentials would let a malicious
  // site read (credentialed) responses of private APIs keyed by the victim's
  // session cookie (subscriptions, payments, notifications, ...). Same-origin
  // requests do not need these headers, so preview deployments keep working.
  const allowedOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://healing-space-henna.vercel.app";
  const origin = request.headers.get("origin");
  if (origin && origin === allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-CSRF-Token, X-Admin-Code"
  );

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};