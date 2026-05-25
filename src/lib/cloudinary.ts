/**
 * Cloudinary configuration and upload utilities.
 *
 * Used for admin content uploads (images, videos, audio, PDFs).
 * Receipts still go to Firebase Storage.
 *
 * Benefits of Cloudinary:
 * - Automatic image optimization (WebP, AVIF, quality auto)
 * - Video adaptive streaming (HLS)
 * - Automatic thumbnails
 * - Global CDN (Akamai)
 * - Smart cropping & resizing via URL parameters
 */

import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary with server-side credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS
});

export { cloudinary };

/**
 * Upload a file buffer to Cloudinary.
 * Returns the secure URL and public_id.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: {
    folder?: string;      // Cloudinary folder (e.g., "healing-space/videos")
    resourceType?: "image" | "video" | "raw" | "auto";  // Cloudinary resource type
    publicId?: string;    // Custom public ID (optional)
    transformation?: string; // Optional transformation (e.g., "q_auto,f_auto")
  } = {}
): Promise<{ url: string; publicId: string; width?: number; height?: number; format?: string; bytes?: number }> {
  const {
    folder = "healing-space/content",
    resourceType = "auto",
    publicId,
    transformation,
  } = options;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: publicId,
        transformation: transformation || (resourceType === "image" ? "q_auto,f_auto" : undefined),
        // For videos: generate a thumbnail automatically
        eager: resourceType === "video" 
          ? [{ width: 640, height: 360, crop: "pad", format: "jpg" }]
          : undefined,
        eager_async: true,
        // Add metadata
        context: {
          custom: { uploaded_by: "admin", app: "healing-space" },
        },
        // Overwrite if same public_id exists
        overwrite: false,
        // Unique filename if no public_id
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        } else {
          reject(new Error("Cloudinary upload returned no result"));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary by public_id.
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
}

/**
 * Get optimized image URL from a Cloudinary URL.
 * Adds auto-quality and auto-format transformations.
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: {
    width?: number;
    height?: number;
    crop?: string; // "fill", "fit", "pad", "scale"
    quality?: string; // "auto", "auto:low", "auto:good", "auto:eco"
    format?: string; // "auto", "webp", "avif", "jpg"
  } = {}
): string {
  const { width, height, crop = "fill", quality = "auto", format = "auto" } = options;

  // Only optimize Cloudinary URLs
  if (!originalUrl || !originalUrl.includes("res.cloudinary.com")) {
    return originalUrl;
  }

  // Parse the URL and insert transformation parameters
  // Cloudinary URL format: https://res.cloudinary.com/{cloud}/image/upload/{transforms}/{public_id}
  const parts = originalUrl.split("/upload/");
  if (parts.length !== 2) return originalUrl;

  const transforms: string[] = [];
  if (width || height) {
    const w = width ? `w_${width}` : "";
    const h = height ? `h_${height}` : "";
    const c = `c_${crop}`;
    transforms.push([w, h, c].filter(Boolean).join(","));
  }
  transforms.push(`q_${quality}`);
  transforms.push(`f_${format}`);

  return `${parts[0]}/upload/${transforms.join(",")}/${parts[1]}`;
}

/**
 * Get video thumbnail URL from a Cloudinary video URL.
 */
export function getVideoThumbnailUrl(videoUrl: string): string {
  if (!videoUrl || !videoUrl.includes("res.cloudinary.com")) {
    return videoUrl;
  }

  // Replace /video/upload/ with /video/upload/ and add so_0 for first frame
  const parts = videoUrl.split("/upload/");
  if (parts.length !== 2) return videoUrl;

  return `${parts[0]}/upload/so_0,w_640,h_360,c_pad,f_jpg/${parts[1].replace(/\.\w+$/, "")}.jpg`;
}

/**
 * Determine the Cloudinary resource type based on MIME type.
 */
export function getCloudinaryResourceType(mimeType: string): "image" | "video" | "raw" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "video"; // Cloudinary treats audio as video
  // PDFs, documents, archives → "raw"
  return "raw";
}

/**
 * Determine the Cloudinary folder based on upload type/content type.
 */
export function getCloudinaryFolder(contentType?: string): string {
  const baseFolder = "healing-space";
  if (!contentType) return `${baseFolder}/content`;

  const folderMap: Record<string, string> = {
    courses: `${baseFolder}/courses`,
    articles: `${baseFolder}/articles`,
    podcasts: `${baseFolder}/podcasts`,
    videos: `${baseFolder}/videos`,
    pdfs: `${baseFolder}/pdfs`,
    live: `${baseFolder}/live`,
    coaching: `${baseFolder}/coaching`,
    cover: `${baseFolder}/covers`,
    general: `${baseFolder}/content`,
  };

  return folderMap[contentType] || `${baseFolder}/content`;
}
