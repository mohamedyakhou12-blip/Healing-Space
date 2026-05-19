import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * GET /api/auth/session
 *
 * Returns the current session data.
 * Used by the client to check if the user is already logged in on page load.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session.userId) {
      return NextResponse.json({ isLoggedIn: false });
    }

    return NextResponse.json({
      isLoggedIn: true,
      userId: session.userId,
      role: session.userRole || "user",
      isAdmin: session.isAdmin || false,
    });
  } catch (error) {
    console.error("[Session] Error reading session:", error);
    return NextResponse.json({ isLoggedIn: false });
  }
}
