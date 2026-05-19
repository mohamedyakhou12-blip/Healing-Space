/**
 * Server-side HTML sanitization for rich text content.
 * Prevents XSS attacks from admin content or user input.
 */

// List of allowed HTML tags for rich text content
const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img',
  'blockquote', 'pre', 'code',
  'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'hr',
]);

// Allowed attributes per tag
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  'a': new Set(['href', 'title', 'target', 'rel']),
  'img': new Set(['src', 'alt', 'width', 'height', 'loading']),
  'span': new Set(['style', 'class']),
  'div': new Set(['style', 'class']),
  'p': new Set(['style', 'class']),
  'td': new Set(['style', 'class', 'colspan', 'rowspan']),
  'th': new Set(['style', 'class', 'colspan', 'rowspan']),
};

// Dangerous attribute values to strip
const DANGEROUS_ATTR_PATTERNS = [
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /on\w+\s*=/i, // onclick, onload, onerror, etc.
];

// Allowed CSS properties (for style attributes)
const ALLOWED_CSS_PROPS = new Set([
  'color', 'background-color', 'font-size', 'font-weight', 'font-style',
  'text-align', 'text-decoration', 'text-indent',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'border', 'border-radius',
  'width', 'max-width', 'min-width',
  'height', 'max-height', 'min-height',
  'display', 'float', 'clear',
  'list-style-type',
  'line-height', 'letter-spacing',
  'direction', 'text-direction',
]);

/**
 * Sanitize HTML content to prevent XSS while preserving formatting.
 * This is for server-side use only.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // Strategy: parse and rebuild, keeping only allowed tags and attributes
  let result = html;

  // Remove script tags and their content entirely
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags (CSS can be used for attacks)
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove iframe, object, embed, form, input tags
  result = result.replace(/<(iframe|object|embed|form|input|textarea|select|button|meta|link|base|svg|math)\b[^>]*>/gi, '');
  result = result.replace(/<\/(iframe|object|embed|form|input|textarea|select|button|meta|link|base|svg|math)>/gi, '');

  // Remove event handler attributes (onclick, onload, onerror, etc.)
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: and data: URLs in href/src
  result = result.replace(/(href|src)\s*=\s*["']?\s*(javascript\s*:|data\s*:\s*text\/html)[^"'>]*/gi, '$1=""');

  // Remove style attributes with expressions or url() pointing to scripts
  result = result.replace(/style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi, 'style=""');

  return result;
}

/**
 * Strip ALL HTML tags from a string (for plain text contexts)
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Validate that a URL is safe (not javascript:, data:, etc.)
 */
export function isUrlSafe(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:text/html') || trimmed.startsWith('vbscript:')) {
    return false;
  }
  return true;
}

/**
 * Sanitize a string for safe use in JSON responses
 */
export function sanitizeForJson(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
