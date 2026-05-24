"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore, type PageName } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import {
  Crown,
  BookOpen,
  FileText,
  Headphones,
  Video,
  FileDown,
  Radio,
  Sparkles,
} from "lucide-react";
import { ALL_CONTENT_TYPES, type ContentType } from "@/lib/content-access";

interface PlanFeature {
  ar: string;
  en: string;
  fr: string;
}

interface Plan {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  nameKey: string;
  price: number;
  gradient: string;
  features: PlanFeature[];
  recommended?: boolean;
}

const localizedText = (obj: { ar: string; en: string; fr: string }, locale: string) =>
  obj[locale as keyof typeof obj] || obj.ar;

const DEFAULT_PLAN_PRICES: Record<string, number> = {
  full: 2000,
  courses: 500,
  articles: 500,
  podcasts: 500,
  videos: 500,
  pdfs: 500,
  live: 500,
};

export default function SubscriptionsPage() {
  const { t, locale } = useTranslation();
  const { navigate, pageParams, user } = useAppStore();

  // ── Fetch subscription prices + fullPlanIncludes from API ──
  const [apiPrices, setApiPrices] = useState<Record<string, number> | null>(() => {
    // Initialize from localStorage cache to prevent flash of default prices
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('hs_subPrices');
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
    return null;
  });
  const [fullPlanIncludes, setFullPlanIncludes] = useState<ContentType[]>(ALL_CONTENT_TYPES);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/subscription-prices?_t=" + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data.prices) {
            setApiPrices(data.prices);
            // Cache for instant load on refresh
            localStorage.setItem('hs_subPrices', JSON.stringify(data.prices));
          }
          if (data.fullPlanIncludes) {
            setFullPlanIncludes(data.fullPlanIncludes);
          }
        }
      } catch { /* ignore — use defaults */ }
    })();
  }, []);
  const planPrice = (planId: string) => (apiPrices?.[planId] ?? DEFAULT_PLAN_PRICES[planId] ?? 0);

  // Build dynamic features for the "full" plan based on fullPlanIncludes
  const fullPlanDynamicFeatures: PlanFeature[] = (fullPlanIncludes.length > 0 ? fullPlanIncludes : ALL_CONTENT_TYPES).map(type => {
    const labels: Record<string, { ar: string; en: string; fr: string }> = {
      courses: { ar: "الوصول الكامل لجميع الدورات", en: "Full access to all courses", fr: "Accès complet à tous les cours" },
      articles: { ar: "جميع المقالات المتخصصة", en: "All specialized articles", fr: "Tous les articles spécialisés" },
      podcasts: { ar: "جميع حلقات البودكاست", en: "All podcast episodes", fr: "Tous les épisodes de podcast" },
      videos: { ar: "جميع الفيديوهات التعليمية", en: "All educational videos", fr: "Toutes les vidéos éducatives" },
      pdfs: { ar: "جميع الكتب الإلكترونية PDF", en: "All e-books in PDF", fr: "Tous les e-books en PDF" },
      live: { ar: "جميع جلسات البث المباشر", en: "All live sessions", fr: "Toutes les sessions en direct" },
    };
    return labels[type] || { ar: type, en: type, fr: type };
  });

  // Fetch fresh subscription from API on mount and when user changes
  // Using {uid, plan} pattern so currentPlanId auto-resets when userId changes
  const userId = user?.id;
  const [fetchedPlan, setFetchedPlan] = useState<{ uid: string; plan: string } | null>(null);
  // Automatically undefined when user changes (fetchedPlan.uid !== userId)
  const currentPlanId = (fetchedPlan !== null && fetchedPlan.uid === userId && userId !== "admin-1")
    ? (fetchedPlan.plan || undefined)
    : undefined;

  useEffect(() => {
    if (!userId || userId === "admin-1") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/subscriptions?_t=${Date.now()}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        // SAFETY: Filter by userId to prevent cross-user data leakage
        const activeSubs = (data.subscriptions || [])
          .filter((s: { userId?: string; status: string; endDate: string }) =>
            (!s.userId || s.userId === userId) &&
            s.status === "active" && new Date(s.endDate) > new Date()
          );
        if (!cancelled) {
          if (activeSubs.length > 0) {
            setFetchedPlan({ uid: userId, plan: activeSubs[0].type });
          } else {
            setFetchedPlan({ uid: userId, plan: "" });
          }
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const plans: Plan[] = [
    {
      id: "full",
      icon: Crown,
      nameKey: "subscriptions.fullAccess",
      price: planPrice("full"),
      gradient: "from-amber-400 via-orange-500 to-rose-500",
      recommended: true,
      features: [
        ...fullPlanDynamicFeatures,
        // Coaching program features
        { ar: "جلسة شهرية مع مدربة", en: "Monthly coaching session", fr: "Séance mensuelle avec coach" },
        { ar: "ورشة عمل", en: "Workshop", fr: "Atelier" },
        { ar: "تمارين", en: "Exercises", fr: "Exercices" },
        { ar: "رحلة إعادة توازن", en: "Rebalancing retreat", fr: "Retraite de rééquilibrage" },
        { ar: "حلول وفصول", en: "Solutions & chapters", fr: "Solutions et chapitres" },
        { ar: "تأمل", en: "Meditation", fr: "Méditation" },
        { ar: "تأكيدات إيجابية", en: "Positive affirmations", fr: "Affirmations positives" },
        { ar: "علاج فني وترفيه", en: "Art therapy & fun", fr: "Art-thérapie et fun" },
        { ar: "طبيب العقل", en: "Mind doctor", fr: "Médecin de l'esprit" },
        { ar: "الطب الشمولي والتكاملي", en: "Holistic & integrative medicine", fr: "Médecine holistique et intégrative" },
        { ar: "ذاكرة الجسد", en: "Body memory", fr: "Mémoire du corps" },
        { ar: "شفاء وعلاج طبي", en: "Medical healing", fr: "Guérison et traitement médical" },
        // Other benefits
        { ar: "شهادات إتمام الدورات", en: "Course completion certificates", fr: "Certificats de complétion" },
        { ar: "دعم فني مخصص", en: "Dedicated support", fr: "Support dédié" },
      ],
    },
    {
      id: "courses",
      icon: BookOpen,
      nameKey: "subscriptions.coursesOnly",
      price: planPrice("courses"),
      gradient: "from-emerald-400 to-teal-600",
      features: [
        { ar: "الوصول لجميع الدورات", en: "Access to all courses", fr: "Accès à tous les cours" },
        { ar: "شهادات إتمام الدورات", en: "Course completion certificates", fr: "Certificats de complétion" },
        { ar: "تتبع التقدم في التعلم", en: "Learning progress tracking", fr: "Suivi de la progression" },
      ],
    },
    {
      id: "articles",
      icon: FileText,
      nameKey: "subscriptions.articlesOnly",
      price: planPrice("articles"),
      gradient: "from-cyan-400 to-sky-600",
      features: [
        { ar: "الوصول لجميع المقالات", en: "Access to all articles", fr: "Accès à tous les articles" },
        { ar: "مقالات حصرية متخصصة", en: "Exclusive specialized articles", fr: "Articles spécialisés exclusifs" },
        { ar: "تحميل المقالات بصيغة PDF", en: "Download articles in PDF", fr: "Télécharger les articles en PDF" },
      ],
    },
    {
      id: "podcasts",
      icon: Headphones,
      nameKey: "subscriptions.podcastsOnly",
      price: planPrice("podcasts"),
      gradient: "from-violet-400 to-purple-600",
      features: [
        { ar: "الوصول لجميع حلقات البودكاست", en: "Access to all podcast episodes", fr: "Accès à tous les épisodes" },
        { ar: "حلقات حصرية مع ضيوف مميزين", en: "Exclusive episodes with special guests", fr: "Épisodes exclusifs avec invités spéciaux" },
        { ar: "تحميل الحلقات للاستماع بدون إنترنت", en: "Download episodes for offline listening", fr: "Télécharger pour écoute hors ligne" },
      ],
    },
    {
      id: "videos",
      icon: Video,
      nameKey: "subscriptions.videosOnly",
      price: planPrice("videos"),
      gradient: "from-rose-400 to-pink-600",
      features: [
        { ar: "الوصول لجميع الفيديوهات", en: "Access to all videos", fr: "Accès à toutes les vidéos" },
        { ar: "محتوى حصري بالفيديو", en: "Exclusive video content", fr: "Contenu vidéo exclusif" },
        { ar: "جودة عالية في البث", en: "High quality streaming", fr: "Streaming haute qualité" },
      ],
    },
    {
      id: "pdfs",
      icon: FileDown,
      nameKey: "subscriptions.pdfsOnly",
      price: planPrice("pdfs"),
      gradient: "from-amber-400 to-yellow-600",
      features: [
        { ar: "الوصول لجميع الكتب الإلكترونية", en: "Access to all e-books", fr: "Accès à tous les e-books" },
        { ar: "تحميل بلا حدود", en: "Unlimited downloads", fr: "Téléchargements illimités" },
        { ar: "إصدارات جديدة أولاً بأول", en: "New releases as they come", fr: "Nouvelles parutions en continu" },
      ],
    },
    {
      id: "live",
      icon: Radio,
      nameKey: "subscriptions.liveOnly",
      price: planPrice("live"),
      gradient: "from-teal-400 to-emerald-600",
      features: [
        { ar: "الوصول لجميع البث المباشر", en: "Access to all live streams", fr: "Accès à tous les directs" },
        { ar: "تسجيلات البث السابق", en: "Past stream recordings", fr: "Enregistrements des directs précédents" },
        { ar: "جلسات تفاعلية حية", en: "Interactive live sessions", fr: "Sessions interactives en direct" },
      ],
    },
  ];

  const handleSubscribe = (planId: string) => {
    navigate("payment", { plan: planId });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium"
        >
          <Sparkles className="h-4 w-4" />
          {t("subscriptions.choosePlan")}
        </motion.div>
        <h1 className="text-3xl md:text-4xl font-bold">{t("subscriptions.title")}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-base">
          {t("subscriptions.description")}
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {plans.map((plan, index) => {
          const isCurrentPlan = currentPlanId === plan.id;
          const PlanIcon = plan.icon;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <Card
                className={`relative overflow-hidden h-full flex flex-col transition-all duration-300 hover:shadow-xl ${
                  plan.recommended
                    ? "border-2 border-amber-400 shadow-lg shadow-amber-500/10"
                    : "border hover:border-primary/30"
                } ${isCurrentPlan ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                {/* Recommended Badge */}
                {plan.recommended && (
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
                )}

                <CardHeader className="relative pb-2">
                  {/* Top accent bar */}
                  <div className={`h-2 rounded-full bg-gradient-to-r ${plan.gradient} mb-2 opacity-60`} />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-12 w-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-lg`}
                      >
                        <PlanIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{t(plan.nameKey)}</h3>
                        {plan.recommended && (
                          <Badge className="bg-amber-500 text-white border-0 mt-1 text-[10px]">
                            ⭐ {locale === "ar" ? "الأكثر شعبية" : locale === "fr" ? "Le plus populaire" : "Most Popular"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-0">
                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{plan.price.toLocaleString()}</span>
                      <span className="text-muted-foreground text-sm">DA</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("subscriptions.perMonth")}</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 flex-1 mb-6">
                    {plan.features.map((feature, fIdx) => (
                      <motion.li
                        key={fIdx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.08 + fIdx * 0.04 }}
                        className="flex items-start gap-2.5"
                      >
                        <div className={`h-5 w-5 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm text-muted-foreground leading-relaxed">
                          {localizedText(feature, locale)}
                        </span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* Subscribe Button */}
                  {isCurrentPlan ? (
                    <div className="w-full">
                      <Button
                        className="w-full"
                        variant="outline"
                        disabled
                      >
                        {t("subscriptions.currentPlan")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className={`w-full ${
                        plan.recommended
                          ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25"
                          : ""
                      }`}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      <Crown className={`h-4 w-4 ${locale === "ar" ? "me-2" : "ms-2"}`} />
                      {t("subscriptions.subscribe")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
