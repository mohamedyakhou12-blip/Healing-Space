/**
 * Client-side Cloudinary direct upload utilities.
 *
 * These functions bypass Vercel's serverless function body size limit
 * by uploading files directly from the browser to Cloudinary's servers.
 *
 * Vercel Hobby plan: ~4.5MB body size limit
 * Vercel Pro plan: ~50MB body size limit
 *
 * By uploading directly to Cloudinary, we support files up to 1GB.
 *
 * Usage:
 *   import { directCloudinaryUpload } from "@/lib/cloudinary-client";
 *   const result = await directCloudinaryUpload(file, { folder: "healing-space/videos" }, onProgress);
 */

/**
 * Get admin headers for authenticated requests.
 */
function getAdminHeaders(): Record<string, string> {
  const code = typeof window !== "undefined"
    ? localStorage.getItem("healing_space_admin_code") || ""
    : "";
  return { "Content-Type": "application/json", "X-Admin-Code": code };
}

/**
 * Determine the Cloudinary resource type based on file MIME type.
 */
function getResourceType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "video"; // Cloudinary treats audio as video
  return "auto";
}

/**
 * Determine the Cloudinary upload API URL based on resource type.
 */
function getUploadUrl(cloudName: string, resourceType: string): string {
  // Cloudinary has separate upload endpoints for different resource types
  if (resourceType === "video" || resourceType === "raw") {
    return `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  }
  return `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
}

export interface DirectUploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface DirectUploadOptions {
  /** Cloudinary folder (e.g., "healing-space/videos") */
  folder?: string;
  /** Override resource type detection (default: auto-detect from MIME type) */
  resourceType?: string;
  /** Content type for folder mapping (e.g., "videos", "courses") */
  contentType?: string;
}

/**
 * Upload a file directly from the browser to Cloudinary.
 *
 * This bypasses Vercel's serverless function body size limit entirely.
 * The file goes directly from the user's browser to Cloudinary's servers.
 *
 * @param file - The File object to upload
 * @param options - Upload options (folder, resourceType, contentType)
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns The upload result with URL and metadata
 */
export async function directCloudinaryUpload(
  file: File,
  options: DirectUploadOptions = {},
  onProgress?: (percent: number) => void
): Promise<DirectUploadResult> {
  const { folder = "healing-space/content", resourceType: overrideResourceType, contentType } = options;

  // Determine resource type from file MIME
  const resourceType = overrideResourceType || getResourceType(file.type || "application/octet-stream");

  // Determine folder from content type if provided
  let effectiveFolder = folder;
  if (contentType) {
    const folderMap: Record<string, string> = {
      courses: "healing-space/courses",
      articles: "healing-space/articles",
      podcasts: "healing-space/podcasts",
      videos: "healing-space/videos",
      pdfs: "healing-space/pdfs",
      live: "healing-space/live",
      cover: "healing-space/covers",
      general: "healing-space/content",
    };
    effectiveFolder = folderMap[contentType] || folder;
  }

  // Step 1: Get signed upload parameters from our server
  const signRes = await fetch("/api/cloudinary/signature", {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({
      folder: effectiveFolder,
      resourceType,
    }),
  });

  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || "Authorization failed. Please verify your admin code.");
  }

  const signData = await signRes.json();

  // Validate we got the required fields
  if (!signData.signature || !signData.apiKey || !signData.cloudName) {
    throw new Error("Invalid upload signature received from server.");
  }

  // Step 2: Upload directly to Cloudinary using XMLHttpRequest for real progress
  const cloudinaryUrl = getUploadUrl(signData.cloudName, resourceType);

  return new Promise<DirectUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Real progress tracking
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            url: response.secure_url,
            publicId: response.public_id,
            width: response.width,
            height: response.height,
            format: response.format,
            bytes: response.bytes,
          });
        } catch {
          reject(new Error("Invalid response from Cloudinary"));
        }
      } else {
        try {
          const errResponse = JSON.parse(xhr.responseText);
          const message = errResponse.error?.message || `Upload failed (${xhr.status})`;
          reject(new Error(message));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload. Please check your internet connection.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("POST", cloudinaryUrl);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signData.apiKey);
    formData.append("timestamp", signData.timestamp.toString());
    formData.append("signature", signData.signature);
    formData.append("folder", signData.folder);
    formData.append("resource_type", signData.resourceType);
    formData.append("use_filename", "true");
    formData.append("unique_filename", "true");

    xhr.send(formData);
  });
}

/**
 * Check if a file should use direct upload based on its size.
 * Files larger than the threshold should use direct upload to bypass Vercel's body size limit.
 *
 * Vercel Hobby: ~4.5MB, Pro: ~50MB
 * We use 3MB as the threshold to be safe on Hobby plan.
 */
export function shouldUseDirectUpload(fileSize: number): boolean {
  const DIRECT_UPLOAD_THRESHOLD = 3 * 1024 * 1024; // 3MB
  return fileSize > DIRECT_UPLOAD_THRESHOLD;
}
