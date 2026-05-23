import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";
import { isRateLimited, rateLimitKey } from "@/lib/rate-limit";

// POST /api/seed — Add sample content for demonstration (admin only)
// DISABLED IN PRODUCTION for security
export async function POST(request: NextRequest) {
  // Rate limiting
  const rlKey = rateLimitKey(request, "seed-post");
  if (isRateLimited(rlKey, { max: 2, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", success: false },
      { status: 429 }
    );
  }

  // SECURITY: Seed endpoint is disabled in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seed endpoint is disabled in production for security" },
      { status: 403 }
    );
  }

  try {
    // Admin-only: double-check (session + code)
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: Record<string, number> = {};

    // ── Sample Courses ──
    const courses = [
      {
        title: "Introduction to Psychology",
        titleAr: "مقدمة في علم النفس",
        titleFr: "Introduction à la psychologie",
        titleEn: "Introduction to Psychology",
        description: "Learn the fundamentals of psychology",
        descriptionAr: "تعلم أساسيات علم النفس",
        descriptionFr: "Apprenez les bases de la psychologie",
        descriptionEn: "Learn the fundamentals of psychology",
        image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=250&fit=crop",
        thumbnail: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=250&fit=crop",
        isFree: false,
        price: 2500,
        status: "published",
      },
      {
        title: "CBT Techniques",
        titleAr: "تقنيات العلاج المعرفي السلوكي",
        titleFr: "Techniques de TCC",
        titleEn: "CBT Techniques",
        description: "Master Cognitive Behavioral Therapy techniques",
        descriptionAr: "أتقن تقنيات العلاج المعرفي السلوكي",
        descriptionFr: "Maîtrisez les techniques de TCC",
        descriptionEn: "Master Cognitive Behavioral Therapy techniques",
        image: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&h=250&fit=crop",
        thumbnail: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&h=250&fit=crop",
        isFree: false,
        price: 3500,
        status: "published",
      },
      {
        title: "Mindfulness Basics",
        titleAr: "أساسيات اليقظة الذهنية",
        titleFr: "Bases de la pleine conscience",
        titleEn: "Mindfulness Basics",
        description: "Free introduction to mindfulness meditation",
        descriptionAr: "مقدمة مجانية للتأمل الواعي",
        descriptionFr: "Introduction gratuite à la méditation pleine conscience",
        descriptionEn: "Free introduction to mindfulness meditation",
        image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=250&fit=crop",
        thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=250&fit=crop",
        isFree: true,
        price: 0,
        status: "published",
      },
    ];

    for (const c of courses) {
      await db.course.create({ data: c });
    }
    results.courses = courses.length;

    // ── Sample Articles ──
    const articles = [
      {
        title: "Understanding Anxiety",
        titleAr: "فهم القلق",
        titleFr: "Comprendre l'anxiété",
        titleEn: "Understanding Anxiety",
        content: "Anxiety is a natural response to stress...",
        contentAr: "القلق استجابة طبيعية للتوتر...",
        contentFr: "L'anxiété est une réponse naturelle au stress...",
        contentEn: "Anxiety is a natural response to stress...",
        image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=250&fit=crop",
        isFree: false,
        price: 500,
        status: "published",
      },
      {
        title: "Benefits of Meditation",
        titleAr: "فوائد التأمل",
        titleFr: "Les bienfaits de la méditation",
        titleEn: "Benefits of Meditation",
        content: "Meditation has been shown to reduce stress...",
        contentAr: "أثبت التأمل أنه يقلل التوتر...",
        contentFr: "La méditation a été montrée pour réduire le stress...",
        contentEn: "Meditation has been shown to reduce stress...",
        image: "https://images.unsplash.com/photo-1474418397713-7ede21d49118?w=400&h=250&fit=crop",
        isFree: true,
        price: 0,
        status: "published",
      },
    ];

    for (const a of articles) {
      await db.article.create({ data: a });
    }
    results.articles = articles.length;

    // ── Sample Podcasts ──
    const podcasts = [
      {
        title: "Mental Health Talk",
        titleAr: "حوار الصحة النفسية",
        titleFr: "Discussion sur la santé mentale",
        titleEn: "Mental Health Talk",
        description: "Weekly podcast about mental health topics",
        descriptionAr: "بودكاست أسبوعي عن مواضيع الصحة النفسية",
        descriptionFr: "Podcast hebdomadaire sur les sujets de santé mentale",
        descriptionEn: "Weekly podcast about mental health topics",
        image: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=250&fit=crop",
        audioUrl: "https://example.com/podcast1.mp3",
        isFree: false,
        price: 300,
        status: "published",
      },
      {
        title: "Self-Care Tips",
        titleAr: "نصائح العناية بالنفس",
        titleFr: "Conseils de bien-être",
        titleEn: "Self-Care Tips",
        description: "Quick tips for daily self-care routines",
        descriptionAr: "نصائح سريعة لروتين العناية بالنفس اليومي",
        descriptionFr: "Conseils rapides pour les routines de bien-être",
        descriptionEn: "Quick tips for daily self-care routines",
        image: "https://images.unsplash.com/photo-1515894203077-9cd36032142f?w=400&h=250&fit=crop",
        audioUrl: "https://example.com/podcast2.mp3",
        isFree: true,
        price: 0,
        status: "published",
      },
    ];

    for (const p of podcasts) {
      await db.podcast.create({ data: p });
    }
    results.podcasts = podcasts.length;

    // ── Sample Videos ──
    const videos = [
      {
        title: "Stress Management",
        titleAr: "إدارة التوتر",
        titleFr: "Gestion du stress",
        titleEn: "Stress Management",
        description: "Learn effective stress management techniques",
        descriptionAr: "تعلم تقنيات فعالة لإدارة التوتر",
        descriptionFr: "Apprenez des techniques efficaces de gestion du stress",
        descriptionEn: "Learn effective stress management techniques",
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=250&fit=crop",
        videoUrl: "https://www.youtube.com/watch?v=example1",
        isFree: false,
        price: 800,
        status: "published",
      },
      {
        title: "Breathing Exercises",
        titleAr: "تمارين التنفس",
        titleFr: "Exercices de respiration",
        titleEn: "Breathing Exercises",
        description: "Simple breathing exercises for relaxation",
        descriptionAr: "تمارين تنفس بسيطة للاسترخاء",
        descriptionFr: "Exercices de respiration simples pour la relaxation",
        descriptionEn: "Simple breathing exercises for relaxation",
        image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=250&fit=crop",
        videoUrl: "https://www.youtube.com/watch?v=example2",
        isFree: true,
        price: 0,
        status: "published",
      },
    ];

    for (const v of videos) {
      await db.video.create({ data: v });
    }
    results.videos = videos.length;

    // ── Sample PDFs ──
    const pdfs = [
      {
        title: "Anxiety Workbook",
        titleAr: "كتاب القلق التفاعلي",
        titleFr: "Cahier d'exercices sur l'anxiété",
        titleEn: "Anxiety Workbook",
        description: "Interactive workbook for managing anxiety",
        descriptionAr: "كتاب تفاعلي لإدارة القلق",
        descriptionFr: "Cahier d'exercices interactif pour gérer l'anxiété",
        descriptionEn: "Interactive workbook for managing anxiety",
        pdfUrl: "https://example.com/anxiety-workbook.pdf",
        isFree: false,
        price: 1500,
        status: "published",
      },
      {
        title: "Free Relaxation Guide",
        titleAr: "دليل الاسترخاء المجاني",
        titleFr: "Guide de relaxation gratuit",
        titleEn: "Free Relaxation Guide",
        description: "A free guide to relaxation techniques",
        descriptionAr: "دليل مجاني لتقنيات الاسترخاء",
        descriptionFr: "Un guide gratuit des techniques de relaxation",
        descriptionEn: "A free guide to relaxation techniques",
        pdfUrl: "https://example.com/relaxation-guide.pdf",
        isFree: true,
        price: 0,
        status: "published",
      },
    ];

    for (const pdf of pdfs) {
      await db.pdfResource.create({ data: pdf });
    }
    results.pdfs = pdfs.length;

    // ── Sample Live Sessions ──
    const liveSessions = [
      {
        title: "Group Therapy Session",
        titleAr: "جلسة علاج جماعي",
        titleFr: "Séance de thérapie de groupe",
        titleEn: "Group Therapy Session",
        description: "Live group therapy session with a licensed therapist",
        descriptionAr: "جلسة علاج جماعي مباشر مع معالج مرخص",
        descriptionFr: "Séance de thérapie de groupe en direct avec un thérapeute agréé",
        descriptionEn: "Live group therapy session with a licensed therapist",
        image: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=400&h=250&fit=crop",
        status: "upcoming",
        isFree: false,
        price: 1000,
      },
      {
        title: "Free Wellness Workshop",
        titleAr: "ورشة عمل مجانية للصحة النفسية",
        titleFr: "Atelier gratuit de bien-être",
        titleEn: "Free Wellness Workshop",
        description: "Free workshop on mental wellness",
        descriptionAr: "ورشة عمل مجانية عن الصحة النفسية",
        descriptionFr: "Atelier gratuit sur le bien-être mental",
        descriptionEn: "Free workshop on mental wellness",
        image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=250&fit=crop",
        status: "upcoming",
        isFree: true,
        price: 0,
      },
    ];

    for (const ls of liveSessions) {
      await db.liveSession.create({ data: ls });
    }
    results.liveSessions = liveSessions.length;

    return NextResponse.json({
      success: true,
      message: "Sample data seeded successfully",
      results,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
