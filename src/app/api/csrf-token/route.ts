import { NextResponse } from "next/server";
import { generateCSRFToken, getCSRFCookieName } from "@/lib/csrf";

/**
 * GET /api/csrf-token
 *
 * Generates a new CSRF token, sets it as a cookie, and returns it.
 * The frontend must call this endpoint on app initialization to obtain
 * the token, then include it in the X-CSRF-Token header on all mutating requests.
 *
 * The cookie is set with:
 * - SameSite=Strict (never sent on cross-origin requests)
 * - Secure=true (HTTPS only, in production)
 * - Path=/ (available to all routes)
 * - HttpOnly=false (JavaScript MUST be able to read it for the header)
 */
export async function GET() {
  const token = generateCSRFToken();
  const cookieName = getCSRFCookieName();

  const response = NextResponse.json({
    csrfToken: token,
    success: true,
  });

  // Set CSRF cookie — NOT HttpOnly because JS needs to read it for the header
  // But this is fine because the security model depends on comparing
  // cookie value with custom header value, not on hiding the cookie.
  response.cookies.set(cookieName, token, {
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days, matches session duration
  });

  return response;
}
