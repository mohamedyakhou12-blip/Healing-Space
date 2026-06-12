# API Content Gate Implementation

## Task
Protect premium content from being accessed by unauthenticated/unsubscribed users through the API directly.

## Changes Made

### 1. New File: `src/lib/api-content-gate.ts`
Created a helper module with three exported functions:

- **`gateContentList(items, contentType)`** — Gates a list of content items (articles, videos, podcasts, PDFs, live sessions). Strips sensitive fields for non-subscribers.
- **`gateContentItem(item, contentType)`** — Gates a single content item.
- **`gateCourseLessons(course)`** — Gates course detail response, stripping lesson videoUrl/content for non-subscribers while respecting free lessons and individual purchases.

**Access logic:**
1. Admin → full access (no stripping, no DB queries)
2. User with active subscription covering the content type → full access
3. Content marked `isFree: true` → full access
4. Individually purchased content → full access
5. Otherwise → strip sensitive fields (set to `null`)

**Sensitive fields stripped per content type:**
- Articles: `content`, `contentAr`, `contentFr`, `contentEn`
- Videos: `videoUrl`
- Podcasts: `audioUrl`
- PDFs: `pdfUrl`, `fileUrl`
- Live Sessions: `streamUrl`, `zoomUrl`
- Course Lessons: `videoUrl`, `content`, `contentAr`, `contentFr`, `contentEn`

**Session resolution:** Uses `getSession()` from `@/lib/session` (iron-session cookies). Fetches active subscriptions and individual purchases from Firestore via `db.subscription.findMany` and `db.purchase.findMany`.

### 2. Modified API Routes (GET handlers only)

- **`src/app/api/articles/route.ts`** — Added `gateContentList` import, applied gating to result before response
- **`src/app/api/videos/route.ts`** — Same pattern
- **`src/app/api/podcasts/route.ts`** — Same pattern
- **`src/app/api/pdfs/route.ts`** — Same pattern
- **`src/app/api/live/route.ts`** — Same pattern
- **`src/app/api/courses/[id]/route.ts`** — Added `gateCourseLessons` import, applied gating to course object before response

### Not Modified
- POST/PUT/DELETE handlers — untouched as specified
- `/api/courses` list endpoint — returns chapters without lessons, no sensitive data to strip
- No individual item endpoints exist for articles, videos, podcasts, PDFs, or live sessions

## Verification
- TypeScript compilation: No errors in modified files
- ESLint: No new lint errors introduced
- Dev server: Compiles and runs without errors
- The API 500 errors are pre-existing Firebase connectivity issues in the sandbox, not related to these changes
