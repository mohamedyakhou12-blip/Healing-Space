import { NextRequest, NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { requireAdmin, requireAuth } from "@/lib/session";
import { validateAdminCode } from "@/lib/admin-code";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

/**
 * Generate signed upload parameters for client-side direct upload to Cloudinary.
 *
 * This bypasses Vercel's serverless function body size limit (4.5MB on Hobby plan).
 * The client uploads directly to Cloudinary's servers using these signed params.
 *
 * Flow:
 * 1. Client requests signed params from this endpoint (auth required)
 * 2. Client uploads file directly to Cloudinary via XHR (with real progress)
 * 3. Cloudinary returns the URL — client uses it directly
 *
 * AUTH: Accepts:
 * - Session-based admin auth (iron-session cookie with isAdmin=true), OR
 * - Valid admin code via X-Admin-Code header
 * - For the "healing-space/receipts" folder ONLY: any authenticated user session
 * This ensures uploads work from AdminPage, HomepageCustomizerPage, and PaymentPage.
 */
export async function POST(request: NextRequest) {
  // Rate limiting: max 20 signature requests per minute per IP
  const rlKey = rateLimitKey(request, "cloudinary-signature");
  if (isRateLimited(rlKey, { max: 20, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many upload requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  // ── Auth: accept EITHER session-based admin, valid admin code, or authenticated user for receipts ──
  const adminId = await requireAdmin();
  const adminCode = request.headers.get("X-Admin-Code");
  const codeValid = await validateAdminCode(adminCode);

  const isAdmin = !!adminId || codeValid;

  // Parse the body early to check the folder for receipt uploads by regular users
  let body: { folder?: string; resourceType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", success: false },
      { status: 400 }
    );
  }

  const { folder = "healing-space/content", resourceType = "auto" } = body;
  const isReceiptFolder = folder === "healing-space/receipts";

  // Regular (non-admin) users can only get signatures for the receipts folder
  let userId: string | null = null;
  if (!isAdmin) {
    if (!isReceiptFolder) {
      return NextResponse.json(
        { error: "Admin access required for this folder. Please verify your admin code or log in again.", success: false },
        { status: 401 }
      );
    }
    // Check if user is authenticated (any logged-in user can upload receipts)
    userId = await requireAuth();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to upload receipts.", success: false },
        { status: 401 }
      );
    }
  }

  try {
    // Validate Cloudinary config
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error("[Cloudinary Signature] Missing Cloudinary environment variables");
      return NextResponse.json(
        { error: "Upload service not configured. Please contact support.", success: false },
        { status: 503 }
      );
    }

    // Validate folder name to prevent directory traversal
    if (folder.includes("..") || folder.includes("//") || !/^[\w-\/]+$/.test(folder)) {
      return NextResponse.json(
        { error: "Invalid folder name", success: false },
        { status: 400 }
      );
    }

    // Validate resource type
    const validResourceTypes = ["auto", "image", "video", "raw"];
    if (!validResourceTypes.includes(resourceType)) {
      return NextResponse.json(
        { error: "Invalid resource type", success: false },
        { status: 400 }
      );
    }

    const timestamp = Math.round(Date.now() / 1000);

    // Build upload params for the signature
    const uploadParams: Record<string, string | number> = {
      timestamp,
      folder,
      resource_type: resourceType,
      use_filename: "true",
      unique_filename: "true",
      overwrite: "false",
    };

    // Generate the signature
    const signature = cloudinary.utils.api_sign_request(
      uploadParams,
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      success: true,
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
      resourceType,
    });
  } catch (error: unknown) {
    console.error("[Cloudinary Signature] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload signature. Please try again.", success: false },
      { status: 500 }
    );
  }
}
