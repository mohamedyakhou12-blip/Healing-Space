import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "auth-logout-post");
  if (isRateLimited(rlKey, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
