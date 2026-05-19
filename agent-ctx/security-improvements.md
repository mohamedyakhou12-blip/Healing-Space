# Security Improvements - Task Summary

## Task ID: security-improvements

## What was done

### 1. Created `/src/lib/html-sanitize.ts`
- Server-side HTML sanitization module for rich text content
- `sanitizeHtml()` - strips dangerous tags (script, style, iframe, object, embed, form, etc.) while preserving safe formatting
- `stripHtml()` - removes ALL HTML tags for plain text contexts
- `isUrlSafe()` - validates URLs against javascript:, data:text/html, vbscript: protocols
- `sanitizeForJson()` - sanitizes strings for safe JSON responses
- Defined `ALLOWED_TAGS`, `ALLOWED_ATTRS`, `DANGEROUS_ATTR_PATTERNS`, `ALLOWED_CSS_PROPS` constants for reference

### 2. Improved `/src/lib/sanitize.ts`
- Added import of `sanitizeHtml` from `@/lib/html-sanitize`
- Added `sanitizeRichText()` - sanitizes HTML while preserving safe formatting
- Added `sanitizeFileName()` - prevents path traversal attacks (removes `..`, replaces path separators, removes invalid chars)
- Added `isValidContentType()` - validates content type identifiers against whitelist
- Added `sanitizeAndTruncate()` - combines sanitization with length limiting

### 3. Created `/src/lib/request-limits.ts`
- `REQUEST_LIMITS` constant with all size/length limits (MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_CONTENT_LENGTH, MAX_ADMIN_NOTE_LENGTH, MAX_CCP_LENGTH, MAX_PRICE, etc.)
- `validateBodySize()` - validates request body size against limits
- `truncateField()` - truncates strings to maximum length

### 4. Added Input Validation to API Routes
**Payments route** (`/api/payments/route.ts`):
- Added `REQUEST_LIMITS` import for max price and CCP length validation
- Added `sanitizeHtml` import for admin note sanitization
- Zod schema: amount now has `.max(REQUEST_LIMITS.MAX_PRICE)`, ccpNumber has `.max(REQUEST_LIMITS.MAX_CCP_LENGTH)`, adminNote has `.max(REQUEST_LIMITS.MAX_ADMIN_NOTE_LENGTH)`
- Added CCP length validation check in POST handler
- Sanitized adminNote HTML in PUT handler before database storage

**Purchases route** (`/api/purchases/route.ts`):
- Added `REQUEST_LIMITS` import
- Zod schema: amount has `.max(REQUEST_LIMITS.MAX_PRICE)`, ccpNumber has `.max(REQUEST_LIMITS.MAX_CCP_LENGTH)`
- Added CCP length validation check in POST handler

**Purchases [id] route** (`/api/purchases/[id]/route.ts`):
- Added `REQUEST_LIMITS` and `sanitizeHtml` imports
- adminNote schema now uses `REQUEST_LIMITS.MAX_ADMIN_NOTE_LENGTH`
- Sanitized adminNote HTML in PUT handler

**Courses route** (`/api/courses/route.ts`):
- Added `sanitizeHtml` and `REQUEST_LIMITS` imports
- Title length now uses `REQUEST_LIMITS.MAX_TITLE_LENGTH`
- Description length now uses `REQUEST_LIMITS.MAX_DESCRIPTION_LENGTH`
- Price range uses `REQUEST_LIMITS.MIN_PRICE/MAX_PRICE`
- HTML descriptions sanitized before database insertion

**Articles route** (`/api/articles/route.ts`):
- Added `sanitizeHtml` and `REQUEST_LIMITS` imports
- Title/content lengths use REQUEST_LIMITS constants
- Price range uses REQUEST_LIMITS constants
- Content and excerpts sanitized before database insertion

**Podcasts route** (`/api/podcasts/route.ts`):
- Added `sanitizeHtml`, `isUrlSafe`, `REQUEST_LIMITS` imports
- Title/description lengths use REQUEST_LIMITS constants
- Audio URL safety validation added
- Descriptions sanitized before database insertion

**Videos route** (`/api/videos/route.ts`):
- Added `sanitizeHtml`, `isUrlSafe`, `REQUEST_LIMITS` imports
- Title/description lengths use REQUEST_LIMITS constants
- Video URL safety validation added
- Descriptions sanitized before database insertion

**PDFs route** (`/api/pdfs/route.ts`):
- Added `sanitizeHtml`, `isUrlSafe`, `REQUEST_LIMITS` imports
- Title/description lengths use REQUEST_LIMITS constants
- File URL safety validation added
- Descriptions sanitized before database insertion

**Live route** (`/api/live/route.ts`):
- Added `sanitizeHtml`, `isUrlSafe`, `REQUEST_LIMITS` imports
- Title/description lengths use REQUEST_LIMITS constants
- Stream/Zoom URL safety validation added
- Descriptions sanitized before database insertion

### 5. Improved `next.config.ts` Security Headers
- Added `media-src 'self' blob: https:` directive for audio/video content playback
- Added `worker-src 'self' blob:` directive for web workers
- Both additions support Firebase Storage URLs and blob URLs for media playback

### 6. Security Middleware (merged into `proxy.ts`)
- Initially created `/src/middleware.ts` but discovered Next.js 16 uses `proxy.ts` instead
- Deleted middleware.ts and merged security improvements into existing `proxy.ts`:
  - Added suspicious user agent detection (sqlmap, nikto, nmap, masscan, dirbuster, gobuster, wfuzz) with console warnings
  - Added `Cache-Control: no-store, no-cache, must-revalidate` header for API routes
  - Preserved all existing proxy.ts functionality (rate limiting, CSRF protection, body size limits, etc.)

### 7. Improved Admin Code Security
**`/src/lib/admin-code.ts`**:
- Added `timingSafeEqual()` function for timing-attack-resistant string comparison
- Replaced direct `===` comparisons with `timingSafeEqual()` for admin code validation
- Added comprehensive security warning about localStorage-based admin code storage
- Documented the security limitation and migration path (HTTP-only cookies)

**`/src/lib/api-helpers.ts`**:
- Added top-of-file security warning about admin code in localStorage
- Documented risks: XSS leakage, browser extension access, persistence across sessions, same-origin JS access
- Documented mitigation strategies: HTTP-only cookies, short-lived session tokens, CSRF protection, proper auth flow
- Added warning on `getAdminCode()` function about localStorage not being secure storage

## Notes
- All changes maintain backward compatibility
- Pre-existing TypeScript errors in `user-access/route.ts` and `firebase-storage.ts` are unrelated
- The lint errors in `CoursesPage.tsx` (React Compiler memoization) are pre-existing and unrelated
- The 500 error on page load is due to Firebase API key configuration (pre-existing)
