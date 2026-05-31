"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  FileText,
  Headphones,
  PlayCircle,
  FileDown,
  Radio,
  Star,
  Users,
  BookMarked,
  Clock,
  ChevronLeft,
  ChevronRight,
  Play,
  ArrowLeft,
  Quote,
  Sparkles,
  Heart,
  Video,
  Settings,
  Pencil,
  Mic,
  Dumbbell,
  TreePine,
  MessageCircleQuestion,
  Brain,
  Palette,
  Stethoscope,
  Leaf,
  HandHeart,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import type { PageName } from "@/lib/store";
import { cachedFetch } from "@/lib/client-cache";

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

/* ------------------------------------------------------------------ */
/*  Animated counter hook                                              */
/* ------------------------------------------------------------------ */

function useAnimatedCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(target === 0 ? 0 : 0);
  const startedRef = useRef(target === 0);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let current = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 16);
  }, [target, duration]);

  return { count, start };
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockFeaturedCourses = [
  {
    id: 1,
    title: "أساسيات العلاج النفسي",
    description: "تعرف على مبادئ العلاج النفسي وأساسياته",
    image: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=400&h=250&fit=crop",
    progress: 75,
    lessons: 24,
    duration: "12 ساعة",
  },
  {
    id: 2,
    title: "الذكاء العاطفي",
    description: "طور مهاراتك في فهم وإدارة مشاعرك",
    image: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&h=250&fit=crop",
    progress: 40,
    lessons: 18,
    duration: "8 ساعات",
  },
  {
    id: 3,
    title: "التأمل والاسترخاء",
    description: "تقنيات التأمل العميق والاسترخاء العضلي",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=250&fit=crop",
    progress: 0,
    lessons: 15,
    duration: "6 ساعات",
  },
  {
    id: 4,
    title: "بناء الثقة بالنفس",
    description: "استراتيجيات فعالة لتعزيز الثقة بالنفس",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=250&fit=crop",
    progress: 90,
    lessons: 20,
    duration: "10 ساعات",
  },
];

const mockArticles = [
  {
    id: 1,
    title: "كيف تتغلب على القلق والخوف",
    excerpt: "تعرف على أفضل التقنيات العلمية للتعامل مع القلق والخوف في حياتك اليومية...",
    image: "https://images.unsplash.com/photo-1474418397713-7ede21d49118?w=400&h=250&fit=crop",
    readTime: "5 دقائق",
    author: "د. سارة أحمد",
  },
  {
    id: 2,
    title: "أهمية النوم في الصحة النفسية",
    excerpt: "العلاقة الوثيقة بين جودة النوم والصحة النفسية وكيفية تحسين عادات النوم...",
    image: "https://images.unsplash.com/photo-1515894203077-9cd36032142f?w=400&h=250&fit=crop",
    readTime: "7 دقائق",
    author: "د. محمد علي",
  },
  {
    id: 3,
    title: "فن التواصل الفعّال",
    excerpt: "مهارات التواصل التي ستغير علاقاتك وتحسن حياتك الشخصية والمهنية...",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=250&fit=crop",
    readTime: "4 دقائق",
    author: "أ. نورة الخالدي",
  },
  {
    id: 4,
    title: "التعامل مع ضغوط الحياة",
    excerpt: "استراتيجيات عملية لإدارة التوتر والضغوط اليومية بفعالية...",
    image: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&h=250&fit=crop",
    readTime: "6 دقائق",
    author: "د. خالد العمري",
  },
];

const mockPodcasts = [
  { id: 1, episode: 1, title: "بداية رحلة التعافي", duration: "45:30" },
  { id: 2, episode: 2, title: "فهم المشاعر والعواطف", duration: "38:15" },
  { id: 3, episode: 3, title: "العلاقات الصحية", duration: "52:00" },
  { id: 4, episode: 4, title: "قوة التفكير الإيجابي", duration: "41:20" },
  { id: 5, episode: 5, title: "التوازن بين العمل والحياة", duration: "35:45" },
];

const mockTestimonials = [
  {
    id: 1,
    name: "فاطمة الزهراء",
    text: "منصة رائعة غيّرت نظرتي للحياة. الدورات متميزة والمحتوى علمي وموثوق. أنصح بها كل من يبحث عن التطوير الذاتي.",
    rating: 5,
    avatar: "FZ",
  },
  {
    id: 2,
    name: "أحمد بن عمر",
    text: "بدأت رحلتي مع فضاء الشفاء منذ ستة أشهر والنتائج مذهلة. أفضل استثمار قمت به في صحتي النفسية.",
    rating: 5,
    avatar: "AB",
  },
  {
    id: 3,
    name: "سارة محمود",
    text: "المحتوى متنوع وغني والمدربون محترفون. ساعدتني المنصة كثيراً في التغلب على تحدياتي النفسية.",
    rating: 4,
    avatar: "SM",
  },
];

/* ------------------------------------------------------------------ */
/*  Service card config                                                */
/* ------------------------------------------------------------------ */

type ServiceConfig = {
  key: PageName;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  descKey: string;
  image: string;
};

const services: ServiceConfig[] = [
  { key: "courses", icon: BookOpen, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", descKey: "courses.description", image: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=400&h=250&fit=crop" },
  { key: "articles", icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", descKey: "articles.description", image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=250&fit=crop" },
  { key: "podcasts", icon: Headphones, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", descKey: "podcasts.description", image: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=250&fit=crop" },
  { key: "videos", icon: PlayCircle, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", descKey: "videos.description", image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=250&fit=crop" },
  { key: "pdfs", icon: FileDown, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", descKey: "pdfs.description", image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=250&fit=crop" },
  { key: "live", icon: Radio, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200", descKey: "live.description", image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=250&fit=crop" },
  { key: "coaching", icon: Sparkles, color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-200", descKey: "coaching.description", image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=250&fit=crop" },
];

/* ------------------------------------------------------------------ */
/*  Stats config                                                       */
/* ------------------------------------------------------------------ */

const stats = [
  { value: 1200, suffix: "+", labelKey: "admin.totalMembers", icon: Users },
  { value: 55, suffix: "+", labelKey: "admin.totalCourses", icon: BookMarked },
  { value: 230, suffix: "+", labelKey: "articles.title", icon: FileText },
  { value: 4.9, suffix: "", labelKey: "reviews.rating", icon: Star, isFloat: true },
];

/* ------------------------------------------------------------------ */
/*  StatCard component (needed so useAnimatedCounter is a proper hook) */
/* ------------------------------------------------------------------ */

function StatCard({
  stat,
  label,
}: {
  stat: (typeof stats)[number];
  label: string;
}) {
  const counter = useAnimatedCounter(
    stat.isFloat ? Math.floor(stat.value * 10) : stat.value,
    2000
  );
  const Icon = stat.icon;

  return (
    <motion.div
      variants={fadeUp}
      className="text-center"
      onViewportEnter={counter.start}
      viewport={{ once: true }}
    >
      <div className="mb-3 flex justify-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <Icon className="size-7 text-white" />
        </div>
      </div>
      <div className="mb-1 text-3xl font-bold text-white sm:text-4xl">
        {stat.isFloat
          ? `${(counter.count / 10).toFixed(1)}${stat.suffix}`
          : `${counter.count.toLocaleString()}${stat.suffix}`}
      </div>
      <div className="text-sm text-white/80">{label}</div>
    </motion.div>
  );
}

/* ================================================================== */
/*  HomePage                                                           */
/* ================================================================== */

/* ------------------------------------------------------------------ */
/*  Slider type                                                       */
/* ------------------------------------------------------------------ */

type SliderItem = {
  id: string;
  imageUrl: string;
  title: string;
  titleAr?: string;
  titleFr?: string;
  titleEn?: string;
  description?: string;
  order: number;
  link?: string;
};

/* ================================================================== */
/*  HomePage                                                           */
/* ================================================================== */

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useAppStore((s) => s.navigate);
  const locale = useAppStore((s) => s.locale);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const user = useAppStore((s) => s.user);
  const dir = useAppStore((s) => (s.locale === "ar" ? "rtl" : "ltr"));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [apiFeaturedCourses, setApiFeaturedCourses] = useState<typeof mockFeaturedCourses | null>(null);
  const [apiArticles, setApiArticles] = useState<typeof mockArticles | null>(null);
  const [apiPodcasts, setApiPodcasts] = useState<typeof mockPodcasts | null>(null);

  // Helper: read cached homepage settings from localStorage (prevents flash of default content)
  const getCachedSettings = (key: string): Record<string, string> | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(`hs_${key}`);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.ar || parsed.fr || parsed.en)) return parsed;
      return null;
    } catch { return null; }
  };

  // Dynamic homepage settings from API (initialized from localStorage cache to prevent flash)
  const [heroTitleOverride, setHeroTitleOverride] = useState<Record<string, string> | null>(() => getCachedSettings('heroTitle'));
  const [heroSubtitleOverride, setHeroSubtitleOverride] = useState<Record<string, string> | null>(() => getCachedSettings('heroSubtitle'));
  const [heroDescriptionOverride, setHeroDescriptionOverride] = useState<Record<string, string> | null>(() => getCachedSettings('heroDescription'));
  const [siteOwnerNameOverride, setSiteOwnerNameOverride] = useState<Record<string, string> | null>(() => getCachedSettings('siteOwnerNameSetting'));
  const [ctaButton1Override, setCtaButton1Override] = useState<Record<string, string> | null>(() => getCachedSettings('ctaButton1'));
  const [ctaButton2Override, setCtaButton2Override] = useState<Record<string, string> | null>(() => getCachedSettings('ctaButton2'));
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('hs_introVideoUrl');
      if (cached) return cached;
    } catch { /* ignore */ }
    return null;
  });

  // Section visibility state
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const cached = localStorage.getItem('hs_sectionVisibility');
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
    return {};
  });

  const isSectionVisible = (key: string) => sectionVisibility[key] !== false; // Default: visible
  const [sliders, setSliders] = useState<SliderItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem('hs_sliders');
      if (!cached) return [];
      return JSON.parse(cached);
    } catch { return []; }
  });

  const displayFeaturedCourses = apiFeaturedCourses || mockFeaturedCourses;
  const displayArticles = apiArticles || mockArticles;
  const displayPodcasts = apiPodcasts || mockPodcasts;

  // Helper: get localized override value, fallback to i18n translation
  const getOverride = (override: Record<string, string> | null, fallback: string) => {
    if (!override) return fallback;
    const val = override[locale];
    if (val && val.trim()) return val;
    // Try other languages as fallback
    for (const lang of ["ar", "fr", "en"]) {
      if (override[lang] && override[lang].trim()) return override[lang];
    }
    return fallback;
  };

  // Computed hero text values (API override > i18n fallback)
  const heroTitle = getOverride(heroTitleOverride, t("home.heroTitle"));
  const heroSubtitle = getOverride(heroSubtitleOverride, t("home.heroSubtitle"));
  const heroDesc = getOverride(heroDescriptionOverride, t("home.heroDescription"));
  const ownerName = getOverride(siteOwnerNameOverride, t("siteOwner.name"));
  const cta1 = getOverride(ctaButton1Override, locale === "ar" ? "ابدأ رحلة الشفاء" : locale === "fr" ? "Commencer" : "Start Healing");
  const cta2 = getOverride(ctaButton2Override, locale === "ar" ? "تصفح المحتوى" : locale === "fr" ? "Parcourir" : "Browse Content");

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
  }, []);

  useEffect(() => {
    Promise.all([
      cachedFetch('/api/courses?status=published&limit=4', 60_000).catch(() => ({})),
      cachedFetch('/api/articles?status=published&limit=4', 60_000).catch(() => ({})),
      cachedFetch('/api/podcasts?status=published&limit=4', 60_000).catch(() => ({})),
      cachedFetch('/api/public-settings', 120_000).catch(() => ({})),
      cachedFetch('/api/sliders', 120_000).catch(() => ({})),
    ]).then(([coursesData, articlesData, podcastsData, settingsData, slidersData]: any[]) => {
      // Courses (already filtered by API)
      const courses = (coursesData.courses || [])
        .map((c: any) => ({
          id: c.id,
          title: locale === 'fr' ? (c.titleFr || c.titleAr || c.title) : locale === 'en' ? (c.titleEn || c.titleAr || c.title) : (c.titleAr || c.title),
          description: locale === 'fr' ? (c.descriptionFr || c.descriptionAr || c.description) : locale === 'en' ? (c.descriptionEn || c.descriptionAr || c.description) : (c.descriptionAr || c.description),
          image: c.image || c.thumbnail || "",
          progress: 0,
          lessons: (c.chapters || []).reduce((acc: number, ch: any) => acc + (ch.lessons || []).length, 0),
          duration: c.duration || "",
        }));
      if (courses.length > 0) setApiFeaturedCourses(courses);

      // Articles (already filtered by API)
      const articles = (articlesData.articles || [])
        .map((a: any) => ({
          id: a.id,
          title: locale === 'fr' ? (a.titleFr || a.titleAr || a.title) : locale === 'en' ? (a.titleEn || a.titleAr || a.title) : (a.titleAr || a.title),
          excerpt: locale === 'fr' ? (a.descriptionFr || a.descriptionAr || a.description) : locale === 'en' ? (a.descriptionEn || a.descriptionAr || a.description) : (a.descriptionAr || a.description),
          image: a.image || a.thumbnail || "",
          readTime: a.readTime ? `${a.readTime} ${t("articles.minute")}` : "5 دقائق",
          author: a.author || "",
        }));
      if (articles.length > 0) setApiArticles(articles);

      // Podcasts from API (already filtered by API)
      const podcasts = (podcastsData.podcasts || [])
        .map((p: any) => ({
          id: p.id,
          title: locale === 'fr' ? (p.titleFr || p.titleAr || p.title) : locale === 'en' ? (p.titleEn || p.titleAr || p.title) : (p.titleAr || p.title),
          host: p.author || p.instructor || "",
          duration: p.duration || "",
          episodes: 1,
        }));
      if (podcasts.length > 0) setApiPodcasts(podcasts);

      // Homepage settings from API
      const settings = settingsData.settings || {};
      const parseTrilingual = (key: string): Record<string, string> | null => {
        if (!settings[key]) return null;
        try {
          const parsed = JSON.parse(settings[key]);
          // Only return if at least one language has a value
          if (parsed.ar || parsed.fr || parsed.en) return parsed;
          return null;
        } catch { return null; }
      };
      const heroTitleVal = parseTrilingual('heroTitle');
      const heroSubtitleVal = parseTrilingual('heroSubtitle');
      const heroDescVal = parseTrilingual('heroDescription');
      const ownerNameVal = parseTrilingual('siteOwnerNameSetting');
      const cta1Val = parseTrilingual('ctaButton1');
      const cta2Val = parseTrilingual('ctaButton2');

      // Intro video URL (simple string, not trilingual)
      const introVideo = settings.introVideoUrl || null;
      setIntroVideoUrl(introVideo);
      if (introVideo) localStorage.setItem('hs_introVideoUrl', introVideo);
      else localStorage.removeItem('hs_introVideoUrl');

      // Section visibility
      if (settings.sectionVisibility) {
        try {
          const parsed = JSON.parse(settings.sectionVisibility);
          setSectionVisibility(parsed);
          localStorage.setItem('hs_sectionVisibility', JSON.stringify(parsed));
        } catch { /* keep defaults */ }
      }

      setHeroTitleOverride(heroTitleVal);
      setHeroSubtitleOverride(heroSubtitleVal);
      setHeroDescriptionOverride(heroDescVal);
      setSiteOwnerNameOverride(ownerNameVal);
      setCtaButton1Override(cta1Val);
      setCtaButton2Override(cta2Val);

      // Cache to localStorage for instant load on refresh
      if (heroTitleVal) localStorage.setItem('hs_heroTitle', JSON.stringify(heroTitleVal));
      if (heroSubtitleVal) localStorage.setItem('hs_heroSubtitle', JSON.stringify(heroSubtitleVal));
      if (heroDescVal) localStorage.setItem('hs_heroDescription', JSON.stringify(heroDescVal));
      if (ownerNameVal) localStorage.setItem('hs_siteOwnerNameSetting', JSON.stringify(ownerNameVal));
      if (cta1Val) localStorage.setItem('hs_ctaButton1', JSON.stringify(cta1Val));
      if (cta2Val) localStorage.setItem('hs_ctaButton2', JSON.stringify(cta2Val));

      // Sliders
      const sliderItems = (slidersData.sliders || [])
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((s: any) => ({
          id: s.id,
          imageUrl: s.imageUrl || s.image || "",
          title: s.title || "",
          titleAr: s.titleAr || "",
          titleFr: s.titleFr || "",
          titleEn: s.titleEn || "",
          description: s.description || "",
          order: s.order || 0,
          link: s.link || "",
        }));
      setSliders(sliderItems);
      if (sliderItems.length > 0) localStorage.setItem('hs_sliders', JSON.stringify(sliderItems));
    });
  }, []);

  const scrollCourses = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 320;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
    setTimeout(checkScroll, 350);
  };

  const navKey = (key: string) => `nav.${key}` as const;

  return (
    <div className="min-h-screen" dir={dir}>
      {/* ============================================================ */}
      {/* HERO SECTION                                                  */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-emerald-50/80 to-white dark:from-teal-950/30 dark:via-emerald-950/20 dark:to-background">
        {/* Subtle gradient washes */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/4 -left-1/4 h-[60%] w-[60%] rounded-full bg-teal-400/5 dark:bg-teal-700/8 blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 h-[50%] w-[50%] rounded-full bg-amber-300/4 dark:bg-amber-700/6 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <motion.div
            className="flex flex-col items-center text-center"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.15 } },
            }}
          >
            {/* Sliders Carousel (if any) */}
            {sliders.length > 0 && (
              <motion.div variants={fadeUp} custom={0} className="w-full max-w-4xl mb-8">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-teal-500/10">
                  <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none">
                    {sliders.map((slider, idx) => (
                      <div
                        key={slider.id}
                        className="flex-shrink-0 w-full snap-center relative cursor-pointer"
                        onClick={() => slider.link ? window.open(slider.link, '_blank') : undefined}
                      >
                        <div className="relative h-48 sm:h-64 md:h-72">
                          <img
                            src={slider.imageUrl}
                            alt={slider.titleAr || slider.titleFr || slider.titleEn || slider.title}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          {(slider.title || slider.titleAr || slider.titleFr || slider.titleEn) && (
                            <div className="absolute bottom-4 start-4 end-4">
                              <h3 className="text-white text-lg font-bold drop-shadow-lg">
                                {locale === "ar" ? (slider.titleAr || slider.title) : locale === "fr" ? (slider.titleFr || slider.title) : (slider.titleEn || slider.title)}
                              </h3>
                              {slider.description && (
                                <p className="text-white/80 text-sm mt-1 line-clamp-2 drop-shadow">{slider.description}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Slider dots indicator */}
                  {sliders.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {sliders.map((_, idx) => (
                        <div key={idx} className="size-2 rounded-full bg-white/50" />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Badge */}
            <motion.div variants={fadeUp} custom={0}>
              <Badge variant="secondary" className="mb-6 gap-1.5 rounded-full px-4 py-1.5 text-sm">
                <Sparkles className="size-3.5" />
                {heroSubtitle}
              </Badge>
            </motion.div>

            {/* Title */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="mb-4 bg-gradient-to-r from-teal-600 via-emerald-500 to-cyan-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl lg:text-6xl"
            >
              {heroTitle}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mb-2 max-w-2xl text-xl font-medium text-muted-foreground sm:text-2xl"
            >
              {heroSubtitle}
            </motion.p>
            <motion.p
              variants={fadeUp}
              custom={2.5}
              className="mb-8 max-w-2xl text-lg font-semibold text-primary"
            >
              ✦ {ownerName}
            </motion.p>

            {/* Description */}
            <motion.p
              variants={fadeUp}
              custom={3}
              className="mb-8 max-w-2xl text-base leading-relaxed text-muted-foreground/80 sm:text-lg"
            >
              {heroDesc}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={fadeUp}
              custom={4}
              className="flex flex-col gap-3 sm:flex-row sm:gap-4"
            >
              <Button
                size="lg"
                className="min-w-[200px] gap-2 rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 px-8 text-base shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30"
                onClick={() => navigate("courses")}
              >
                <Heart className="size-5" />
                {cta1}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-w-[200px] gap-2 rounded-full border-2 px-8 text-base"
                onClick={() => navigate("subscriptions")}
              >
                {cta2}
                <ArrowLeft className="size-5" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* INTRO VIDEO SECTION — with prominent play button              */}
      {/* ============================================================ */}
      {introVideoUrl && isSectionVisible("video") && (
        <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <motion.div
              className="mb-8 text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUp}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <Video className="size-6 text-teal-600" />
                <h2 className="text-2xl font-bold sm:text-3xl">{t("home.introVideoTitle")}</h2>
              </div>
              <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" />
            </motion.div>

            <motion.div
              className="relative rounded-2xl overflow-hidden shadow-2xl shadow-teal-500/10 bg-black"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={scaleIn}
            >
              {introVideoUrl.includes('youtube.com') || introVideoUrl.includes('youtu.be') ? (
                /* ── YouTube embed ── */
                <div className="relative aspect-video">
                  {!showVideo ? (
                    <div
                      className="absolute inset-0 cursor-pointer group"
                      onClick={() => setShowVideo(true)}
                    >
                      <img
                        src={`https://img.youtube.com/vi/${introVideoUrl.match(/[\w-]{11}/)?.[0] || ''}/maxresdefault.jpg`}
                        alt="Video thumbnail"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                        <div className="flex size-20 items-center justify-center rounded-full bg-white/90 shadow-2xl group-hover:scale-110 transition-transform">
                          <Play className="size-10 text-teal-600 ms-1" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      src={`${introVideoUrl}${introVideoUrl.includes('?') ? '&' : '?'}autoplay=1&rel=0`}
                      title={t("home.introVideoTitle")}
                      className="absolute inset-0 h-full w-full"
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              ) : (
                /* ── Direct video file (HTML5 <video>) ── */
                <div className="relative aspect-video">
                  {!showVideo ? (
                    <div
                      className="absolute inset-0 cursor-pointer group"
                      onClick={() => setShowVideo(true)}
                    >
                      <img
                        src={introVideoUrl.includes('res.cloudinary.com')
                          ? introVideoUrl.replace(/\/upload\/.*?\//, '/upload/so_0,w_800,h_450,c_pad,f_jpg/')
                          : undefined
                        }
                        alt="Video thumbnail"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent flex items-center justify-center group-hover:from-black/60 transition-colors">
                        <div className="flex size-20 items-center justify-center rounded-full bg-white/90 shadow-2xl group-hover:scale-110 transition-transform">
                          <Play className="size-10 text-teal-600 ms-1" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <video
                      className="absolute inset-0 h-full w-full object-contain bg-black"
                      controls
                      playsInline
                      autoPlay
                      preload="metadata"
                      poster={introVideoUrl.includes('res.cloudinary.com')
                        ? introVideoUrl.replace(/\/upload\/.*?\//, '/upload/so_0,w_800,h_450,c_pad,f_jpg/')
                        : undefined
                      }
                    >
                      <source src={introVideoUrl} />
                      {t("home.videoNotSupported")}
                    </video>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* SERVICES GRID                                                 */}
      {/* ============================================================ */}
      {isSectionVisible("services") && (
      <section className="bg-background px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="mb-12 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t("home.ourServices")}</h2>
            <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" />
          </motion.div>

          <motion.div
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              visible: { transition: { staggerChildren: 0.1 } },
            }}
          >
            {services.map((svc) => {
              const Icon = svc.icon;
              return (
                <motion.div key={svc.key} variants={fadeUp}>
                  <Card
                    className={`group cursor-pointer border ${svc.border} bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden`}
                    onClick={() => navigate(svc.key)}
                  >
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={svc.image}
                        alt={t(navKey(svc.key))}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className={`absolute bottom-3 start-3 flex size-10 items-center justify-center rounded-xl ${svc.bg} shadow-lg`}>
                        <Icon className={`size-5 ${svc.color}`} />
                      </div>
                    </div>
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-lg">{t(navKey(svc.key))}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                        {t(svc.descKey)}
                      </CardDescription>
                    </CardContent>
                    <CardFooter className="pt-0">
                      <span className={`text-sm font-medium ${svc.color}`}>
                        {t("home.viewAll")} →
                      </span>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>
      )}

      {/* ============================================================ */}
      {/* INTEGRATED HEALING PROGRAM                                    */}
      {/* ============================================================ */}
      <section className="bg-muted/40 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="mb-12 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles className="size-6 text-teal-600" />
              <h2 className="text-3xl font-bold sm:text-4xl">{t("home.coachingProgramTitle")}</h2>
            </div>
            <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 mb-4" />
            <p className="text-muted-foreground max-w-2xl mx-auto text-base">
              {t("home.coachingProgramSubtitle")}
            </p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            variants={{
              visible: { transition: { staggerChildren: 0.07 } },
            }}
          >
            {[
              {
                icon: Mic,
                titleKey: "subscriptions.coachingMonthly",
                subtitle: "Grosra Du mois / Live coaching",
                gradient: "from-teal-400 to-emerald-500",
                bg: "bg-teal-50 dark:bg-teal-950/20",
                border: "border-teal-200 dark:border-teal-800",
              },
              {
                icon: Users,
                titleKey: "subscriptions.coachingWorkshop",
                subtitle: "Workshop",
                gradient: "from-emerald-400 to-green-500",
                bg: "bg-emerald-50 dark:bg-emerald-950/20",
                border: "border-emerald-200 dark:border-emerald-800",
              },
              {
                icon: Dumbbell,
                titleKey: "subscriptions.coachingExercise",
                subtitle: "Exercise",
                gradient: "from-cyan-400 to-sky-500",
                bg: "bg-cyan-50 dark:bg-cyan-950/20",
                border: "border-cyan-200 dark:border-cyan-800",
              },
              {
                icon: TreePine,
                titleKey: "subscriptions.coachingRetreat",
                subtitle: "Retraite",
                gradient: "from-green-400 to-emerald-500",
                bg: "bg-green-50 dark:bg-green-950/20",
                border: "border-green-200 dark:border-green-800",
              },
              {
                icon: MessageCircleQuestion,
                titleKey: "subscriptions.coachingQA",
                subtitle: "Q & A – Solutions, chapters",
                gradient: "from-amber-400 to-orange-500",
                bg: "bg-amber-50 dark:bg-amber-950/20",
                border: "border-amber-200 dark:border-amber-800",
              },
              {
                icon: Brain,
                titleKey: "subscriptions.coachingMeditation",
                subtitle: "Meditation",
                gradient: "from-violet-400 to-purple-500",
                bg: "bg-violet-50 dark:bg-violet-950/20",
                border: "border-violet-200 dark:border-violet-800",
              },
              {
                icon: Heart,
                titleKey: "subscriptions.coachingAffirmation",
                subtitle: "Affirmation",
                gradient: "from-rose-400 to-pink-500",
                bg: "bg-rose-50 dark:bg-rose-950/20",
                border: "border-rose-200 dark:border-rose-800",
              },
              {
                icon: Palette,
                titleKey: "subscriptions.coachingArtTherapy",
                subtitle: "Art thérapie / fun",
                gradient: "from-fuchsia-400 to-pink-500",
                bg: "bg-fuchsia-50 dark:bg-fuchsia-950/20",
                border: "border-fuchsia-200 dark:border-fuchsia-800",
              },
              {
                icon: Stethoscope,
                titleKey: "subscriptions.coachingMindDoctor",
                subtitle: "Attitude médecin",
                gradient: "from-blue-400 to-indigo-500",
                bg: "bg-blue-50 dark:bg-blue-950/20",
                border: "border-blue-200 dark:border-blue-800",
              },
              {
                icon: Leaf,
                titleKey: "subscriptions.coachingHolistic",
                subtitle: "Médecine holistique et Integrative",
                gradient: "from-lime-400 to-green-500",
                bg: "bg-lime-50 dark:bg-lime-950/20",
                border: "border-lime-200 dark:border-lime-800",
              },
              {
                icon: HandHeart,
                titleKey: "subscriptions.coachingBodyMemory",
                subtitle: "Memoir du corps",
                gradient: "from-orange-400 to-red-500",
                bg: "bg-orange-50 dark:bg-orange-950/20",
                border: "border-orange-200 dark:border-orange-800",
              },
              {
                icon: Activity,
                titleKey: "subscriptions.coachingMedicalHealing",
                subtitle: "Medical and Healing",
                gradient: "from-red-400 to-rose-500",
                bg: "bg-red-50 dark:bg-red-950/20",
                border: "border-red-200 dark:border-red-800",
              },
            ].map((item, i) => {
              const ItemIcon = item.icon;
              return (
                <motion.div key={item.titleKey} variants={fadeUp} custom={i}>
                  <Card
                    className={`group cursor-pointer border ${item.border} ${item.bg} transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden`}
                    onClick={() => navigate("subscriptions")}
                  >
                    <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <ItemIcon className="size-7 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base leading-tight mb-1">
                          {t(item.titleKey)}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.subtitle}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FEATURED COURSES                                              */}
      {/* ============================================================ */}
      {isSectionVisible("courses") && (
      <section className="bg-muted/40 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="mb-8 flex items-center justify-between"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div>
              <h2 className="mb-1 text-2xl font-bold sm:text-3xl">{t("home.featuredCourses")}</h2>
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              {canScrollLeft && (
                <Button size="icon" variant="outline" className="size-9 rounded-full" onClick={() => scrollCourses("left")}>
                  <ChevronRight className="size-4" />
                </Button>
              )}
              {canScrollRight && (
                <Button size="icon" variant="outline" className="size-9 rounded-full" onClick={() => scrollCourses("right")}>
                  <ChevronLeft className="size-4" />
                </Button>
              )}
              <Button variant="ghost" className="hidden gap-1 text-sm sm:flex" onClick={() => navigate("courses")}>
                {t("home.viewAll")}
                <ArrowLeft className="size-4" />
              </Button>
            </div>
          </motion.div>

          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-4 scrollbar-none sm:gap-6"
          >
            {displayFeaturedCourses.map((course, i) => (
              <motion.div
                key={course.id}
                className="w-72 flex-shrink-0 sm:w-80"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
              >
                <Card className="group cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={course.image}
                      alt={course.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <Badge className="absolute bottom-3 start-3 bg-teal-600 text-white">
                      {course.lessons} {t("courses.lessons")}
                    </Badge>
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-1 text-base">{course.title}</CardTitle>
                    <CardDescription className="line-clamp-1 text-sm">{course.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {course.duration}
                      </span>
                      {course.progress > 0 && (
                        <span>{course.progress}%</span>
                      )}
                    </div>
                    {course.progress > 0 && (
                      <Progress value={course.progress} className="h-1.5" />
                    )}
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button
                      size="sm"
                      variant={course.progress > 0 ? "outline" : "default"}
                      className="w-full rounded-full"
                      onClick={() => navigate("courses")}
                    >
                      {course.progress > 0 ? t("courses.continue") : t("courses.enroll")}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>

          <Button variant="ghost" className="mt-4 gap-1 text-sm sm:hidden" onClick={() => navigate("courses")}>
            {t("home.viewAll")}
            <ArrowLeft className="size-4" />
          </Button>
        </div>
      </section>
      )}

      {/* ============================================================ */}
      {/* LATEST ARTICLES                                               */}
      {/* ============================================================ */}
      {isSectionVisible("articles") && (
      <section className="bg-background px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="mb-10 flex items-center justify-between"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div>
              <h2 className="mb-1 text-2xl font-bold sm:text-3xl">{t("home.latestArticles")}</h2>
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" />
            </div>
            <Button variant="ghost" className="gap-1 text-sm" onClick={() => navigate("articles")}>
              {t("home.viewAll")}
              <ArrowLeft className="size-4" />
            </Button>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {displayArticles.map((article, i) => (
              <motion.div
                key={article.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Card
                  className="group cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  onClick={() => navigate("articles")}
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className="relative h-48 w-full overflow-hidden sm:h-auto sm:w-44">
                      <img
                        src={article.image}
                        alt={article.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                      <div>
                        <h3 className="mb-2 line-clamp-1 font-semibold">{article.title}</h3>
                        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{article.excerpt}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {article.readTime}
                        </span>
                        <span>{article.author}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ============================================================ */}
      {/* LATEST PODCASTS                                               */}
      {/* ============================================================ */}
      {isSectionVisible("podcasts") && (
      <section className="bg-muted/40 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="mb-10 flex items-center justify-between"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <div>
              <h2 className="mb-1 text-2xl font-bold sm:text-3xl">{t("home.latestPodcasts")}</h2>
              <div className="h-1 w-12 rounded-full bg-gradient-to-r from-violet-500 to-purple-400" />
            </div>
            <Button variant="ghost" className="gap-1 text-sm" onClick={() => navigate("podcasts")}>
              {t("home.viewAll")}
              <ArrowLeft className="size-4" />
            </Button>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            {displayPodcasts.map((ep, i) => (
              <motion.div
                key={ep.id}
                variants={fadeUp}
                custom={i}
              >
                <Card
                  className="group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  onClick={() => navigate("podcasts")}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <Button
                      size="icon"
                      className="flex size-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl"
                    >
                      <Play className="size-5 ms-0.5" />
                    </Button>
                    <div className="flex-1 overflow-hidden">
                      <div className="mb-0.5 text-xs font-medium text-violet-500">
                        {t("podcasts.episode")} {ep.episode}
                      </div>
                      <h4 className="line-clamp-1 font-medium">{ep.title}</h4>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {ep.duration}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      )}

      {/* ============================================================ */}
      {/* STATS                                                         */}
      {/* ============================================================ */}
      {isSectionVisible("stats") && (
      <section className="bg-gradient-to-br from-teal-600 to-emerald-600 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="grid grid-cols-2 gap-8 lg:grid-cols-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          >
            {stats.map((stat) => (
              <StatCard key={stat.labelKey} stat={stat} label={t(stat.labelKey)} />
            ))}
          </motion.div>
        </div>
      </section>
      )}

      {/* ============================================================ */}
      {/* TESTIMONIALS                                                  */}
      {/* ============================================================ */}
      {isSectionVisible("testimonials") && (
      <section className="bg-background px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <motion.div
            className="mb-12 text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">{t("reviews.title")}</h2>
            <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" />
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {mockTestimonials.map((testimonial, i) => (
              <motion.div
                key={testimonial.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="h-full border-muted transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <CardContent className="relative p-6">
                    <Quote className="absolute top-4 end-4 size-8 text-teal-100 dark:text-teal-900" />
                    <div className="mb-4 flex items-center gap-3">
                      <Avatar className="size-12 border-2 border-teal-200">
                        <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-400 text-sm font-bold text-white">
                          {testimonial.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold">{testimonial.name}</div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star
                              key={s}
                              className={`size-3.5 ${
                                s < testimonial.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      &ldquo;{testimonial.text}&rdquo;
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}
      {/* ============================================================ */}
      {/* ADMIN FLOATING CUSTOMIZE BUTTON                               */}
      {/* ============================================================ */}
      {isAdmin && user && (
        <motion.div
          className="fixed bottom-6 start-6 z-50 flex flex-col gap-2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.3 }}
        >
          {/* Main Customize Button */}
          <button
            onClick={() => navigate("homepageCustomizer")}
            className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-white font-semibold shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all hover:scale-105"
          >
            <Pencil className="size-5 group-hover:rotate-12 transition-transform" />
            <span>{locale === "ar" ? "تخصيص الصفحة" : locale === "fr" ? "Personnaliser" : "Customize"}</span>
            <Settings className="size-4 opacity-60" />
          </button>
          {/* Quick Video Button */}
          <button
            onClick={() => navigate("homepageCustomizer", { tab: "video" })}
            className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-2.5 text-white font-medium shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/35 transition-all hover:scale-105 text-sm"
          >
            <Video className="size-4 group-hover:scale-110 transition-transform" />
            <span>{locale === "ar" ? "إضافة فيديو" : locale === "fr" ? "Ajouter vidéo" : "Add Video"}</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
