import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary, getCloudinaryResourceType, getCloudinaryFolder } from "@/lib/cloudinary";
import { requireAdmin, requireAuth } from "@/lib/session";
import { validateAdminCode } from "@/lib/admin-code";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

// ── VIS-07: magic-byte signatures we can verify with certainty ──
const KNOWN_SIGNED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
]);

function matchesExpectedMagicBytes(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  const ascii = (start: number, end: number) => buffer.subarray(start, end).toString("latin1");

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 && ascii(1, 4) === "PNG" &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
  const isGif = ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a";
  const isWebp = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  const isPdf = ascii(0, 5) === "%PDF-";
  // ISO-BMP container (HEIC/HEIF/AVIF all start with an ftyp brand)
  const isIsoBmp = ascii(4, 8) === "ftyp";

  switch (mime) {
    case "image/jpeg": return isJpeg;
    case "image/png": return isPng;
    case "image/gif": return isGif;
    case "image/webp": return isWebp;
    case "application/pdf": return isPdf;
    case "image/heic":
    case "image/heif": return isIsoBmp;
    default: return true;
  }
}

/**
 * Server-mediated file upload endpoint.
 *
 * Handles file uploads via FormData and stores them in Cloudinary.
 * Used for:
 * - Admin content uploads (images, videos, audio, PDFs)
 * - User receipt uploads (payment proof)
 *
 * For large files (>3MB), the client should use direct Cloudinary upload
 * instead (bypasses Vercel's body size limit). See cloudinary-client.ts.
 *
 * AUTH: Accepts:
 * - Session-based admin auth (iron-session cookie with isAdmin=true), OR
 * - Valid admin code via X-Admin-Code header
 * - For receipt uploads only: any authenticated user session
 */
export async function POST(request: NextRequest) {
  // Rate limiting: max 10 uploads per minute per IP
  const rlKey = rateLimitKey(request, "upload");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many upload requests. Please try again later." },
      { status: 429 }
    );
  }

  // ── Auth check ──
  const adminId = await requireAdmin();
  const adminCode = request.headers.get("X-Admin-Code");
  const codeValid = await validateAdminCode(adminCode);
  const isAdmin = !!adminId || codeValid;

  // Parse the form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request: could not parse form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;
  const uploadType = (formData.get("type") as string) || "content";
  const contentType = formData.get("contentType") as string | null;

  if (!file) {
    return NextResponse.json(
      { error: "No file provided" },
      { status: 400 }
    );
  }

  // ── Receipt uploads: allow any authenticated user ──
  const isReceipt = uploadType === "receipt";
  if (!isAdmin) {
    if (!isReceipt) {
      return NextResponse.json(
        { error: "Admin access required for content uploads. Please verify your admin code or log in again." },
        { status: 401 }
      );
    }
    // For receipts, check if user is authenticated
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to upload receipts." },
        { status: 401 }
      );
    }
  }

  // ── File size check (20MB max for server-mediated upload) ──
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 20MB. For larger files, please use direct upload." },
      { status: 413 }
    );
  }

  // ── Validate file type (block dangerous extensions) ──
  const dangerousExtensions = [
    ".exe", ".bat", ".sh", ".cmd", ".com", ".vbs", ".js", ".wsf", ".msi", ".scr", ".pif",
    // VIS-07: script/markup documents that execute in a browser
    ".html", ".htm", ".shtml", ".xhtml", ".svg", ".xml",
    ".php", ".php3", ".php4", ".php5", ".phtml", ".pht", ".cgi", ".pl",
  ];
  const fileName = file.name.toLowerCase();
  if (dangerousExtensions.some(ext => fileName.endsWith(ext))) {
    return NextResponse.json(
      { error: "This file type is not allowed for security reasons." },
      { status: 400 }
    );
  }

  // ── VIS-07: block dangerous MIME types (executable/markup documents) ──
  const mime = (file.type || "").toLowerCase();
  const dangerousMimeTypes = [
    "text/html", "application/xhtml+xml", "image/svg+xml",
    "application/xml", "text/xml", "application/x-sh", "application/x-executable",
  ];
  if (dangerousMimeTypes.includes(mime)) {
    return NextResponse.json(
      { error: "This file type is not allowed for security reasons." },
      { status: 400 }
    );
  }

  // ── VIS-07: receipts use a STRICT allowlist (images + PDF only) ──
  const RECEIPT_ALLOWED_MIME = new Set([
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
    "application/pdf",
  ]);
  const RECEIPT_ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".pdf"];
  if (isReceipt) {
    const extOk = RECEIPT_ALLOWED_EXT.some((ext) => fileName.endsWith(ext));
    if (!extOk || !RECEIPT_ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Receipts must be an image (JPG, PNG, WebP, GIF, HEIC) or PDF." },
        { status: 400 }
      );
    }
  }

  try {
    // Determine Cloudinary folder and resource type
    let folder: string;
    let resourceType: "image" | "video" | "raw" | "auto";

    if (isReceipt) {
      folder = "healing-space/receipts";
      resourceType = file.type === "application/pdf" ? "raw" : getCloudinaryResourceType(file.type);
    } else {
      folder = getCloudinaryFolder(contentType || undefined);
      resourceType = getCloudinaryResourceType(file.type);
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── VIS-07: magic-byte verification ──
    // A renamed file (e.g. evil.html → receipt.png) keeps its HTML content;
    // the real file signature must match the declared type.
    if (isReceipt && !matchesExpectedMagicBytes(buffer, mime)) {
      return NextResponse.json(
        { error: "File content does not match its file type." },
        { status: 400 }
      );
    }
    // Admin content: verify only when we know the signature for sure.
    if (!isReceipt && KNOWN_SIGNED_MIME.has(mime) && !matchesExpectedMagicBytes(buffer, mime)) {
      return NextResponse.json(
        { error: "File content does not match its file type." },
        { status: 400 }
      );
    }

    // Upload to Cloudinary
    const result = await uploadToCloudinary(buffer, {
      folder,
      resourceType,
    });

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { error: "File upload failed. Please try again." },
      { status: 500 }
    );
  }
}