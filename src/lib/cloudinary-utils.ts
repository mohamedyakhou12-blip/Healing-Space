/**
 * Client-safe Cloudinary utility functions.
 * These functions only manipulate URLs and do not require the cloudinary SDK.
 * Safe to import in Client Components.
 */

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

  const parts = videoUrl.split("/upload/");
  if (parts.length !== 2) return videoUrl;

  return `${parts[0]}/upload/so_0,w_640,h_360,c_pad,f_jpg/${parts[1].replace(/\.\w+$/, "")}.jpg`;
}
