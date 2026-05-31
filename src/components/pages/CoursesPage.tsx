"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useUserWithFreshSubscription } from "@/hooks/useSubscription";
import { canAccessContentById } from "@/lib/content-access";
import { cachedFetch } from "@/lib/client-cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Clock,
  Users,
  Star,
  Search,
  ArrowRight,
  ArrowLeft,
  Lock,
  CheckCircle2,
  Play,
  Award,
  ChevronRight,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { toast } from "sonner";

interface Lesson {
  id: string;
  title: { ar: string; en: string; fr: string };
  duration: string;
  isFree: boolean;
  isCompleted: boolean;
}

interface Chapter {
  id: string;
  title: { ar: string; en: string; fr: string };
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: { ar: string; en: string; fr: string };
  description: { ar: string; en: string; fr: string };
  instructor: { ar: string; en: string; fr: string };
  image: string;
  gradient: string;
  chapters: Chapter[];
  totalLessons: number;
  totalDuration: string;
  students: number;
  rating: number;
  isFree: boolean;
  enrolled: boolean;
  progress: number;
  price: number;
}

const mockCourses: Course[] = [
  {
    id: "course-1",
    title: {
      ar: "أساسيات العلاج النفسي المعرفي السلوكي",
      en: "Fundamentals of CBT",
      fr: "Fondements de la TCC",
    },
    description: {
      ar: "تعرف على أساسيات العلاج المعرفي السلوكي وكيفية تطبيقه في حياتك اليومية لإدارة المشاعر السلبية وتغيير أنماط التفكير غير الصحية.",
      en: "Learn the fundamentals of Cognitive Behavioral Therapy and how to apply it in your daily life to manage negative emotions and change unhealthy thinking patterns.",
      fr: "Découvrez les fondamentaux de la thérapie cognitivo-comportementale et comment l'appliquer dans votre vie quotidienne.",
    },
    instructor: {
      ar: "د. سارة بن علي",
      en: "Dr. Sara Ben Ali",
      fr: "Dr. Sara Ben Ali",
    },
    image: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=400&h=250&fit=crop",
    gradient: "from-emerald-400 to-teal-600",
    totalLessons: 24,
    totalDuration: "12 ساعة",
    students: 1245,
    rating: 4.8,
    isFree: true,
    enrolled: true,
    progress: 65,
    price: 0,
    chapters: [
      {
        id: "ch-1-1",
        title: { ar: "مقدمة في العلاج المعرفي", en: "Introduction to Cognitive Therapy", fr: "Introduction à la thérapie cognitive" },
        lessons: [
          { id: "l-1-1-1", title: { ar: "ما هو العلاج المعرفي السلوكي؟", en: "What is CBT?", fr: "Qu'est-ce que la TCC ?" }, duration: "15:30", isFree: true, isCompleted: true },
          { id: "l-1-1-2", title: { ar: "تاريخ العلاج المعرفي السلوكي", en: "History of CBT", fr: "Histoire de la TCC" }, duration: "20:00", isFree: true, isCompleted: true },
          { id: "l-1-1-3", title: { ar: "الفرق بين العلاج المعرفي والسلوكي", en: "Cognitive vs Behavioral Therapy", fr: "Thérapie cognitive vs comportementale" }, duration: "18:45", isFree: false, isCompleted: false },
        ],
      },
      {
        id: "ch-1-2",
        title: { ar: "تحديد الأفكار التلقائية", en: "Identifying Automatic Thoughts", fr: "Identification des pensées automatiques" },
        lessons: [
          { id: "l-1-2-1", title: { ar: "أنماط التفكير المشوهة", en: "Distorted Thinking Patterns", fr: "Patterns de pensée déformés" }, duration: "22:10", isFree: false, isCompleted: true },
          { id: "l-1-2-2", title: { ar: "دفتر الأفكار اليومية", en: "Daily Thought Journal", fr: "Journal de pensées quotidien" }, duration: "25:00", isFree: false, isCompleted: false },
        ],
      },
      {
        id: "ch-1-3",
        title: { ar: "تقنيات تغيير السلوك", en: "Behavior Change Techniques", fr: "Techniques de changement comportemental" },
        lessons: [
          { id: "l-1-3-1", title: { ar: "التعريض التدريجي", en: "Gradual Exposure", fr: "Exposition graduelle" }, duration: "30:00", isFree: false, isCompleted: false },
          { id: "l-1-3-2", title: { ar: "تقنية التوقف الفكري", en: "Thought Stopping", fr: "Arrêt de la pensée" }, duration: "15:20", isFree: false, isCompleted: false },
        ],
      },
    ],
  },
  {
    id: "course-2",
    title: {
      ar: "فن الذكاء العاطفي",
      en: "The Art of Emotional Intelligence",
      fr: "L'Art de l'Intelligence Émotionnelle",
    },
    description: {
      ar: "طور مهاراتك في الذكاء العاطفي وتعلم كيفية فهم مشاعرك ومشاعر الآخرين، وبناء علاقات أقوى وأكثر صحة.",
      en: "Develop your emotional intelligence skills and learn to understand your feelings and those of others, building stronger and healthier relationships.",
      fr: "Développez vos compétences en intelligence émotionnelle et apprenez à comprendre vos sentiments et ceux des autres.",
    },
    instructor: {
      ar: "د. محمد أمين",
      en: "Dr. Mohamed Amine",
      fr: "Dr. Mohamed Amine",
    },
    image: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&h=250&fit=crop",
    gradient: "from-amber-400 to-orange-600",
    totalLessons: 18,
    totalDuration: "9 ساعات",
    students: 890,
    rating: 4.6,
    isFree: false,
    enrolled: false,
    progress: 0,
    price: 2500,
    chapters: [
      {
        id: "ch-2-1",
        title: { ar: "ما هو الذكاء العاطفي؟", en: "What is Emotional Intelligence?", fr: "Qu'est-ce que l'intelligence émotionnelle ?" },
        lessons: [
          { id: "l-2-1-1", title: { ar: "المكونات الخمسة للذكاء العاطفي", en: "The Five Components of EQ", fr: "Les cinq composantes de l'IE" }, duration: "20:00", isFree: true, isCompleted: false },
          { id: "l-2-1-2", title: { ar: "قياس الذكاء العاطفي", en: "Measuring Emotional Intelligence", fr: "Mesurer l'intelligence émotionnelle" }, duration: "15:30", isFree: true, isCompleted: false },
        ],
      },
      {
        id: "ch-2-2",
        title: { ar: "إدارة المشاعر", en: "Managing Emotions", fr: "Gestion des émotions" },
        lessons: [
          { id: "l-2-2-1", title: { ar: "التنظيم العاطفي", en: "Emotional Regulation", fr: "Régulation émotionnelle" }, duration: "25:00", isFree: false, isCompleted: false },
          { id: "l-2-2-2", title: { ar: "استراتيجيات التعامل مع الغضب", en: "Anger Management Strategies", fr: "Stratégies de gestion de la colère" }, duration: "22:45", isFree: false, isCompleted: false },
        ],
      },
    ],
  },
  {
    id: "course-3",
    title: {
      ar: "اليقظة الذهنية والتأمل الموجه",
      en: "Mindfulness & Guided Meditation",
      fr: "Pleine Conscience et Méditation Guidée",
    },
    description: {
      ar: "دورة شاملة لتعلم تقنيات اليقظة الذهنية والتأمل الموجه للحد من التوتر والقلق وتحسين جودة الحياة.",
      en: "A comprehensive course on mindfulness and guided meditation techniques to reduce stress and anxiety and improve quality of life.",
      fr: "Un cours complet sur les techniques de pleine conscience et de méditation guidée pour réduire le stress et l'anxiété.",
    },
    instructor: {
      ar: "أ. فاطمة الزهراء",
      en: "Ms. Fatima El Zahra",
      fr: "Mme Fatima El Zahra",
    },
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=250&fit=crop",
    gradient: "from-violet-400 to-purple-600",
    totalLessons: 30,
    totalDuration: "15 ساعة",
    students: 2100,
    rating: 4.9,
    isFree: false,
    enrolled: true,
    progress: 100,
    price: 3000,
    chapters: [
      {
        id: "ch-3-1",
        title: { ar: "مدخل إلى اليقظة الذهنية", en: "Introduction to Mindfulness", fr: "Introduction à la pleine conscience" },
        lessons: [
          { id: "l-3-1-1", title: { ar: "ما هي اليقظة الذهنية؟", en: "What is Mindfulness?", fr: "Qu'est-ce que la pleine conscience ?" }, duration: "12:00", isFree: true, isCompleted: true },
          { id: "l-3-1-2", title: { ar: "فوائد التأمل العلمية", en: "Scientific Benefits of Meditation", fr: "Bienfaits scientifiques de la méditation" }, duration: "18:00", isFree: true, isCompleted: true },
        ],
      },
      {
        id: "ch-3-2",
        title: { ar: "تمارين التأمل الأساسية", en: "Basic Meditation Exercises", fr: "Exercices de méditation de base" },
        lessons: [
          { id: "l-3-2-1", title: { ar: "تأمل التنفس الواعي", en: "Mindful Breathing Meditation", fr: "Méditation de respiration consciente" }, duration: "15:00", isFree: false, isCompleted: true },
          { id: "l-3-2-2", title: { ar: "مسح الجسم", en: "Body Scan Meditation", fr: "Scan corporel" }, duration: "20:00", isFree: false, isCompleted: true },
        ],
      },
    ],
  },
  {
    id: "course-4",
    title: {
      ar: "التغلب على القلق والوسواس",
      en: "Overcoming Anxiety & OCD",
      fr: "Surmonter l'Anxiété et le TOC",
    },
    description: {
      ar: "دورة متقدمة في فهم وإدارة اضطرابات القلق والوسواس القهري باستخدام أحدث التقنيات العلاجية.",
      en: "An advanced course in understanding and managing anxiety disorders and OCD using the latest therapeutic techniques.",
      fr: "Un cours avancé sur la compréhension et la gestion des troubles anxieux et du TOC.",
    },
    instructor: {
      ar: "د. خالد مراد",
      en: "Dr. Khaled Mourad",
      fr: "Dr. Khaled Mourad",
    },
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=250&fit=crop",
    gradient: "from-rose-400 to-pink-600",
    totalLessons: 20,
    totalDuration: "10 ساعات",
    students: 670,
    rating: 4.7,
    isFree: false,
    enrolled: false,
    progress: 0,
    price: 3500,
    chapters: [
      {
        id: "ch-4-1",
        title: { ar: "فهم اضطرابات القلق", en: "Understanding Anxiety Disorders", fr: "Comprendre les troubles anxieux" },
        lessons: [
          { id: "l-4-1-1", title: { ar: "أنواع اضطرابات القلق", en: "Types of Anxiety Disorders", fr: "Types de troubles anxieux" }, duration: "20:00", isFree: true, isCompleted: false },
          { id: "l-4-1-2", title: { ar: "أسباب القلق وعوامل الخطر", en: "Causes and Risk Factors", fr: "Causes et facteurs de risque" }, duration: "25:00", isFree: false, isCompleted: false },
        ],
      },
    ],
  },
];

const GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-cyan-600",
];

const mockReviews = [
  { id: "r1", name: { ar: "أحمد بوزيد", en: "Ahmed Bouzid", fr: "Ahmed Bouzid" }, rating: 5, comment: { ar: "دورة رائعة ومفيدة جداً، غيرت نظرتي للحياة!", en: "Amazing and very useful course, changed my perspective on life!", fr: "Cours incroyable et très utile, a changé ma perspective de vie !" } },
  { id: "r2", name: { ar: "نورة علي", en: "Noura Ali", fr: "Noura Ali" }, rating: 4, comment: { ar: "محتوى علمي ممتاز، أنصح به بشدة", en: "Excellent scientific content, highly recommended", fr: "Contenu scientifique excellent, fortement recommandé" } },
  { id: "r3", name: { ar: "ياسين حمداني", en: "Yassine Hamdani", fr: "Yassine Hamdani" }, rating: 5, comment: { ar: "شرح واضح وبسيط، سهل الفهم والتطبيق", en: "Clear and simple explanation, easy to understand and apply", fr: "Explication claire et simple, facile à comprendre et à appliquer" } },
];

export default function CoursesPage() {
  const { t, locale, dir } = useTranslation();
  const { pageParams, navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "paid">("all");
  const [apiCourses, setApiCourses] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasedContentIds, setPurchasedContentIds] = useState<string[]>([]);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedCourseForPurchase, setSelectedCourseForPurchase] = useState<Course | null>(null);

  // Fetch user purchases
  useEffect(() => {
    if (!userWithSub) return;
    fetch(`/api/user-access`)
      .then(res => res.json())
      .then(data => {
        if (data.purchasedContentIds) {
          setPurchasedContentIds(data.purchasedContentIds);
        }
      })
      .catch(() => {});
  }, [userWithSub]);

  useEffect(() => {
    cachedFetch<any>('/api/courses', 60_000)
      .then(data => {
        const courses = (data.courses || [])
          .filter((c: any) => c.status === 'published')
          .map((c: any, i: number) => ({
            id: c.id,
            title: { ar: c.titleAr || c.title, en: c.titleEn || c.title, fr: c.titleFr || c.title },
            description: { ar: c.descriptionAr || c.description, en: c.descriptionEn || c.description, fr: c.descriptionFr || c.description },
            instructor: { ar: c.instructor || "", en: c.instructor || "", fr: c.instructor || "" },
            image: c.image || c.thumbnail || "",
            gradient: GRADIENTS[i % GRADIENTS.length],
            chapters: (c.chapters || []).map((ch: any) => ({
              id: ch.id,
              title: { ar: ch.titleAr || ch.title, en: ch.titleEn || ch.title, fr: ch.titleFr || ch.title },
              lessons: (ch.lessons || []).map((l: any) => ({
                id: l.id,
                title: { ar: l.titleAr || l.title, en: l.titleEn || l.title, fr: l.titleFr || l.title },
                duration: l.duration || "",
                isFree: l.isFree || false,
                isCompleted: false,
              })),
            })),
            totalLessons: (c.chapters || []).reduce((acc: number, ch: any) => acc + (ch.lessons || []).length, 0),
            totalDuration: c.duration || "",
            students: 0,
            rating: c.avgRating || 0,
            isFree: c.isFree || false,
            enrolled: false,
            progress: 0,
            price: c.price || 0,
          }));
        if (courses.length > 0) setApiCourses(courses);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Compute enrolled dynamically based on current user - NOT baked into state
  const displayCourses = useMemo(() => {
    const base = apiCourses || mockCourses;
    return base.map(c => ({
      ...c,
      enrolled: canAccessContentById(userWithSub, 'courses' as any, c.id, c.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems),
    }));
  }, [apiCourses, userWithSub, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems]);

  const courseId = pageParams?.courseId as string | undefined;
  const selectedCourse = courseId
    ? displayCourses.find((c) => c.id === courseId)
    : null;

  const filteredCourses = useMemo(() => {
    return displayCourses.filter((course) => {
      const title = course.title[locale] || course.title.ar;
      const matchesSearch =
        !searchQuery || title.includes(searchQuery);
      const matchesFilter =
        filterType === "all" ||
        (filterType === "free" && course.isFree) ||
        (filterType === "paid" && !course.isFree);
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filterType, locale, displayCourses]);

  const localizedText = (obj: { ar: string; en: string; fr: string }) =>
    obj[locale] || obj.ar;

  const ArrowIcon = locale === "ar" ? ArrowLeft : ArrowRight;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
      >
        <div className="space-y-2">
          <div className="h-10 w-64 bg-muted animate-pulse rounded" />
          <div className="h-5 w-96 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-40 bg-muted animate-pulse rounded-xl" />
              <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // Detail View
  if (selectedCourse) {
    const course = selectedCourse;
    const totalCompleted = course.chapters.reduce(
      (acc, ch) => acc + ch.lessons.filter((l) => l.isCompleted).length,
      0
    );
    const totalAll = course.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);

    return (
      <motion.div
        dir={dir}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
      >
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate("courses")}
          className="gap-2"
        >
          <ArrowIcon className="h-4 w-4" />
          {t("courses.backToCourses")}
        </Button>

        {/* Course Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Image */}
            <div
              className={`relative h-48 sm:h-64 md:h-80 rounded-2xl bg-gradient-to-br ${course.gradient} overflow-hidden`}
            >
              <div className="absolute inset-0 bg-black/20 flex items-end p-6">
                <div className="text-white">
                  {course.isFree && (
                    <Badge className="bg-emerald-500 mb-2">
                      {t("common.free")}
                    </Badge>
                  )}
                  {!course.isFree && course.price > 0 && (
                    <Badge className="bg-teal-500 text-white border-0 mb-2">
                      {course.price.toLocaleString()} {t("common.currency")}
                    </Badge>
                  )}
                  {!course.isFree && course.price === 0 && (
                    <Badge variant="secondary" className="bg-white/20 text-white border-0 mb-2">
                      {t("common.paid")}
                    </Badge>
                  )}
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                    {localizedText(course.title)}
                  </h1>
                </div>
              </div>
              <BookOpen className="absolute top-6 right-6 h-16 w-16 text-white/20" />
            </div>

            {/* Course Info */}
            <div className="space-y-4">
              <p className="text-muted-foreground text-base leading-relaxed">
                {localizedText(course.description)}
              </p>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>{course.students} {t("courses.students")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>{course.rating}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{course.totalDuration}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  <span>{course.chapters.length} {t("courses.chapters")} - {course.totalLessons} {t("courses.lessons")}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold text-sm">
                    {localizedText(course.instructor).charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{t("courses.instructor")}</p>
                  <p className="text-sm text-muted-foreground">{localizedText(course.instructor)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Curriculum */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {t("courses.curriculum")}
              </h2>
              <Accordion type="multiple" className="space-y-3">
                {course.chapters.map((chapter) => (
                  <AccordionItem
                    key={chapter.id}
                    value={chapter.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="text-right hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-start">
                          <span className="font-medium">{localizedText(chapter.title)}</span>
                          <span className="text-sm text-muted-foreground ms-2">
                            {chapter.lessons.length} {t("courses.lessons")}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pb-2">
                        {chapter.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            {lesson.isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                            ) : (
                              <Play className="h-5 w-5 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">
                                  {localizedText(lesson.title)}
                                </p>
                                {!lesson.isFree && !course.enrolled && (
                                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                <Clock className="h-3 w-3" />
                                {lesson.duration}
                                {lesson.isFree && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {t("common.free")}
                                  </Badge>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <Separator />

            {/* Reviews Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                {t("reviews.title")} ({mockReviews.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockReviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold text-sm">
                            {localizedText(review.name).charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{localizedText(review.name)}</p>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i < review.rating
                                    ? "text-amber-500 fill-amber-500"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{localizedText(review.comment)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  {/* Progress Circle */}
                  {course.enrolled && course.progress > 0 && (
                    <div className="flex flex-col items-center gap-3 mb-4">
                      <div className="relative h-28 w-28">
                        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                          <circle
                            cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                            strokeDasharray={`${course.progress * 2.64} ${264 - course.progress * 2.64}`}
                            strokeLinecap="round"
                            className="text-primary"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold">{course.progress}%</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {totalCompleted} / {totalAll} {t("courses.lessons")}
                      </p>
                    </div>
                  )}

                  {/* Price Display */}
                  {!course.isFree && course.price > 0 && (
                    <div className="text-center py-3">
                      <p className="text-sm text-muted-foreground">{t("common.priceLabel")}</p>
                      <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">{course.price.toLocaleString()} <span className="text-base font-normal">{t("common.currency")}</span></p>
                    </div>
                  )}

                  {/* Action Button */}
                  {!course.isFree && !course.enrolled && (
                    <div className="space-y-3">
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <Lock className="h-4 w-4 shrink-0" />
                          {locale === "ar" ? "هذا المحتوى مدفوع. قم بالاشتراك للوصول إليه." : locale === "fr" ? "Ce contenu est payant. Abonnez-vous pour y accéder." : "This content requires a subscription."}
                        </p>
                      </div>
                      {individualPurchasesEnabled && (
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => {
                            setSelectedCourseForPurchase(course);
                            setPurchaseDialogOpen(true);
                          }}
                        >
                          {t("common.buyNow")}
                        </Button>
                      )}
                    </div>
                  )}
                  {course.enrolled && course.progress < 100 && (
                    <Button className="w-full" size="lg" onClick={() => toast.info(locale === "ar" ? "سيتم تفعيل التسجيل قريباً" : locale === "fr" ? "L'inscription sera bientôt disponible" : "Enrollment will be available soon")}>
                      <Play className="h-4 w-4 me-2" />
                      {t("courses.continue")}
                    </Button>
                  )}
                  {course.enrolled && course.progress === 100 && (
                    <Button className="w-full" size="lg" variant="secondary">
                      <Award className="h-4 w-4 me-2" />
                      {t("courses.certificate")}
                    </Button>
                  )}
                  {course.isFree && !course.enrolled && (
                    <Button className="w-full" size="lg" onClick={() => toast.info(locale === "ar" ? "سيتم تفعيل التسجيل قريباً" : locale === "fr" ? "L'inscription sera bientôt disponible" : "Enrollment will be available soon")}>
                      {t("courses.enroll")}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Course Info Card */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold">{t("courses.totalDuration")}</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t("courses.lessons")}</span>
                      <span className="font-medium text-foreground">{course.totalLessons}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("courses.chapters")}</span>
                      <span className="font-medium text-foreground">{course.chapters.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("courses.students")}</span>
                      <span className="font-medium text-foreground">{course.students}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("common.rating")}</span>
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        {course.rating}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Purchase Dialog */}
        <PurchaseDialog
          open={purchaseDialogOpen}
          onOpenChange={setPurchaseDialogOpen}
          itemTitle={selectedCourseForPurchase ? localizedText(selectedCourseForPurchase.title) : ""}
          itemPrice={selectedCourseForPurchase?.price || 0}
          contentId={selectedCourseForPurchase?.id || ""}
          contentType="courses"
          contentTitleAr={selectedCourseForPurchase?.title.ar || ""}
        />
      </motion.div>
    );
  }

  // Listing View
  return (
    <motion.div
      dir={dir}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">{t("courses.title")}</h1>
        <p className="text-muted-foreground text-base max-w-2xl">{t("courses.description")}</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search") + "..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-10"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "free", "paid"] as const).map((type) => (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(type)}
            >
              {t(`common.${type}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Course Grid */}
      <AnimatePresence mode="wait">
        {filteredCourses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{t("common.noResults")}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 h-full"
                  onClick={() => navigate("courses", { courseId: course.id })}
                >
                  {/* Card Image */}
                  <div className={`relative h-40 bg-gradient-to-br ${course.gradient} overflow-hidden`}>
                    {course.image && <img src={course.image} alt={localizedText(course.title)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                    <BookOpen className="absolute bottom-3 start-3 h-8 w-8 text-white/30" />
                    {course.isFree ? (
                      <Badge className="absolute top-3 start-3 bg-emerald-500 border-0">
                        {t("common.free")}
                      </Badge>
                    ) : course.price > 0 ? (
                      <Badge className="absolute top-3 start-3 bg-teal-600 text-white border-0">
                        {course.price.toLocaleString()} {t("common.currency")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="absolute top-3 start-3 bg-white/90 text-foreground border-0">
                        {t("common.paid")}
                      </Badge>
                    )}
                    <div className="absolute top-3 end-3 flex items-center gap-1 bg-black/40 text-white text-xs px-2 py-1 rounded-full">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      {course.rating}
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {localizedText(course.title)}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {localizedText(course.description)}
                    </p>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {course.chapters.length} {t("courses.chapters")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Play className="h-3.5 w-3.5" />
                        {course.totalLessons} {t("courses.lessons")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {course.totalDuration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {course.students}
                      </span>
                      {course.price > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400">
                          {course.price.toLocaleString()} {t("common.currency")}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar (if enrolled) */}
                    {course.enrolled && course.progress > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{t("courses.progress")}</span>
                          <span className="font-medium">{course.progress}%</span>
                        </div>
                        <Progress value={course.progress} className="h-2" />
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="mt-auto pt-2">
                      {!course.isFree && course.price > 0 && !course.enrolled && (
                        <div className="flex items-center justify-between">
                          {individualPurchasesEnabled && (
                            <span className="font-bold text-teal-600 dark:text-teal-400">{course.price.toLocaleString()} {t("common.currency")}</span>
                          )}
                          {individualPurchasesEnabled && (
                            <Button className="flex-1 ms-3" size="sm" onClick={() => {
                              setSelectedCourseForPurchase(course);
                              setPurchaseDialogOpen(true);
                            }}>
                              {t("common.buyNow")}
                            </Button>
                          )}
                          {!individualPurchasesEnabled && (
                            <Button className="w-full" size="sm" variant="secondary" disabled>
                              <Lock className="h-4 w-4 me-2" />
                              {t("common.subscribeToAccess")}
                            </Button>
                          )}
                        </div>
                      )}
                      {!course.enrolled && course.isFree && (
                        <Button className="w-full" size="sm" onClick={() => toast.info(locale === "ar" ? "سيتم تفعيل التسجيل قريباً" : locale === "fr" ? "L'inscription sera bientôt disponible" : "Enrollment will be available soon")}>
                          {t("courses.enroll")}
                        </Button>
                      )}
                      {!course.enrolled && !course.isFree && course.price === 0 && (
                        <Button className="w-full" size="sm" onClick={() => toast.info(locale === "ar" ? "سيتم تفعيل التسجيل قريباً" : locale === "fr" ? "L'inscription sera bientôt disponible" : "Enrollment will be available soon")}>
                          {t("courses.enroll")}
                        </Button>
                      )}
                      {course.enrolled && course.progress < 100 && (
                        <Button className="w-full" size="sm" variant="secondary" onClick={() => toast.info(locale === "ar" ? "سيتم تفعيل التسجيل قريباً" : locale === "fr" ? "L'inscription sera bientôt disponible" : "Enrollment will be available soon")}>
                          {t("courses.continue")}
                        </Button>
                      )}
                      {course.enrolled && course.progress === 100 && (
                        <Button className="w-full" size="sm" variant="outline">
                          <CheckCircle2 className="h-4 w-4 me-1.5 text-emerald-500" />
                          {t("courses.completed")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        itemTitle={selectedCourseForPurchase ? localizedText(selectedCourseForPurchase.title) : ""}
        itemPrice={selectedCourseForPurchase?.price || 0}
        contentId={selectedCourseForPurchase?.id || ""}
        contentType="courses"
        contentTitleAr={selectedCourseForPurchase?.title.ar || ""}
      />
    </motion.div>
  );
}
