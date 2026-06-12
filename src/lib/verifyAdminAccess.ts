import { NextRequest } from "next/server";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";

/**
 * Verify admin access: accepts EITHER a valid admin session OR a valid admin code header.
 * This allows both cookie-based session auth and code-based auth to work.
 *
 * Usage in API routes:
 *   const isAuthorized = await verifyAdminAccess(request);
 *   if (!isAuthorized) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 */
export async function verifyAdminAccess(request: NextRequest): Promise<boolean> {
  // Try session-based auth first
  try {
    const sessionAdminId = await requireAdmin();
    if (sessionAdminId) return true;
  } catch { /* session check failed, try code */ }

  // Fall back to admin code header
  const adminCode = request.headers.get("X-Admin-Code");
  if (adminCode && (await validateAdminCode(adminCode))) return true;

  return false;
}
