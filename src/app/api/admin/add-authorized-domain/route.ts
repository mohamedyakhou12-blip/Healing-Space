import { NextRequest, NextResponse } from "next/server";
import { firebaseReady } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { validateAdminCode } from "@/lib/admin-code";

/**
 * POST /api/admin/add-authorized-domain
 *
 * Adds a domain (typically the Vercel deployment URL) to Firebase Auth's
 * list of authorized domains. This is needed for signInWithPopup to work
 * on the deployed site.
 *
 * Uses the Firebase Management/Identity Toolkit API via the service account.
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY to be set.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication (double-check: session + admin code)
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized — admin session required", success: false }, { status: 401 });
    }
    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized — invalid admin code", success: false }, { status: 401 });
    }

    if (!firebaseReady) {
      return NextResponse.json(
        {
          error: "Firebase Admin SDK not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY env var.",
          success: false,
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let domainToAdd = body.domain as string | undefined;

    // If no domain specified, auto-detect from Vercel
    if (!domainToAdd) {
      if (process.env.VERCEL_URL) {
        domainToAdd = process.env.VERCEL_URL;
      } else if (process.env.NEXT_PUBLIC_SITE_URL) {
        domainToAdd = new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname;
      } else {
        return NextResponse.json(
          { error: "No domain specified and could not auto-detect. Pass 'domain' in request body.", success: false },
          { status: 400 }
        );
      }
    }

    // Remove protocol if included
    domainToAdd = domainToAdd.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "healing-space-5a76f";

    // Get an OAuth2 access token using the service account
    // We use the Google IAM Credentials API to sign a JWT and exchange it for an access token
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(serviceAccountKey!);
    } catch {
      try {
        serviceAccount = JSON.parse(Buffer.from(serviceAccountKey!, "base64").toString("utf-8"));
      } catch {
        return NextResponse.json(
          { error: "Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY", success: false },
          { status: 500 }
        );
      }
    }

    // Step 1: Get current authorized domains using the Identity Toolkit API
    const accessToken = await getAccessToken(serviceAccount);

    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to obtain OAuth2 access token from service account", success: false },
        { status: 500 }
      );
    }

    // Step 2: Get current project config
    const configRes = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!configRes.ok) {
      const errText = await configRes.text();
      console.error("[Add Authorized Domain] Failed to get config:", configRes.status, errText);
      return NextResponse.json(
        {
          error: `Failed to get Firebase Auth config: ${configRes.status}`,
          details: errText,
          success: false,
        },
        { status: 500 }
      );
    }

    const config = await configRes.json();
    const existingDomains: string[] = config.authorizedDomains || [];

    // Step 3: Check if domain already exists
    if (existingDomains.includes(domainToAdd)) {
      return NextResponse.json({
        success: true,
        message: `Domain ${domainToAdd} is already authorized`,
        authorizedDomains: existingDomains,
      });
    }

    // Step 4: Add the new domain
    const updatedDomains = [...existingDomains, domainToAdd];

    const updateRes = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ authorizedDomains: updatedDomains }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("[Add Authorized Domain] Failed to update config:", updateRes.status, errText);
      return NextResponse.json(
        {
          error: `Failed to update Firebase Auth config: ${updateRes.status}`,
          details: errText,
          success: false,
        },
        { status: 500 }
      );
    }

    const updatedConfig = await updateRes.json();

    return NextResponse.json({
      success: true,
      message: `Domain ${domainToAdd} added to authorized domains`,
      authorizedDomains: updatedConfig.authorizedDomains,
    });
  } catch (error) {
    console.error("[Add Authorized Domain] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}

/**
 * Get an OAuth2 access token using the service account credentials.
 * This creates a signed JWT and exchanges it for an access token via Google's OAuth2 API.
 */
async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
  project_id: string;
}): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const scope = "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase";

    // Create JWT header and payload
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: scope,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    ).toString("base64url");

    // Sign the JWT with the service account's private key
    const crypto = await import("crypto");
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);

    const privateKey = serviceAccount.private_key.replace(/\\n/g, "\n");
    const signature = sign.sign(privateKey, "base64url");

    const jwt = `${header}.${payload}.${signature}`;

    // Exchange JWT for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Get Access Token] Failed:", tokenRes.status, errText);
      return null;
    }

    const tokenData = await tokenRes.json();
    return tokenData.access_token;
  } catch (error) {
    console.error("[Get Access Token] Error:", error);
    return null;
  }
}
