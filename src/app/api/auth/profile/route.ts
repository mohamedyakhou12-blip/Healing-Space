import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireAuth, getSession } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  locale: z.enum(["ar", "fr", "en"]).optional(),
});

/**
 * GET /api/auth/profile
 *
 * Fetches the current user's profile data. Used by the AppShell
 * to restore the user session after detecting an active iron-session cookie.
 *
 * FALLBACK: If the user is not found in the database (e.g., admin session
 * with a temporary ID, or Google auth user created when Firestore was down),
 * returns a profile derived from the session data itself.
 */
export async function GET() {
  try {
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Try to fetch user from database
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (user) {
        return NextResponse.json({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            phone: user.phone,
          },
        });
      }
    } catch (dbError) {
      console.warn("[Profile] Database lookup failed, falling back to session data:", dbError instanceof Error ? dbError.message : String(dbError));
    }

    // FALLBACK: User not found in DB or DB is unavailable.
    // Return a profile based on the session data so the user can still be logged in.
    const session = await getSession();
    const isAdmin = session.isAdmin || userId === "admin-session" || userId.startsWith("admin-");
    const role = session.userRole || (isAdmin ? "admin" : "user");

    console.log("[Profile] Using session-based fallback profile for:", userId, "role:", role);

    return NextResponse.json({
      user: {
        id: userId,
        name: isAdmin ? "Admin" : (userId.includes("@") ? userId.split("@")[0] : "User"),
        email: isAdmin ? "Admine@gmail.com" : "",
        role: role as "user" | "admin",
        avatar: null,
        phone: null,
      },
    });
  } catch (error) {
    console.error("Fetch profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "profile-put");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    // Use session to determine identity — no userId from client
    const userId = await requireAuth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: parsed.data,
    });

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        phone: updatedUser.phone,
        locale: updatedUser.locale,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
