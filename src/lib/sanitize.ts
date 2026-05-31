import { sanitizeHtml } from "@/lib/html-sanitize";

/**
 * Sanitize a string input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .replace(/[<>]/g, "") // Remove < and > to prevent XSS
    .trim();
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== "string") return "";

  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9@._-]/g, ""); // Only allow valid email chars
}

/**
 * Sanitize a name (allow Arabic, Latin, spaces, hyphens)
 */
export function sanitizeName(name: string): string {
  if (typeof name !== "string") return "";

  return name
    .trim()
    .replace(/[<>{}()\[\]\\\/]/g, ""); // Remove dangerous chars but keep Arabic/Latin
}

/**
 * Validate and sanitize a CCP number (digits and spaces only)
 */
export function sanitizeCCP(ccp: string): string {
  if (typeof ccp !== "string") return "";

  return ccp.replace(/[^\d\s]/g, "").trim();
}

/**
 * Sanitize a URL to prevent javascript: protocol injection
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    // Use URL parser to detect dangerous protocols (handles encoding bypasses)
    const parsed = new URL(trimmed);
    const dangerousProtocols = ["javascript:", "vbscript:", "data:"];
    if (dangerousProtocols.includes(parsed.protocol)) {
      return "";
    }
    return trimmed;
  } catch {
    // Not a valid URL — check raw string for dangerous protocols
    const lowered = trimmed.toLowerCase();
    if (lowered.startsWith("javascript:") || lowered.startsWith("vbscript:") || lowered.startsWith("data:text/html")) {
      return "";
    }
    return trimmed;
  }
}

/**
 * Sanitize rich text/HTML content (for admin content descriptions)
 * Strips dangerous tags but preserves safe formatting
 */
export function sanitizeRichText(input: string): string {
  if (typeof input !== "string") return "";
  return sanitizeHtml(input); // Uses the html-sanitize module
}

/**
 * Sanitize a filename to prevent path traversal
 */
export function sanitizeFileName(name: string): string {
  if (typeof name !== "string") return "";
  return name
    .replace(/\.\./g, "")     // Remove parent directory references
    .replace(/[\/\\]/g, "_")  // Replace path separators
    .replace(/[<>:"|?*]/g, "_") // Replace invalid filename chars
    .trim();
}

/**
 * Validate that a string is a valid content type identifier
 */
export function isValidContentType(type: string): boolean {
  const validTypes = ["courses", "articles", "podcasts", "videos", "pdfs", "live", "coaching"];
  return validTypes.includes(type);
}

/**
 * Sanitize and limit string length
 */
export function sanitizeAndTruncate(input: string, maxLength: number): string {
  if (typeof input !== "string") return "";
  const sanitized = sanitizeInput(input);
  return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
}
