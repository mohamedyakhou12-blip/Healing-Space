import { NextResponse } from "next/server";
import { getFirebaseStatus, firebaseReady } from "@/lib/firebase-admin";

/**
 * GET /api/auth/google-diag
 *
 * PUBLIC (no auth required) diagnostic endpoint for Google sign-in.
 * Helps users and developers understand why Google auth might be failing.
 * Does NOT expose any secrets — only configuration status and test results.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Firebase Client Config (these are public values, not secrets)
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";

  results.clientConfig = {
    apiKeySet: apiKey.length > 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + "..." : "NOT SET",
    authDomain: authDomain || "NOT SET (using hardcoded fallback)",
    projectId: projectId || "NOT SET (using hardcoded fallback)",
  };

  // 2. Firebase Admin SDK status
  const fbStatus = getFirebaseStatus();
  results.adminSDK = {
    ready: fbStatus.ready,
    initMethod: fbStatus.initMethod,
    error: fbStatus.initError,
    hasServiceAccountKey: fbStatus.hasServiceAccountKey,
  };

  // 3. Test Firebase API Key validity (public endpoint)
  if (apiKey) {
    try {
      const start = Date.now();
      const res = await fetch(
        `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );
      results.apiKeyTest = {
        reachable: true,
        status: res.status,
        latency: Date.now() - start,
      };
      if (res.ok) {
        try {
          const data = await res.json();
          const authorizedDomains: string[] = data.authorizedDomains || [];
          const vercelDomain = "healing-space-henna.vercel.app";
          const domainAuthorized = authorizedDomains.some(
            (d: string) => d === vercelDomain || d.includes("vercel.app")
          );
          results.apiKeyTest = {
            ...(results.apiKeyTest as Record<string, unknown>),
            valid: true,
            projectAuthorizedDomains: domainAuthorized,
            domainCount: authorizedDomains.length,
          };
        } catch {
          (results.apiKeyTest as Record<string, unknown>).valid = true;
        }
      } else {
        (results.apiKeyTest as Record<string, unknown>).valid = false;
      }
    } catch (err: any) {
      results.apiKeyTest = {
        reachable: false,
        error: err?.message || "Network error",
      };
    }
  }

  // 4. Test Google tokeninfo endpoint (used as fallback for token verification)
  try {
    const start = Date.now();
    const res = await fetch("https://oauth2.googleapis.com/tokeninfo", {
      signal: AbortSignal.timeout(10000),
    });
    results.tokeninfoEndpoint = {
      reachable: true,
      status: res.status,
      latency: Date.now() - start,
    };
  } catch (err: any) {
    results.tokeninfoEndpoint = {
      reachable: false,
      error: err?.message || "Network error",
    };
  }

  // 5. Session secret check
  results.sessionConfig = {
    secretSet: !!process.env.SESSION_SECRET,
    nodeEnv: process.env.NODE_ENV || "not set",
  };

  // 6. Database connectivity test
  if (firebaseReady) {
    try {
      const { adminDb } = await import("@/lib/firebase-admin");
      const snap = await adminDb.collection("users").limit(1).get();
      results.databaseTest = {
        connected: true,
        canRead: true,
        userCount: snap.size,
      };
    } catch (err: any) {
      results.databaseTest = {
        connected: false,
        canRead: false,
        error: err?.message || "Unknown error",
      };
    }
  } else {
    results.databaseTest = {
      connected: false,
      reason: "Firebase Admin SDK not configured (no service account key)",
      fallback: "Using tokeninfo for token verification, but database operations will fail",
    };
  }

  // 7. Diagnosis summary
  const issues: string[] = [];
  if (!apiKey) issues.push("Firebase API key is not set — Google sign-in will not work");
  if (!fbStatus.ready) issues.push("Firebase Admin SDK is not configured — token verification uses fallback, database operations will fail");
  if ((results.apiKeyTest as any)?.valid === false) issues.push("Firebase API key is invalid — project may not exist or key may be wrong");
  if ((results.apiKeyTest as any)?.reachable === false) issues.push("Firebase API is not reachable from server — network/firewall issue");
  if ((results.databaseTest as any)?.canRead === false) issues.push("Database (Firestore) is not readable — user lookup/creation will fail");

  results.issues = issues;
  results.overallStatus = issues.length === 0 ? "ALL_CHECKS_PASSED" : "ISSUES_FOUND";

  return NextResponse.json(results);
}
