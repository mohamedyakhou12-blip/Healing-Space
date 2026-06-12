import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { verifyAdminAccess } from "@/lib/verifyAdminAccess";
import { requireAdmin } from "@/lib/session";
import { cached, invalidateContentCache } from "@/lib/cache";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

const createSliderSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  titleAr: z.string().max(200).optional(),
  titleFr: z.string().max(200).optional(),
  titleEn: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  descriptionAr: z.string().max(5000).optional(),
  descriptionFr: z.string().max(5000).optional(),
  descriptionEn: z.string().max(5000).optional(),
  image: z.string().max(500).optional(),
  imageUrl: z.string().max(500).optional(),
  link: z.string().max(500).optional(),
  order: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    // Check if the request is from an admin
    const adminId = await requireAdmin();
    const isAdmin = !!adminId;

    const data = await cached("api:sliders", async () => {
      return await db.slider.findMany();
    }, 60_000); // Sliders change rarely, cache for 60s

    // Non-admins should only see active sliders
    const filteredData = isAdmin ? data : data.filter((s: any) => s.isActive !== false);

    return NextResponse.json(
      { sliders: filteredData },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Fetch sliders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "sliders-post");
  if (isRateLimited(rlKey, { max: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  try {
    const isAuthorized = await verifyAdminAccess(request);
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized - admin access required" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSliderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const data = { ...parsed.data };
    // Support both 'image' and 'imageUrl' from frontend
    if (data.imageUrl && !data.image) {
      data.image = data.imageUrl;
      delete data.imageUrl;
    }
    // Auto-fill multilingual fields if only 'title' is provided
    if (data.title && !data.titleAr) data.titleAr = data.title;
    if (data.title && !data.titleFr) data.titleFr = data.title;
    if (data.title && !data.titleEn) data.titleEn = data.title;

    const slider = await db.slider.create({ data });

    // Invalidate cache after content mutation
    invalidateContentCache();

    return NextResponse.json({ slider }, { status: 201 });
  } catch (error) {
    console.error("Create slider error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
