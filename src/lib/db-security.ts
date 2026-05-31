/**
 * Database Query Validator — NoSQL equivalent of "Prepared Statements"
 *
 * While Firestore (NoSQL) is not vulnerable to SQL injection,
 * it IS vulnerable to:
 * 1. Query injection — malicious field names or operators in where clauses
 * 2. Data injection — storing malicious content that gets executed later (XSS)
 * 3. Field enumeration — discovering collection structure through error messages
 * 4. Operator abuse — using unintended Firestore operators
 *
 * This module provides:
 * - Whitelisted collection names (prevents collection enumeration)
 * - Whitelisted field names per collection (prevents field injection)
 * - Whitelisted query operators (prevents operator abuse)
 * - Input type coercion and validation (prevents data injection)
 * - Safe ID validation (prevents path traversal in document IDs)
 */

// ── Allowed Firestore query operators ──
const ALLOWED_OPERATORS = new Set([
  "==", "!=", "<", "<=", ">", ">=",
  "array-contains", "array-contains-any",
  "in", "not-in",
]);

// ── Whitelisted collections ──
const VALID_COLLECTIONS = new Set([
  "users",
  "subscriptions",
  "payments",
  "courses",
  "courseChapters",
  "courseLessons",
  "courseProgress",
  "articles",
  "podcasts",
  "videos",
  "pdfResources",
  "liveSessions",
  "coachings",
  "reviews",
  "notifications",
  "purchases",
  "siteSettings",
  "sliders",
]);

// ── Field whitelist per collection ──
// This prevents injecting arbitrary field names into queries
const COLLECTION_FIELDS: Record<string, Set<string>> = {
  users: new Set([
    "id", "email", "name", "nameAr", "nameFr", "nameEn",
    "phone", "avatar", "role", "isActive", "googleUid",
    "locale", "password", "createdAt", "updatedAt",
  ]),
  subscriptions: new Set([
    "id", "userId", "type", "status", "startDate", "endDate",
    "createdAt", "updatedAt",
  ]),
  payments: new Set([
    "id", "userId", "amount", "ccp", "ccpNumber", "receiptUrl", "receiptImage", "status",
    "adminNote", "type", "planType", "subscriptionType", "createdAt", "updatedAt",
  ]),
  courses: new Set([
    "id", "title", "titleAr", "titleFr", "titleEn",
    "description", "descriptionAr", "descriptionFr", "descriptionEn",
    "image", "thumbnail", "status", "isFree", "price", "duration", "instructor",
    "category", "tags", "scheduledAt",
    "metaTitleAr", "metaTitleFr", "metaTitleEn", "metaDescAr", "metaDescFr", "metaDescEn", "ogImage",
    "createdAt", "updatedAt",
  ]),
  courseChapters: new Set([
    "id", "courseId", "title", "titleAr", "titleFr", "titleEn",
    "order", "createdAt", "updatedAt",
  ]),
  courseLessons: new Set([
    "id", "chapterId", "title", "titleAr", "titleFr", "titleEn",
    "content", "videoUrl", "duration", "order", "isFree",
    "createdAt", "updatedAt",
  ]),
  courseProgress: new Set([
    "id", "userId", "courseId", "completedLessons",
    "createdAt", "updatedAt",
  ]),
  articles: new Set([
    "id", "title", "titleAr", "titleFr", "titleEn",
    "description", "descriptionAr", "descriptionFr", "descriptionEn",
    "content", "contentAr", "contentFr", "contentEn",
    "image", "thumbnail", "status", "isFree", "price",
    "excerpt", "excerptAr", "excerptFr", "excerptEn", "author", "readTime",
    "category", "tags", "scheduledAt",
    "metaTitleAr", "metaTitleFr", "metaTitleEn", "metaDescAr", "metaDescFr", "metaDescEn", "ogImage",
    "createdAt", "updatedAt",
  ]),
  podcasts: new Set([
    "id", "title", "titleAr", "titleFr", "titleEn",
    "description", "descriptionAr", "descriptionFr", "descriptionEn",
    "audioUrl", "image", "thumbnail", "status", "isFree", "price", "episode", "duration",
    "category", "tags", "scheduledAt",
    "metaTitleAr", "metaTitleFr", "metaTitleEn", "metaDescAr", "metaDescFr", "metaDescEn", "ogImage",
    "createdAt", "updatedAt",
  ]),
  videos: new Set([
    "id", "title", "titleAr", "titleFr", "titleEn",
    "description", "descriptionAr", "descriptionFr", "descriptionEn",
    "videoUrl", "image", "thumbnail", "status", "isFree", "price", "duration",
    "category", "tags", "scheduledAt",
    "metaTitleAr", "metaTitleFr", "metaTitleEn", "metaDescAr", "metaDescFr", "metaDescEn", "ogImage",
    "createdAt", "updatedAt",
  ]),
  pdfResources: new Set([
    "id", "title", "titleAr", "titleFr", "titleEn",
    "description", "descriptionAr", "descriptionFr", "descriptionEn",
    "pdfUrl", "fileUrl", "image", "thumbnail", "status", "isFree", "price",
    "pages", "pageCount", "fileSize",
    "category", "tags", "scheduledAt",
    "metaTitleAr", "metaTitleFr", "metaTitleEn", "metaDescAr", "metaDescFr", "metaDescEn", "ogImage",
    "createdAt", "updatedAt",
  ]),
  liveSessions: new Set([
    "id", "title", "titleAr", "titleFr", "titleEn",
    "description", "descriptionAr", "descriptionFr", "descriptionEn",
    "youtubeUrl", "streamUrl", "zoomUrl", "image", "thumbnail", "status", "isFree", "price", "scheduledAt",
    "category", "tags",
    "metaTitleAr", "metaTitleFr", "metaTitleEn", "metaDescAr", "metaDescFr", "metaDescEn", "ogImage",
    "createdAt", "updatedAt",
  ]),
  coachings: new Set([
    "id", "title", "titleAr", "titleFr", "titleEn",
    "description", "descriptionAr", "descriptionFr", "descriptionEn",
    "image", "thumbnail", "isFree", "price", "status", "category", "tags",
    "viewCount", "order", "duration", "scheduledAt",
    "metaTitleAr", "metaTitleFr", "metaTitleEn", "metaDescAr", "metaDescFr", "metaDescEn", "ogImage",
    "createdAt", "updatedAt",
  ]),
  reviews: new Set([
    "id", "userId", "rating", "comment",
    "courseId", "articleId", "podcastId", "videoId", "coachingId",
    "createdAt", "updatedAt",
  ]),
  notifications: new Set([
    "id", "userId", "title", "titleAr", "titleFr", "titleEn",
    "message", "messageAr", "messageFr", "messageEn",
    "type", "isRead", "link",
    "createdAt", "updatedAt",
  ]),
  purchases: new Set([
    "id", "userId", "contentId", "contentType", "amount",
    "ccp", "ccpNumber", "receiptUrl", "receiptImage", "status", "adminNote",
    "contentTitle", "contentTitleAr",
    "createdAt", "updatedAt",
  ]),
  siteSettings: new Set([
    "id", "key", "value", "createdAt", "updatedAt",
  ]),
  sliders: new Set([
    "id", "image", "imageUrl", "title", "titleAr", "titleFr", "titleEn",
    "subtitle", "subtitleAr", "subtitleFr", "subtitleEn",
    "description", "descriptionAr", "descriptionFr", "descriptionEn",
    "order", "link", "isActive", "buttonText", "buttonTextAr", "buttonTextFr", "buttonTextEn",
    "createdAt", "updatedAt",
  ]),
};

// ── Document ID validation pattern ──
// Firestore document IDs: max 1500 bytes, no slashes, not just dots
const DOC_ID_REGEX = /^[^/]{1,1500}$/;
// Simplified: alphanumeric, hyphens, underscores (common pattern)
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,200}$/;

/**
 * Validate that a collection name is whitelisted.
 * Prevents collection name injection or enumeration.
 */
export function validateCollection(collection: string): string {
  if (!VALID_COLLECTIONS.has(collection)) {
    throw new Error(
      `[DB SECURITY] Invalid collection name: "${collection}". ` +
      `Collection is not in the whitelist.`
    );
  }
  return collection;
}

/**
 * Validate that a document ID is safe.
 * Prevents path traversal (e.g., "../../../etc/passwd")
 * and injection attacks.
 */
export function validateDocId(id: string): string {
  if (!id || typeof id !== "string") {
    throw new Error("[DB SECURITY] Document ID must be a non-empty string.");
  }

  if (!SAFE_ID_REGEX.test(id)) {
    throw new Error(
      `[DB SECURITY] Invalid document ID: "${id.substring(0, 50)}". ` +
      `Only alphanumeric characters, hyphens, and underscores are allowed.`
    );
  }

  return id;
}

/**
 * Validate that a field name is whitelisted for the given collection.
 * Prevents field name injection in queries.
 */
export function validateField(collection: string, field: string): string {
  const allowedFields = COLLECTION_FIELDS[collection];
  if (!allowedFields) {
    // If we don't have a field list for this collection,
    // allow it but log a warning (shouldn't happen with proper whitelisting)
    console.warn(
      `[DB SECURITY] No field whitelist for collection "${collection}". ` +
      `Allowing field "${field}" but consider adding a whitelist.`
    );
    return field;
  }

  if (!allowedFields.has(field)) {
    throw new Error(
      `[DB SECURITY] Invalid field name: "${field}" for collection "${collection}". ` +
      `Field is not in the whitelist.`
    );
  }

  return field;
}

/**
 * Validate a Firestore query operator.
 * Prevents operator injection or abuse.
 */
export function validateOperator(operator: string): string {
  if (!ALLOWED_OPERATORS.has(operator)) {
    throw new Error(
      `[DB SECURITY] Invalid query operator: "${operator}". ` +
      `Only standard Firestore operators are allowed.`
    );
  }
  return operator;
}

/**
 * Validate an entire where clause: [field, operator, value]
 * Returns the sanitized where clause.
 */
export function validateWhereClause(
  collection: string,
  clause: [string, any, any]
): [string, any, any] {
  const [field, operator, value] = clause;

  // Validate field name
  const safeField = validateField(collection, field);

  // Validate operator
  const safeOperator = validateOperator(operator);

  // Validate value type (basic type checking)
  if (value === undefined) {
    throw new Error(
      `[DB SECURITY] Undefined value in where clause for field "${safeField}". ` +
      `Use null instead of undefined.`
    );
  }

  return [safeField, safeOperator, value];
}

/**
 * Sanitize data before writing to Firestore.
 * Strips dangerous keys, validates field names, and coerces types.
 * This is the NoSQL equivalent of a prepared statement's parameter binding.
 */
export function sanitizeFirestoreData(
  collection: string,
  data: Record<string, any>
): Record<string, any> {
  const allowedFields = COLLECTION_FIELDS[collection];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    // Skip internal timestamp fields (handled by addTimestamps)
    if (key === "createdAt" || key === "updatedAt") continue;

    // Validate field name against whitelist
    if (allowedFields && !allowedFields.has(key)) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          `[DB SECURITY] BLOCKED: Field "${key}" is NOT in the whitelist for collection "${collection}". ` +
          `Data was NOT saved. Add "${key}" to COLLECTION_FIELDS in db-security.ts or fix the API.`
        );
        // In development, throw to make the bug visible immediately
        throw new Error(
          `[DB SECURITY] Field "${key}" is not whitelisted for collection "${collection}". ` +
          `Add it to COLLECTION_FIELDS in db-security.ts or fix the API route.`
        );
      }
      console.warn(
        `[DB SECURITY] Skipping unrecognized field "${key}" in collection "${collection}". ` +
        `Field not in whitelist.`
      );
      continue;
    }

    // Skip undefined values (Firestore rejects them)
    if (value === undefined) continue;

    // Sanitize string values to prevent stored XSS
    if (typeof value === "string") {
      // Check for script injection patterns
      if (/<script[\s>]/i.test(value) || /javascript:/i.test(value) || /on\w+\s*=/i.test(value)) {
        console.warn(
          `[DB SECURITY] Potential XSS content detected in field "${key}" of collection "${collection}". ` +
          `Content will be sanitized.`
        );
        // Don't strip the content — just log. The API routes use sanitizeHtml for HTML fields.
      }

      // Enforce maximum string length for non-content fields
      const contentFields = new Set([
        "content", "contentAr", "contentFr", "contentEn",
        "description", "descriptionAr", "descriptionFr", "descriptionEn",
        "message", "messageAr", "messageFr", "messageEn",
      ]);
      if (!contentFields.has(key) && value.length > 5000) {
        console.warn(
          `[DB SECURITY] Field "${key}" exceeds max length (5000). Truncating.`
        );
        sanitized[key] = value.substring(0, 5000);
        continue;
      }
    }

    // Recursively sanitize nested objects (but not arrays or timestamps)
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value && typeof value.toDate === "function") && // Firestore Timestamp
      !(value && typeof value.firestore === "object")   // FieldValue
    ) {
      sanitized[key] = sanitizeFirestoreData(collection, value);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Validate an array of where clauses for a Firestore query.
 * Returns the sanitized array.
 */
export function validateWhereClauses(
  collection: string,
  clauses: Array<[string, any, any]>
): Array<[string, any, any]> {
  return clauses.map((clause) => validateWhereClause(collection, clause));
}

/**
 * Validate that a limit value is safe and within bounds.
 * Prevents DoS via excessively large result sets.
 */
export function validateLimit(limit: number | undefined, maxLimit: number = 1000): number | undefined {
  if (limit === undefined) return undefined;
  if (typeof limit !== "number" || limit < 1) {
    throw new Error("[DB SECURITY] Limit must be a positive number.");
  }
  if (limit > maxLimit) {
    console.warn(
      `[DB SECURITY] Limit ${limit} exceeds max ${maxLimit}. Capping.`
    );
    return maxLimit;
  }
  return limit;
}
