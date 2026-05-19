/**
 * Request body size limits and validation
 */

// Maximum sizes for different types of requests
export const REQUEST_LIMITS = {
  // API request body size limits (in characters/bytes)
  MAX_JSON_BODY_SIZE: 10 * 1024 * 1024,    // 10MB for JSON bodies (base64 receipts)
  MAX_FORM_BODY_SIZE: 1100 * 1024 * 1024,  // 1.1GB for form data (video uploads up to 1GB + overhead)

  // String field length limits
  MAX_TITLE_LENGTH: 500,
  MAX_DESCRIPTION_LENGTH: 50000,
  MAX_CONTENT_LENGTH: 500000,
  MAX_ADMIN_NOTE_LENGTH: 1000,
  MAX_CCP_LENGTH: 30,
  MAX_NAME_LENGTH: 200,
  MAX_EMAIL_LENGTH: 254,

  // Numeric limits
  MAX_PRICE: 1000000,
  MIN_PRICE: 0,
} as const;

/**
 * Validate request body size
 */
export function validateBodySize(body: string, maxSize: number = REQUEST_LIMITS.MAX_JSON_BODY_SIZE): boolean {
  return body.length <= maxSize;
}

/**
 * Truncate a string to a maximum length
 */
export function truncateField(value: string, maxLength: number): string {
  if (!value || typeof value !== 'string') return value;
  return value.length > maxLength ? value.substring(0, maxLength) : value;
}
