# Task 4-7: Critical Fixes for Healing Space SPA

## Agent: Code Agent
## Date: 2025-03-04

## Summary of Fixes

### Issue 1: No vercel.json — Direct URL navigation returns 404
**Root Cause**: The app uses SPA-style routing via Zustand state, but routes like `/courses`, `/articles`, `/podcasts`, `/videos`, `/pdfs` have no `page.tsx` files, causing 404s on Vercel.

**Fix Applied** (dual approach):
1. **Created `vercel.json`** with rewrites for all content routes → `/` as a safety net fallback
2. **Created individual `page.tsx` files** for each route with proper SEO metadata:
   - `src/app/courses/page.tsx` — Courses route with SEO metadata (Arabic/French/English)
   - `src/app/articles/page.tsx` — Articles route with SEO metadata
   - `src/app/podcasts/page.tsx` — Podcasts route with SEO metadata
   - `src/app/videos/page.tsx` — Videos route with SEO metadata
   - `src/app/pdfs/page.tsx` — PDFs/E-Books route with SEO metadata
   - Each uses `SEOPageWrapper` to sync Zustand state (same pattern as existing `/live` and `/subscriptions`)

### Issue 2: Middleware file not working
**Root Cause**: The middleware logic was in `src/proxy.ts`, but Next.js requires the file to be named `middleware.ts`.

**Fix Applied**: Created `src/middleware.ts` that re-exports from `proxy.ts`:
```typescript
export { default, config } from "./proxy";
```

### Issue 3: Session restoration fails — No GET handler for /api/auth/profile
**Root Cause**: `AppShell` calls `fetch("/api/auth/profile")` (GET) to restore user data, but the route only had a PUT handler.

**Fix Applied**: Added a `GET` handler to `src/app/api/auth/profile/route.ts` that:
1. Gets userId via `requireAuth()`
2. Fetches user from DB
3. Returns user data (id, name, email, role, avatar, phone)
4. Handles 401/404/500 error cases

### Issue 4: SPA initial route detection missing
**Root Cause**: Zustand store starts with `currentPage: "home"`. When navigating directly to `/courses`, the store doesn't know which page to show.

**Fix Applied**: Added initial route detection in `AppShell.tsx`:
- New `useEffect` reads `window.location.pathname` on mount
- Maps it to a page name via `ROUTE_TO_PAGE`
- If the page is not "home" and the store still has "home", directly sets the store state (without pushState, since URL is already correct)

### Issue 5: Weak default admin code
**Root Cause**: `admin-code.ts` had `const DEFAULT_CODE = "HEAL2024SPACE"` — easily guessable.

**Fix Applied**:
- Removed `DEFAULT_CODE` constant entirely
- `getEnvCode()` now returns `process.env.ADMIN_ACCESS_CODE || ""` (empty string if not set)
- `hasAdminCode()` returns `false` unless env var is set
- `validateAdminCode()` only validates against DB or env var — no default fallback
- Removed `getDefaultAdminCode()` export (unused anywhere)
- If no admin code is configured anywhere, admin access is denied

### Issue 6: CTA buttons — No fix needed
Verified that "Start Healing" and "Browse Content" buttons work correctly via the SPA's `navigate()` function. The browser test confusion was likely due to the 404 issue on page refresh.

## Files Changed
- `/home/z/my-project/Healing-Space/vercel.json` — NEW
- `/home/z/my-project/Healing-Space/src/middleware.ts` — NEW
- `/home/z/my-project/Healing-Space/src/app/courses/page.tsx` — NEW
- `/home/z/my-project/Healing-Space/src/app/articles/page.tsx` — NEW
- `/home/z/my-project/Healing-Space/src/app/podcasts/page.tsx` — NEW
- `/home/z/my-project/Healing-Space/src/app/videos/page.tsx` — NEW
- `/home/z/my-project/Healing-Space/src/app/pdfs/page.tsx` — NEW
- `/home/z/my-project/Healing-Space/src/app/api/auth/profile/route.ts` — MODIFIED (added GET handler)
- `/home/z/my-project/Healing-Space/src/components/layout/AppShell.tsx` — MODIFIED (added initial route sync)
- `/home/z/my-project/Healing-Space/src/lib/admin-code.ts` — MODIFIED (removed weak default code)

## Notes
- The `vercel.json` rewrites and individual `page.tsx` files serve complementary purposes:
  - `page.tsx` files take precedence on Vercel (file-system routing > rewrites)
  - Rewrites serve as a safety net for any missed routes
  - Both the `SEOPageWrapper` (in page.tsx files) and the AppShell route sync handle the Zustand state initialization
