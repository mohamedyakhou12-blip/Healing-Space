import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/session";
import { validateAdminCode } from "@/lib/admin-code";
import { uploadToCloudinary, getCloudinaryResourceType, getCloudinaryFolder } from "@/lib/cloudinary";
import { sanitizeFileName, isValidContentType } from "@/lib/sanitize";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

// ═══════════════════════════════════════════════════════════════════════
//  File Upload API Route — Cloudinary-based
//  Supports: images, videos, audio, PDFs
//  Max file sizes: Videos = 100MB (server-side), Others = 50MB
//
//  NOTE: For large video files (>50MB), use /api/cloudinary/signature
//  for direct browser-to-Cloudinary upload to bypass Vercel body limits.
// ═══════════════════════════════════════════════════════════════════════

// Vercel Hobby plan limits serverless body to ~4.5MB, Pro to ~50MB
// We set reasonable limits that work within those constraints
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;  // 50 MB (works on Pro; Hobby users should use direct upload)
const MAX_OTHER_SIZE = 10 * 1024 * 1024;  // 10 MB

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  video: ["video/mp4", "video/webm", "video/ogg", "video/quicktime"],
  image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/avif"],
  audio: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/webm"],
  document: ["application/pdf"],
};

const ALL_ALLOWED_MIMES = Object.values(ALLOWED_MIME_TYPES).flat();

// Dangerous file extensions that should never be allowed
const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif",
  ".sh", ".bash", ".csh", ".ksh",
  ".php", ".asp", ".aspx", ".jsp", ".cgi",
  ".py", ".rb", ".pl", ".pm",
  ".vbs", ".vbe", ".wsf", ".wsh",
  ".ps1", ".ps2",
  ".inf", ".reg",
  ".hta", ".htm", ".html",
  ".js", ".mjs", ".ts",
  ".jar", ".war", ".class",
  ".sql", ".db", ".mdb",
  ".svg",  // SVG can contain JavaScript — block for uploads
];

function getMaxSizeForMime(mimeType: string): number {
  if (mimeType.startsWith("video/")) return MAX_VIDEO_SIZE;
  return MAX_OTHER_SIZE;
}

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function hasBlockedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return BLOCKED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export async function POST(request: NextRequest) {
  // Rate limiting: max 10 uploads per minute per IP
  const rlKey = rateLimitKey(request, "upload");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many upload requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // ── Parse FormData ──
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;           // "content" | "receipt"
    const contentType = formData.get("contentType") as string | null; // "videos" | "articles" etc.

    if (!file) {
      return NextResponse.json({ error: "No file provided", success: false }, { status: 400 });
    }

    // ── Validate MIME type ──
    const mimeType = file.type || "application/octet-stream";

    // Receipt uploads (from PaymentPage)
    if (type === "receipt") {
      // Auth: must be logged in (not necessarily admin)
      const userId = await requireAuth();
      if (!userId) {
        return NextResponse.json({ error: "Authentication required", success: false }, { status: 401 });
      }

      // Only images and PDFs for receipts
      if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
        return NextResponse.json({
          error: "Only images and PDF files are accepted for receipts",
          success: false,
        }, { status: 400 });
      }

      // Max 20MB for receipts
      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json({
          error: "Receipt file too large (max 20MB)",
          success: false,
        }, { status: 413 });
      }

      // Block dangerous extensions
      if (hasBlockedExtension(file.name)) {
        return NextResponse.json({ error: "File type not allowed", success: false }, { status: 400 });
      }

      // Upload receipt to Cloudinary (in receipts folder)
      const sanitizedName = sanitizeFileName(file.name);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const result = await uploadToCloudinary(buffer, {
        folder: "healing-space/receipts",
        resourceType: mimeType === "application/pdf" ? "raw" : "image",
        publicId: sanitizedName.replace(/\.[^.]+$/, ""),
      });

      return NextResponse.json({
        success: true,
        url: result.url,
        publicId: result.publicId,
        type: "receipt",
      });
    }

    // Content uploads (admin only)
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Admin access required", success: false }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Valid admin code required", success: false }, { status: 403 });
    }

    // ── Validate MIME type for content ──
    if (!ALL_ALLOWED_MIMES.includes(mimeType)) {
      return NextResponse.json({
        error: `File type not allowed: ${mimeType}. Allowed types: ${ALL_ALLOWED_MIMES.join(", ")}`,
        success: false,
      }, { status: 400 });
    }

    // ── Block dangerous extensions ──
    if (hasBlockedExtension(file.name)) {
      return NextResponse.json({ error: "File type not allowed", success: false }, { status: 400 });
    }

    // ── Validate contentType if provided ──
    if (contentType && !isValidContentType(contentType) && contentType !== "cover" && contentType !== "general") {
      return NextResponse.json({
        error: "Invalid content type",
        success: false,
      }, { status: 400 });
    }

    // ── Validate file size ──
    const maxSize = getMaxSizeForMime(mimeType);
    const maxLabel = mimeType.startsWith("video/") ? "50MB" : "10MB";
    if (file.size > maxSize) {
      return NextResponse.json({
        error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum for ${getFileCategory(mimeType)} files is ${maxLabel}. For larger videos, the direct upload feature will be used automatically.`,
        success: false,
      }, { status: 413 });
    }

    // ── Sanitize filename ──
    const sanitizedName = sanitizeFileName(file.name);

    // ── Read file buffer ──
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── Determine Cloudinary folder and resource type ──
    const folder = getCloudinaryFolder(contentType || undefined);
    const resourceType = getCloudinaryResourceType(mimeType);

    // ── Upload to Cloudinary ──
    const result = await uploadToCloudinary(buffer, {
      folder,
      resourceType,
      publicId: sanitizedName.replace(/\.[^.]+$/, ""), // Remove extension for public_id
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      type: getFileCategory(mimeType),
    });
  } catch (error: unknown) {
    console.error("[Upload] Error:", error);
    // Don't leak internal error details
    return NextResponse.json(
      { error: "Upload failed. Please try again.", success: false },
      { status: 500 }
    );
  }
}
