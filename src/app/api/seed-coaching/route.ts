import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAdminCode } from "@/lib/admin-code";
import { requireAdmin } from "@/lib/session";

const SEED_COACHINGS = [
  {
    title: "جلسة شهرية مع مدربة",
    titleAr: "جلسة شهرية مع مدربة",
    titleFr: "Séance du mois",
    titleEn: "Monthly Session",
    description: "جلسة تدريبية شهرية مع مدربة متخصصة لمتابعة تقدمك وتقديم الإرشاد الشخصي في رحلة الشفاء.",
    descriptionAr: "جلسة تدريبية شهرية مع مدربة متخصصة لمتابعة تقدمك وتقديم الإرشاد الشخصي في رحلة الشفاء.",
    descriptionFr: "Séance d'coaching mensuelle avec une coach spécialisée pour suivre vos progrès et offrir des conseils personnalisés dans votre parcours de guérison.",
    descriptionEn: "A monthly coaching session with a specialized coach to track your progress and provide personal guidance on your healing journey.",
    duration: "60 دقيقة",
    order: 1,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "ورشة عمل",
    titleAr: "ورشة عمل",
    titleFr: "Workshop",
    titleEn: "Workshop",
    description: "ورش عمل تفاعلية تركز على مهارات محددة للشفاء والتطوير الذاتي، مع أنشطة عملية وجلسات نقاش.",
    descriptionAr: "ورش عمل تفاعلية تركز على مهارات محددة للشفاء والتطوير الذاتي، مع أنشطة عملية وجلسات نقاش.",
    descriptionFr: "Ateliers interactifs axés sur des compétences spécifiques de guérison et de développement personnel, avec des activités pratiques et des sessions de discussion.",
    descriptionEn: "Interactive workshops focusing on specific healing and personal development skills, with practical activities and discussion sessions.",
    duration: "90 دقيقة",
    order: 2,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "تمارين",
    titleAr: "تمارين",
    titleFr: "Exercices",
    titleEn: "Exercises",
    description: "تمارين عملية مصممة خصيصاً لتعزيز الشفاء النفسي والعاطفي، تشمل تمارين التنفس والتأمل والكتابة العلاجية.",
    descriptionAr: "تمارين عملية مصممة خصيصاً لتعزيز الشفاء النفسي والعاطفي، تشمل تمارين التنفس والتأمل والكتابة العلاجية.",
    descriptionFr: "Exercices pratiques conçus pour favoriser la guérison psychologique et émotionnelle, incluant des exercices de respiration, méditation et écriture thérapeutique.",
    descriptionEn: "Practical exercises specifically designed to enhance psychological and emotional healing, including breathing exercises, meditation, and therapeutic writing.",
    duration: "30 دقيقة",
    order: 3,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "رحلة إعادة توازن",
    titleAr: "رحلة إعادة توازن",
    titleFr: "Retraite",
    titleEn: "Rebalancing Retreat",
    description: "رحلة شاملة لإعادة التوازن بين الجسد والعقل والروح، تجمع بين التأمل والأنشطة الترفيهية والعلاج الطبيعي.",
    descriptionAr: "رحلة شاملة لإعادة التوازن بين الجسد والعقل والروح، تجمع بين التأمل والأنشطة الترفيهية والعلاج الطبيعي.",
    descriptionFr: "Un voyage complet de rééquilibrage du corps, de l'esprit et de l'âme, combinant méditation, activités récréatives et thérapie naturelle.",
    descriptionEn: "A comprehensive journey to rebalance body, mind, and soul, combining meditation, recreational activities, and natural therapy.",
    duration: "3 أيام",
    order: 4,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "حلول وفصول",
    titleAr: "حلول وفصول",
    titleFr: "Q&R - Solutions",
    titleEn: "Solutions & Chapters",
    description: "جلسات أسئلة وأجوبة مع حلول عملية لتحديات الحياة اليومية، مقسمة إلى فصول موضوعية سهلة المتابعة.",
    descriptionAr: "جلسات أسئلة وأجوبة مع حلول عملية لتحديات الحياة اليومية، مقسمة إلى فصول موضوعية سهلة المتابعة.",
    descriptionFr: "Sessions de questions-réponses avec des solutions pratiques pour les défis quotidiens, divisées en chapitres thématiques faciles à suivre.",
    descriptionEn: "Q&A sessions with practical solutions for daily life challenges, divided into easy-to-follow thematic chapters.",
    duration: "45 دقيقة",
    order: 5,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "تأمل",
    titleAr: "تأمل",
    titleFr: "Méditation",
    titleEn: "Meditation",
    description: "جلسات تأمل موجهة لتهدئة العقل وتقليل التوتر والقلق، مع تقنيات تنفس وتأمل متنوعة لجميع المستويات.",
    descriptionAr: "جلسات تأمل موجهة لتهدئة العقل وتقليل التوتر والقلق، مع تقنيات تنفس وتأمل متنوعة لجميع المستويات.",
    descriptionFr: "Sessions de méditation guidée pour calmer l'esprit et réduire le stress et l'anxiété, avec diverses techniques de respiration et méditation pour tous les niveaux.",
    descriptionEn: "Guided meditation sessions to calm the mind and reduce stress and anxiety, with various breathing and meditation techniques for all levels.",
    duration: "20 دقيقة",
    order: 6,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "تأكيدات إيجابية",
    titleAr: "تأكيدات إيجابية",
    titleFr: "Affirmations",
    titleEn: "Affirmations",
    description: "تأكيدات إيجابية يومية مصممة لإعادة برمجة العقل الباطن وبناء الثقة بالنفس وتعزيز التفكير الإيجابي.",
    descriptionAr: "تأكيدات إيجابية يومية مصممة لإعادة برمجة العقل الباطن وبناء الثقة بالنفس وتعزيز التفكير الإيجابي.",
    descriptionFr: "Affirmations positives quotidiennes conçues pour reprogrammer le subconscient, renforcer la confiance en soi et favoriser la pensée positive.",
    descriptionEn: "Daily positive affirmations designed to reprogram the subconscious mind, build self-confidence, and enhance positive thinking.",
    duration: "10 دقيقة",
    order: 7,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "علاج فني وترفيه",
    titleAr: "علاج فني وترفيه",
    titleFr: "Art thérapie",
    titleEn: "Art Therapy & Fun",
    description: "أنشطة فنية وترفيهية علاجية تشمل الرسم والأشغال اليدوية والموسيقى، للتعبير عن المشاعر وتحرير الطاقة السلبية.",
    descriptionAr: "أنشطة فنية وترفيهية علاجية تشمل الرسم والأشغال اليدوية والموسيقى، للتعبير عن المشاعر وتحرير الطاقة السلبية.",
    descriptionFr: "Activités artistiques et récréatives thérapeutiques incluant le dessin, l'artisanat et la musique, pour exprimer les émotions et libérer l'énergie négative.",
    descriptionEn: "Therapeutic art and recreational activities including drawing, crafts, and music, to express emotions and release negative energy.",
    duration: "60 دقيقة",
    order: 8,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "طبيب العقل",
    titleAr: "طبيب العقل",
    titleFr: "Attitude médecin",
    titleEn: "Mind Doctor",
    description: "برنامج متخصص لتدريب العقل على التفكير الإيجابي وتغيير الأنماط الفكرية السلبية وبناء عقلية قوية ومتوازنة.",
    descriptionAr: "برنامج متخصص لتدريب العقل على التفكير الإيجابي وتغيير الأنماط الفكرية السلبية وبناء عقلية قوية ومتوازنة.",
    descriptionFr: "Programme spécialisé pour entraîner l'esprit à la pensée positive, changer les schémas de pensée négatifs et construire un état d'esprit fort et équilibré.",
    descriptionEn: "A specialized program to train the mind in positive thinking, change negative thought patterns, and build a strong, balanced mindset.",
    duration: "45 دقيقة",
    order: 9,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "الطب الشمولي والتكاملي",
    titleAr: "الطب الشمولي والتكاملي",
    titleFr: "Médecine holistique",
    titleEn: "Holistic & Integrative Medicine",
    description: "نهج شمولي يجمع بين الطب التقليدي والبديل لعلاج الجسد والعقل معاً، يشمل العلاج بالأعشاب والتغذية العلاجية والطاقة.",
    descriptionAr: "نهج شمولي يجمع بين الطب التقليدي والبديل لعلاج الجسد والعقل معاً، يشمل العلاج بالأعشاب والتغذية العلاجية والطاقة.",
    descriptionFr: "Approche holistique combinant médecine traditionnelle et alternative pour traiter le corps et l'esprit ensemble, incluant la phytothérapie, la nutrition thérapeutique et l'énergie.",
    descriptionEn: "A holistic approach combining traditional and alternative medicine to treat body and mind together, including herbal therapy, therapeutic nutrition, and energy healing.",
    duration: "60 دقيقة",
    order: 10,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "ذاكرة الجسد",
    titleAr: "ذاكرة الجسد",
    titleFr: "Mémoire du corps",
    titleEn: "Body Memory",
    description: "تقنيات متقدمة لفهم وتحرير ذاكرة الجسد والصدمات المخزنة في الخلايا، من خلال حركات وعي وتمارين إطلاق بدنية.",
    descriptionAr: "تقنيات متقدمة لفهم وتحرير ذاكرة الجسد والصدمات المخزنة في الخلايا، من خلال حركات وعي وتمارين إطلاق بدنية.",
    descriptionFr: "Techniques avancées pour comprendre et libérer la mémoire du corps et les traumatismes stockés dans les cellules, par des mouvements conscients et des exercices de libération physique.",
    descriptionEn: "Advanced techniques to understand and release body memory and stored cellular trauma, through conscious movements and physical release exercises.",
    duration: "45 دقيقة",
    order: 11,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
  {
    title: "شفاء وعلاج طبي",
    titleAr: "شفاء وعلاج طبي",
    titleFr: "Médecine et guérison",
    titleEn: "Medical & Healing",
    description: "جلسات شفاء طبية متخصصة تجمع بين العلاج النفسي والطبي، مع متابعة دورية وخطط علاجية مخصصة لكل فرد.",
    descriptionAr: "جلسات شفاء طبية متخصصة تجمع بين العلاج النفسي والطبي، مع متابعة دورية وخطط علاجية مخصصة لكل فرد.",
    descriptionFr: "Sessions de guérison médicale spécialisées combinant thérapie psychologique et médicale, avec un suivi régulier et des plans de traitement personnalisés.",
    descriptionEn: "Specialized medical healing sessions combining psychological and medical therapy, with regular follow-up and customized treatment plans for each individual.",
    duration: "60 دقيقة",
    order: 12,
    isFree: false,
    price: 0,
    status: "published",
    category: "كوتشنغ",
  },
];

export async function POST(request: NextRequest) {
  // Block seed endpoints in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seed endpoints are disabled in production" }, { status: 403 });
  }

  try {
    // Verify admin access (session + admin code)
    const sessionAdminId = await requireAdmin();
    if (!sessionAdminId) {
      return NextResponse.json({ error: "Unauthorized - admin session required" }, { status: 401 });
    }

    const adminCode = request.headers.get("X-Admin-Code");
    if (!(await validateAdminCode(adminCode))) {
      return NextResponse.json({ error: "Unauthorized - invalid admin code" }, { status: 401 });
    }

    let created = 0;
    let skipped = 0;

    for (const item of SEED_COACHINGS) {
      // Check if a coaching item with this titleAr already exists
      const existing = await db.coaching.findMany();
      const alreadyExists = existing.some((e: any) => e.titleAr === item.titleAr);

      if (alreadyExists) {
        skipped++;
        continue;
      }

      await db.coaching.create({ data: item });
      created++;
    }

    return NextResponse.json({
      message: `Seeded coaching items: ${created} created, ${skipped} already existed`,
      created,
      skipped,
      total: SEED_COACHINGS.length,
    });
  } catch (error) {
    console.error("Seed coaching error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
