import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { validateAdminCode } from "@/lib/admin-code";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

/**
 * Firebase connectivity check endpoint (ADMIN ONLY).
 * Tests if the Firebase API key, auth handler, and Google sign-in are reachable.
 * Requires admin authentication — exposes infrastructure details.
 */
export async function GET(request: NextRequest) {
  // Rate limiting: max 5 checks per 5 minutes per IP
  const rlKey = rateLimitKey(request, "firebase-check");
  if (isRateLimited(rlKey, { max: 5, windowMs: 5 * 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // Require admin auth
  const adminId = await requireAdmin();
  const adminCode = request.headers.get("X-Admin-Code");
  const codeValid = await validateAdminCode(adminCode);

  if (!adminId && !codeValid) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 401 }
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      overall: "MISCONFIGURED",
      error: "Firebase API key not configured",
    });
  }

  const results: Record<string, { ok: boolean; status?: number; latency?: number; [key: string]: unknown }> = {};

  // 1. Test Firebase API Key validity
  try {
    const start = Date.now();
    const res = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );
    results.apiKey = {
      ok: res.ok,
      status: res.status,
      latency: Date.now() - start,
    };
    if (res.ok) {
      const data = await res.json();
      const authorizedDomains: string[] = data.authorizedDomains || [];
      const vercelDomain = process.env.NEXT_PUBLIC_VERCEL_URL || "healing-space-henna.vercel.app";
      const domainOk = authorizedDomains.includes(vercelDomain);
      results.apiKey.ok = domainOk;
      // Don't expose the full list of authorized domains — just whether our domain is included
      results.apiKey.domainCheck = domainOk
        ? `${vercelDomain} is authorized`
        : `${vercelDomain} is NOT authorized!`;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    results.apiKey = { ok: false, error: message };
  }

  // 2. Test Google sign-in provider
  try {
    const start = Date.now();
    const vercelDomain = process.env.NEXT_PUBLIC_VERCEL_URL || "healing-space-henna.vercel.app";
    const res = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/createAuthUri?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: "google.com",
          continueUri: `https://${vercelDomain}`,
        }),
        signal: AbortSignal.timeout(10000),
      }
    );
    results.googleProvider = {
      ok: res.ok,
      status: res.status,
      latency: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    results.googleProvider = { ok: false, error: message };
  }

  // 3. Test Firebase Auth Handler page
  try {
    const start = Date.now();
    const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "";
    if (firebaseAuthDomain) {
      const res = await fetch(
        `https://${firebaseAuthDomain}/__/auth/handler`,
        { signal: AbortSignal.timeout(10000) }
      );
      results.authHandler = {
        ok: res.ok,
        status: res.status,
        latency: Date.now() - start,
      };
    } else {
      results.authHandler = { ok: false, error: "No auth domain configured" };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    results.authHandler = { ok: false, error: message };
  }

  // 4. Test Google Identity Services
  try {
    const start = Date.now();
    const res = await fetch("https://apis.google.com/js/api.js", {
      signal: AbortSignal.timeout(10000),
    });
    results.googleApis = {
      ok: res.ok,
      status: res.status,
      latency: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    results.googleApis = { ok: false, error: message };
  }

  // 5. Test securetoken.googleapis.com
  try {
    const start = Date.now();
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "refresh_token", refresh_token: "test" }),
        signal: AbortSignal.timeout(10000),
      }
    );
    results.secureToken = {
      ok: res.status !== 0,
      status: res.status,
      latency: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error";
    results.secureToken = { ok: false, error: message };
  }

  const allOk = Object.values(results).every((r) => r.ok);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    overall: allOk ? "ALL_CHECKS_PASSED" : "SOME_CHECKS_FAILED",
    checks: results,
    troubleshooting: allOk
      ? undefined
      : {
          apiKeyFailed: "Firebase API key is invalid or project doesn't exist. Generate a new key in Firebase Console.",
          googleProviderFailed: "Google sign-in provider is not enabled. Enable it in Firebase Console > Authentication > Sign-in method.",
          authHandlerFailed: "Firebase auth handler is unreachable. This usually indicates a network/firewall issue blocking *.firebaseapp.com.",
          googleApisFailed: "Google APIs (apis.google.com) is unreachable. This may be blocked by firewall or ISP.",
          secureTokenFailed: "securetoken.googleapis.com is unreachable. Token exchange will fail.",
        },
  });
}
