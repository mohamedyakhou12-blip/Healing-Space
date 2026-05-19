import { NextResponse } from "next/server";

/**
 * Google Search Console verification endpoint.
 *
 * When you add your site to Google Search Console, Google asks you to verify
 * ownership. One method is to add a meta tag, another is to host a specific
 * HTML file. This route serves the verification content.
 *
 * To use:
 * 1. Go to Google Search Console → Add property → https://healing-space-app.vercel.app
 * 2. Choose "HTML tag" verification method
 * 3. Copy the verification code (e.g., "abc123def456")
 * 4. Add it as environment variable: GOOGLE_VERIFICATION_CODE=abc123def456
 * 5. Redeploy
 *
 * Alternatively, the meta tag is already in layout.tsx and reads from
 * the same environment variable.
 */
export async function GET() {
  const code = process.env.GOOGLE_VERIFICATION_CODE || "your-google-verification-code";

  // Google expects a specific file at /googleVERIFICATIONCODE.html
  return NextResponse.json({
    verification: code,
    message: "This endpoint confirms site ownership. The verification code is also available in the meta tag.",
  });
}
