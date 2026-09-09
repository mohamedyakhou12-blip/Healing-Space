import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware: Protects API routes and manages CORS.
 * Since this is an SPA app (all routes rewritten to "/"),
 * we protect API routes and add security headers.
 */

const PROTECTED_API_ROUTES = [
  "/api/auth/profile",
  "/api/auth/logout",
  "/api/courses",
  "/api/articles",
  "/api/podcasts",
  "/api/videos",
  "/api/pdfs",
  "/api/live",
  "/api/coaching",
  "/api/subscriptions",
  "/api/payments",
  "/api/reviews",
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
  response.headers.set(
    "Access-Control-Allow-Origin",
    request.headers.get("origin") || "*"
  );
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-CSRF-Token, X-Admin-Code"
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};