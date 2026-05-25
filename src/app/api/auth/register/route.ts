import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { hash } from "bcryptjs";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";
import { sanitizeEmail, sanitizeName } from "@/lib/sanitize";
import { setUserSession } from "@/lib/session";

// Enhanced password schema — requires at least 8 chars with complexity
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().email("Invalid email format"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  phone: z.string().max(20, "Phone number is too long").optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: max 3 registrations per minute per IP (reduced from 5)
    const rlKey = rateLimitKey(request, "register");
    if (isRateLimited(rlKey, { max: 3, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later.", success: false },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed", success: false },
        { status: 400 }
      );
    }

    let { name, email, password, phone } = parsed.data;

    // Sanitize inputs
    name = sanitizeName(name);
    email = sanitizeEmail(email);

    // Prevent registration with the admin email
    if (email.toLowerCase() === "admine@gmail.com") {
      // Hash the password anyway to make timing consistent
      await hash(password, 12);
      return NextResponse.json(
        { error: "Registration failed. Please try with different details.", success: false },
        { status: 409 }
      );
    }

    // Validate sanitized values are not empty
    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Invalid name provided", success: false },
        { status: 400 }
      );
    }

    // Check for existing user FIRST (before expensive hash) to avoid timing side-channel
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Don't reveal whether email exists — use generic message
      // Also hash the password anyway to make timing consistent (prevent enumeration)
      await hash(password, 12);
      return NextResponse.json(
        { error: "Registration failed. Please try with different details.", success: false },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(password, 12);

    // Build user data - only include defined fields (Firestore rejects undefined)
    const userData: Record<string, unknown> = {
      name,
      email,
      password: hashedPassword,
      role: "user",
      locale: "ar",
      isActive: true,
    };
    if (phone) userData.phone = phone;

    const user = await db.user.create({
      data: userData,
    });

    // Set session cookie immediately after registration
    await setUserSession(user.id, "user");

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          phone: user.phone,
          locale: user.locale,
        },
        success: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    );
  }
}
