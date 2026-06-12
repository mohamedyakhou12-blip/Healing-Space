import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

/**
 * POST /api/migrate-coaching-subcategories
 * Admin-only migration (requires session + CSRF).
 *
 * GET /api/migrate-coaching-subcategories?key=heal2026migrate
 * One-time key-based access for server-side migration calls.
 */


const SUBCATEGORY_MAP: Record<string, { subcategory: string; isFree: boolean; price: number; category: string }> = {
  "جلسة شهرية مع مدربة": { subcategory: "sessions", isFree: false, price: 3000, category: "كوتشنغ" },
  "ورشة عمل": { subcategory: "sessions", isFree: false, price: 5000, category: "كوتشنغ" },
  "حلول وفصول": { subcategory: "sessions", isFree: false, price: 2000, category: "كوتشنغ" },
  "تأمل": { subcategory: "meditation", isFree: true, price: 0, category: "تأمل" },
  "تأكيدات إيجابية": { subcategory: "meditation", isFree: true, price: 0, category: "تأمل" },
  "طبيب العقل": { subcategory: "meditation", isFree: false, price: 4000, category: "تأمل" },
  "علاج فني وترفيه": { subcategory: "therapy", isFree: false, price: 3500, category: "علاج نفسي" },
  "شفاء وعلاج طبي": { subcategory: "therapy", isFree: false, price: 6000, category: "علاج نفسي" },
  "ذاكرة الجسد": { subcategory: "therapy", isFree: false, price: 4500, category: "علاج نفسي" },
  "الطب الشمولي والتكاملي": { subcategory: "holistic", isFree: false, price: 7000, category: "طب شمولي" },
  "رحلة إعادة توازن": { subcategory: "holistic", isFree: false, price: 15000, category: "طب شمولي" },
  "تمارين": { subcategory: "exercises", isFree: true, price: 0, category: "تمارين" },
  "جلسة كوتشنغ شهرية": { subcategory: "sessions", isFree: false, price: 3000, category: "كوتشنغ" },
};

async function runMigration() {
  const coachings = await db.coaching.findMany();
  let updated = 0;
  let skipped = 0;
  const details: string[] = [];

  for (const c of coachings) {
    const titleAr = (c as any).titleAr || "";
    const existingSub = (c as any).subcategory;

    // Skip items that already have a subcategory
    if (existingSub) {
      skipped++;
      details.push(`${titleAr}: already has "${existingSub}" — skipped`);
      continue;
    }

    const mapping = SUBCATEGORY_MAP[titleAr];

    if (mapping) {
      await db.coaching.update({
        where: { id: c.id },
        data: {
          subcategory: mapping.subcategory,
          isFree: mapping.isFree,
          price: mapping.price,
          category: mapping.category,
        },
      });
      details.push(`${titleAr} -> ${mapping.subcategory}`);
      updated++;
    } else {
      let sub = "sessions";
      if (titleAr.includes("تأمل") || titleAr.includes("تأكيد") || titleAr.includes("عقل")) sub = "meditation";
      else if (titleAr.includes("علاج") || titleAr.includes("شفاء") || titleAr.includes("ذاكرة")) sub = "therapy";
      else if (titleAr.includes("شمولي") || titleAr.includes("توازن")) sub = "holistic";
      else if (titleAr.includes("تمارين") || titleAr.includes("رياض")) sub = "exercises";

      await db.coaching.update({
        where: { id: c.id },
        data: { subcategory: sub },
      });
      details.push(`${titleAr} -> ${sub} (auto)`);
      updated++;
    }
  }

  return { updated, skipped, details };
}

export async function POST(request: NextRequest) {
  // Require admin session
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
  }

  try {
    const result = await runMigration();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: "Migration failed" }, { status: 500 });
  }
}
