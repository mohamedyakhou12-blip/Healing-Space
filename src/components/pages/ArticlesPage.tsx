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
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Newspaper,
  Clock,
  User,
  Search,
  ArrowRight,
  ArrowLeft,
  Lock,
  Star,
  BookOpen,
  Calendar,
  ShoppingBag,
  Crown,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";

interface Article {
  id: string;
  title: { ar: string; en: string; fr: string };
  excerpt: { ar: string; en: string; fr: string };
  content: { ar: string; en: string; fr: string };
  author: { name: { ar: string; en: string; fr: string }; bio: { ar: string; en: string; fr: string } };
  category: { ar: string; en: string; fr: string };
  gradient: string;
  readTime: number;
  publishedDate: string;
  rating: number;
  isFree: boolean;
  price: number;
}

const GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-cyan-600",
];

const mockArticles: Article[] = [
  {
    id: "art-1",
    title: {
      ar: "10 تقنيات فعالة للتعامل مع التوتر اليومي",
      en: "10 Effective Techniques for Dealing with Daily Stress",
      fr: "10 Techniques Efficaces pour Gérer le Stress Quotidien",
    },
    excerpt: {
      ar: "اكتشف مجموعة من التقنيات المثبتة علمياً التي تساعدك على التعامل مع ضغوطات الحياة اليومية بطريقة صحية.",
      en: "Discover a set of scientifically proven techniques to help you deal with daily life pressures in a healthy way.",
      fr: "Découvrez un ensemble de techniques scientifiquement prouvées pour gérer les pressions de la vie quotidienne.",
    },
    content: {
      ar: `التوتر جزء طبيعي من الحياة، لكن التعامل المفرط معه يمكن أن يؤثر سلباً على صحتك النفسية والجسدية. إليك 10 تقنيات فعالة:\n\n**1. التنفس العميق**\nخذ نفساً عميقاً عبر الأنف لمدة 4 ثوانٍ، احبسه لمدة 7 ثوانٍ، ثم أخرجه عبر الفم لمدة 8 ثوانٍ.\n\n**2. التمارين الرياضية**\nالنشاط البدني المنتظم يقلل من مستويات الكورتيزول ويعزز إفراز الإندورفين.\n\n**3. الكتابة التعبيرية**\nخصص 15 دقيقة يومياً لكتابة مشاعرك وأفكارك.\n\n**4. التأمل الواعي**\nخصص 10 دقائق يومياً للتأمل والتركيز على اللحظة الحالية.\n\n**5. إدارة الوقت**\nنظم أولوياتك واستخدم تقنية بومودورو لتحسين الإنتاجية.\n\n**6. التواصل الاجتماعي**\nحافظ على علاقات اجتماعية صحية وداعمة.\n\n**7. النوم الكافي**\nحاول النوم 7-8 ساعات يومياً في بيئة مريحة.\n\n**8. التغذية المتوازنة**\nاهتم بوجباتك الغذائية وتجنب الأطعمة المصنعة.\n\n**9. الضحك والعفوية**\nخصص وقتاً للأنشطة الممتعة والضحك.\n\n**10. المساعدة المهنية**\nلا تتردد في استشارة أخصائي نفسي عند الحاجة.`,
      en: `Stress is a natural part of life, but excessive handling can negatively affect your mental and physical health. Here are 10 effective techniques:\n\n**1. Deep Breathing**\nTake a deep breath through your nose for 4 seconds, hold for 7 seconds, then exhale through your mouth for 8 seconds.\n\n**2. Physical Exercise**\nRegular physical activity reduces cortisol levels and boosts endorphin release.\n\n**3. Expressive Writing**\nDedicate 15 minutes daily to writing your feelings and thoughts.\n\n**4. Mindful Meditation**\nDedicate 10 minutes daily to meditation and focusing on the present moment.\n\n**5. Time Management**\nOrganize your priorities and use the Pomodoro technique to improve productivity.\n\n**6. Social Connection**\nMaintain healthy and supportive social relationships.\n\n**7. Adequate Sleep**\nTry to sleep 7-8 hours daily in a comfortable environment.\n\n**8. Balanced Nutrition**\nPay attention to your meals and avoid processed foods.\n\n**9. Laughter and Spontaneity**\nDedicate time to enjoyable activities and laughter.\n\n**10. Professional Help**\nDon't hesitate to consult a mental health professional when needed.`,
      fr: `Le stress est une partie naturelle de la vie, mais une gestion excessive peut affecter négativement votre santé mentale et physique. Voici 10 techniques efficaces:\n\n**1. Respiration profonde**\nPrenez une respiration profonde par le nez pendant 4 secondes, retenez pendant 7 secondes, puis expirez par la bouche pendant 8 secondes.\n\n**2. Exercice physique**\nL'activité physique régulière réduit les niveaux de cortisol et stimule la libération d'endorphines.\n\n**3. Écriture expressive**\nConsacrez 15 minutes par jour à l'écriture de vos sentiments et pensées.\n\n**4. Méditation pleine conscience**\nConsacrez 10 minutes par jour à la méditation.\n\n**5. Gestion du temps**\nOrganisez vos priorités et utilisez la technique Pomodoro.\n\n**6. Connexion sociale**\nMaintenez des relations sociales saines et soutenantes.\n\n**7. Sommeil adéquat**\nEssayez de dormir 7-8 heures par jour.\n\n**8. Nutrition équilibrée**\nFaites attention à vos repas et évitez les aliments transformés.\n\n**9. Rire et spontanéité**\nConsacrez du temps aux activités agréables et au rire.\n\n**10. Aide professionnelle**\nN'hésitez pas à consulter un professionnel de la santé mentale.`,
    },
    author: {
      name: { ar: "د. ليلى مراد", en: "Dr. Laila Mourad", fr: "Dr. Laila Mourad" },
      bio: { ar: "طبيبة نفسية متخصصة في العلاج المعرفي السلوكي مع 12 سنة خبرة", en: "Psychiatrist specializing in CBT with 12 years of experience", fr: "Psychiatre spécialisée en TCC avec 12 ans d'expérience" },
    },
    category: { ar: "الصحة النفسية", en: "Mental Health", fr: "Santé Mentale" },
    gradient: "from-emerald-400 to-teal-600",
    readTime: 8,
    publishedDate: "2025-01-15",
    rating: 4.8,
    isFree: true,
    price: 0,
  },
  {
    id: "art-2",
    title: {
      ar: "فهم اضطراب القلق العام: الأعراض والعلاج",
      en: "Understanding Generalized Anxiety Disorder: Symptoms & Treatment",
      fr: "Comprendre le Trouble Anxiété Généralisée: Symptômes et Traitement",
    },
    excerpt: {
      ar: "دليل شامل لفهم اضطراب القلق العام وأعراضه وأحدث طرق العلاج المتاحة.",
      en: "A comprehensive guide to understanding GAD, its symptoms, and the latest available treatments.",
      fr: "Un guide complet pour comprendre le TAG, ses symptômes et les derniers traitements disponibles.",
    },
    content: {
      ar: `اضطراب القلق العام هو حالة نفسية يتميز بالقلق المفرط والمستمر بشأن أحداث الحياة اليومية. يصيب حوالي 3-5% من السكان.\n\n**الأعراض الرئيسية:**\n- قلق مستمر ومفرط\n- صعوبة في التركيز\n- اضطرابات النوم\n- توتر عضلي\n- سرعة الغضب\n\n**طرق العلاج:**\n1. العلاج النفسي (CBT)\n2. الأدوية المضادة للقلق\n3. تقنيات الاسترخاء\n4. تغيير نمط الحياة`,
      en: `GAD is a mental health condition characterized by excessive and persistent worry about everyday life events. It affects about 3-5% of the population.\n\n**Main Symptoms:**\n- Constant and excessive worry\n- Difficulty concentrating\n- Sleep disturbances\n- Muscle tension\n- Irritability\n\n**Treatment Methods:**\n1. Psychotherapy (CBT)\n2. Anti-anxiety medications\n3. Relaxation techniques\n4. Lifestyle changes`,
      fr: `Le TAG est un trouble de santé mentale caractérisé par une inquiétude excessive et persistante concernant les événements quotidiens. Il touche environ 3-5% de la population.\n\n**Principaux symptômes:**\n- Inquiétude constante et excessive\n- Difficulté de concentration\n- Troubles du sommeil\n- Tension musculaire\n- Irritabilité\n\n**Méthodes de traitement:**\n1. Psychothérapie (TCC)\n2. Médicaments anti-anxiété\n3. Techniques de relaxation\n4. Changements de mode de vie`,
    },
    author: {
      name: { ar: "د. خالد مراد", en: "Dr. Khaled Mourad", fr: "Dr. Khaled Mourad" },
      bio: { ar: "أخصائي في اضطرابات القلق والوسواس القهري", en: "Specialist in anxiety and OCD disorders", fr: "Spécialiste des troubles anxieux et du TOC" },
    },
    category: { ar: "اضطرابات القلق", en: "Anxiety Disorders", fr: "Troubles Anxieux" },
    gradient: "from-amber-400 to-orange-600",
    readTime: 12,
    publishedDate: "2025-02-10",
    rating: 4.7,
    isFree: false,
    price: 1500,
  },
  {
    id: "art-3",
    title: {
      ar: "أهمية النوم لصحتنا النفسية",
      en: "The Importance of Sleep for Our Mental Health",
      fr: "L'Importance du Sommeil pour Notre Santé Mentale",
    },
    excerpt: {
      ar: "كيف يؤثر النوم على صحتنا النفسية وما هي العادات التي يمكن أن تساعدنا على نوم أفضل.",
      en: "How sleep affects our mental health and what habits can help us sleep better.",
      fr: "Comment le sommeil affecte notre santé mentale et quelles habitudes peuvent nous aider à mieux dormir.",
    },
    content: {
      ar: `النوم الجيد هو حجر الأساس للصحة النفسية. الأبحاث تثبت أن نقص النوم يرتبط بزيادة مخاطر الاكتئاب والقلق.\n\n**نصائح لنوم أفضل:**\n1. التزم بجدول نوم منتظم\n2. تجنب الشاشات قبل النوم\n3. اجعل غرفتك مظلمة وهادئة\n4. تجنب الكافيين بعد الظهر\n5. مارس الرياضة بانتظام`,
      en: `Good sleep is the foundation of mental health. Research proves that sleep deprivation is linked to increased risks of depression and anxiety.\n\n**Tips for Better Sleep:**\n1. Maintain a regular sleep schedule\n2. Avoid screens before bed\n3. Keep your room dark and quiet\n4. Avoid caffeine after noon\n5. Exercise regularly`,
      fr: `Un bon sommeil est le fondement de la santé mentale. La recherche prouve que le manque de sommeil est lié à un risque accru de dépression et d'anxiété.\n\n**Conseils pour un meilleur sommeil:**\n1. Maintenez un horaire de sommeil régulier\n2. Évitez les écrans avant le coucher\n3. Gardez votre chambre sombre et calme\n4. Évitez la caféine après midi\n5. Faites de l'exercice régulièrement`,
    },
    author: {
      name: { ar: "أ. فاطمة الزهراء", en: "Ms. Fatima El Zahra", fr: "Mme Fatima El Zahra" },
      bio: { ar: "مستشارة نفسية متخصصة في اضطرابات النوم", en: "Mental health counselor specializing in sleep disorders", fr: "Conseillère en santé mentale spécialisée dans les troubles du sommeil" },
    },
    category: { ar: "نمط الحياة", en: "Lifestyle", fr: "Mode de Vie" },
    gradient: "from-violet-400 to-purple-600",
    readTime: 6,
    publishedDate: "2025-03-05",
    rating: 4.5,
    isFree: true,
    price: 0,
  },
  {
    id: "art-4",
    title: {
      ar: "الذكاء العاطفي: كيف تطور مهاراتك العاطفية؟",
      en: "Emotional Intelligence: How to Develop Your Emotional Skills?",
      fr: "Intelligence Émotionnelle: Comment Développer Vos Compétences Émotionnelles?",
    },
    excerpt: {
      ar: "دليل عملي لفهم الذكاء العاطفي وتطوير مهاراتك في إدارة المشاعر وبناء علاقات أفضل.",
      en: "A practical guide to understanding emotional intelligence and developing your emotion management skills.",
      fr: "Un guide pratique pour comprendre l'intelligence émotionnelle et développer vos compétences.",
    },
    content: {
      ar: `الذكاء العاطفي هو القدرة على التعرف على مشاعرك ومشاعر الآخرين وإدارتها بفعالية.\n\n**المكونات الخمسة:**\n1. الوعي الذاتي\n2. التنظيم الذاتي\n3. التحفيز الذاتي\n4. التعاطف\n5. المهارات الاجتماعية`,
      en: `Emotional intelligence is the ability to recognize and manage your own and others' emotions effectively.\n\n**The Five Components:**\n1. Self-awareness\n2. Self-regulation\n3. Self-motivation\n4. Empathy\n5. Social skills`,
      fr: `L'intelligence émotionnelle est la capacité à reconnaître et gérer efficacement vos émotions et celles des autres.\n\n**Les Cinq Composantes:**\n1. Conscience de soi\n2. Autorégulation\n3. Automotivation\n4. Empathie\n5. Compétences sociales`,
    },
    author: {
      name: { ar: "د. محمد أمين", en: "Dr. Mohamed Amine", fr: "Dr. Mohamed Amine" },
      bio: { ar: "خبير في الذكاء العاطفي والتطوير الشخصي", en: "Expert in emotional intelligence and personal development", fr: "Expert en intelligence émotionnelle et développement personnel" },
    },
    category: { ar: "التطوير الشخصي", en: "Personal Development", fr: "Développement Personnel" },
    gradient: "from-rose-400 to-pink-600",
    readTime: 10,
    publishedDate: "2025-03-20",
    rating: 4.9,
    isFree: false,
    price: 2000,
  },
  {
    id: "art-5",
    title: {
      ar: "الاحتراق الوظيفي: علاماته وطرق التعافي منه",
      en: "Burnout: Signs and Recovery Methods",
      fr: "L'Épuisement Professionnel: Signes et Méthodes de Récupération",
    },
    excerpt: {
      ar: "تعرف على علامات الاحتراق الوظيفي واستراتيجيات فعالة للتعافي والوقاية منه.",
      en: "Learn about burnout signs and effective strategies for recovery and prevention.",
      fr: "Découvrez les signes de l'épuisement professionnel et les stratégies de récupération.",
    },
    content: {
      ar: `الاحتراق الوظيفي هو حالة من الإرهاق العاطفي والذهني الناتج عن ضغوط العمل المزمنة.\n\n**العلامات التحذيرية:**\n- الإرهاق المزمن\n- السخرية من العمل\n- انخفاض الإنجاز\n\n**طرق التعافي:**\n1. تحديد الحدود\n2. طلب المساعدة\n3. الأنشطة الترفيهية\n4. إعادة تقييم الأولويات`,
      en: `Burnout is a state of emotional and mental exhaustion caused by chronic work stress.\n\n**Warning Signs:**\n- Chronic exhaustion\n- Cynicism about work\n- Reduced accomplishment\n\n**Recovery Methods:**\n1. Set boundaries\n2. Seek help\n3. Recreational activities\n4. Reevaluate priorities`,
      fr: `L'épuisement professionnel est un état d'épuisement émotionnel et mental causé par le stress chronique au travail.\n\n**Signes d'avertissement:**\n- Épuisement chronique\n- Cynisme au travail\n- Accomplissement réduit\n\n**Méthodes de récupération:**\n1. Fixer des limites\n2. Demander de l'aide\n3. Activités récréatives\n4. Réévaluer les priorités`,
    },
    author: {
      name: { ar: "د. ليلى مراد", en: "Dr. Laila Mourad", fr: "Dr. Laila Mourad" },
      bio: { ar: "طبيبة نفسية متخصصة في العلاج المعرفي السلوكي", en: "Psychiatrist specializing in CBT", fr: "Psychiatre spécialisée en TCC" },
    },
    category: { ar: "الصحة المهنية", en: "Occupational Health", fr: "Santé Professionnelle" },
    gradient: "from-sky-400 to-cyan-600",
    readTime: 7,
    publishedDate: "2025-04-01",
    rating: 4.6,
    isFree: true,
    price: 0,
  },
];

export default function ArticlesPage() {
  const { t, locale } = useTranslation();
  const { pageParams, navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "paid">("all");
  const [apiArticles, setApiArticles] = useState<Article[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasedContentIds, setPurchasedContentIds] = useState<string[]>([]);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedLockedItem, setSelectedLockedItem] = useState<{
    id: string;
    title: string;
    titleAr: string;
    price: number;
    contentType: string;
  } | null>(null);

  // Fetch user purchases
  useEffect(() => {
    if (!userWithSub) return;
    fetch('/api/user-access')
      .then(res => res.json())
      .then(data => {
        if (data.purchasedContentIds) {
          setPurchasedContentIds(data.purchasedContentIds);
        }
      })
      .catch(() => {});
  }, [userWithSub]);

  useEffect(() => {
    cachedFetch<any>('/api/articles', 60_000)
      .then(data => {
        const articles = (data.articles || [])
          .filter((a: any) => a.status === 'published')
          .map((a: any, i: number) => ({
            id: a.id,
            title: { ar: a.titleAr || a.title, en: a.titleEn || a.title, fr: a.titleFr || a.title },
            excerpt: { ar: a.descriptionAr || a.description, en: a.descriptionEn || a.description, fr: a.descriptionFr || a.description },
            content: { ar: a.contentAr || a.content || a.descriptionAr || a.description, en: a.contentEn || a.content || a.descriptionEn || a.description, fr: a.contentFr || a.content || a.descriptionFr || a.description },
            author: {
              name: { ar: a.author || "", en: a.author || "", fr: a.author || "" },
              bio: { ar: a.author || "", en: a.author || "", fr: a.author || "" },
            },
            category: { ar: a.category || "", en: a.category || "", fr: a.category || "" },
            gradient: GRADIENTS[i % GRADIENTS.length],
            readTime: a.readTime || 5,
            publishedDate: a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : "",
            rating: a.avgRating || 0,
            isFree: a.isFree || false,
            price: a.price || 0,
          }));
        if (articles.length > 0) setApiArticles(articles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayArticles = apiArticles || mockArticles;

  const articleId = pageParams?.articleId as string | undefined;
  const selectedArticle = articleId
    ? displayArticles.find((a) => a.id === articleId)
    : null;

  const filteredArticles = useMemo(() => {
    return displayArticles.filter((article) => {
      const title = article.title[locale] || article.title.ar;
      const matchesSearch = !searchQuery || title.includes(searchQuery);
      const matchesFilter =
        filterType === "all" ||
        (filterType === "free" && article.isFree) ||
        (filterType === "paid" && !article.isFree);
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filterType, locale, displayArticles]);

  const localizedText = (obj: { ar: string; en: string; fr: string }) =>
    obj[locale] || obj.ar;

  const ArrowIcon = locale === "ar" ? ArrowLeft : ArrowRight;

  const openPurchaseDialog = (article: Article) => {
    setSelectedLockedItem({
      id: article.id,
      title: localizedText(article.title),
      titleAr: article.title.ar,
      price: article.price,
      contentType: "articles",
    });
    setPurchaseDialogOpen(true);
  };

  const handleArticleClick = (article: Article) => {
    if (!canAccessContentById(userWithSub, 'articles', article.id, article.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems)) {
      if (individualPurchasesEnabled) {
        openPurchaseDialog(article);
      }
      return;
    }
    navigate("articles", { articleId: article.id });
  };

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
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
  if (selectedArticle) {
    const article = selectedArticle;
    const relatedArticles = displayArticles.filter(
      (a) => a.id !== article.id && a.category[locale] === article.category[locale]
    ).slice(0, 3);
    const fallbackRelated = relatedArticles.length < 2
      ? displayArticles.filter((a) => a.id !== article.id).slice(0, 3)
      : relatedArticles;

    return (
      <>
      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        itemTitle={selectedLockedItem?.title || ""}
        itemPrice={selectedLockedItem?.price || 0}
        contentId={selectedLockedItem?.id || ""}
        contentType={selectedLockedItem?.contentType || "articles"}
        contentTitleAr={selectedLockedItem?.titleAr || ""}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
      >
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate("articles")} className="gap-2">
          <ArrowIcon className="h-4 w-4" />
          {t("articles.backToArticles")}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Article Header */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{localizedText(article.category)}</Badge>
                {article.isFree ? (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">
                    {t("common.free")}
                  </Badge>
                ) : article.price > 0 ? (
                  <Badge variant="outline" className="text-teal-600 border-teal-300 bg-teal-50">
                    {article.price.toLocaleString()} {t("common.currency")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                    {t("common.paid")}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold leading-snug">
                {localizedText(article.title)}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-semibold text-xs">
                      {localizedText(article.author.name).charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{localizedText(article.author.name)}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {article.publishedDate}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{article.readTime} {t("articles.minute")}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>{article.rating}</span>
                </div>
              </div>
            </div>

            {/* Article Content */}
            <div className="relative">
              {!canAccessContentById(userWithSub, 'articles', article.id, article.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) ? (
                /* Locked: show placeholder + purchase prompt instead of actual content */
                <div className="flex flex-col items-center justify-center gap-4 py-12 rounded-2xl bg-muted/30 border border-border/50">
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    {t("common.subscribeToAccess")}
                  </p>
                  {individualPurchasesEnabled && article.price > 0 && (
                    <Button size="sm" onClick={() => openPurchaseDialog(article)}>
                      <ShoppingBag className="h-4 w-4 me-2" />
                      {t("common.buyNow")} - {article.price.toLocaleString()} {t("common.currency")}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate("subscriptions")}>
                    <Crown className="h-4 w-4 me-2" />
                    {t("common.subscribeForFull")}
                  </Button>
                </div>
              ) : (
                /* Unlocked: show full article content */
                <>
                  <div
                    className={`relative h-48 sm:h-64 rounded-2xl bg-gradient-to-br ${article.gradient} mb-6 overflow-hidden`}
                  >
                    <Newspaper className="absolute bottom-4 start-4 h-12 w-12 text-white/20" />
                  </div>
                  <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-line text-base leading-relaxed">
                    {localizedText(article.content)}
                  </div>
                </>
              )}
            </div>

            {/* Rating Section */}
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <h3 className="font-semibold">{t("reviews.writeReview")}</h3>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={`h-7 w-7 cursor-pointer hover:scale-110 transition-transform ${star <= Math.round(article.rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4">
              {/* Author Info */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold">{t("articles.writtenBy")}</h3>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold">
                        {localizedText(article.author.name).charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{localizedText(article.author.name)}</p>
                      <p className="text-sm text-muted-foreground">{localizedText(article.author.bio)}</p>
                    </div>
                  </div>
                  {!article.isFree && article.price > 0 && individualPurchasesEnabled && (
                    <div className="text-center py-3">
                      <p className="text-sm text-muted-foreground">{t("common.priceLabel")}</p>
                      <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">{article.price.toLocaleString()} <span className="text-base font-normal">{t("common.currency")}</span></p>
                      <Button className="w-full mt-3" size="sm" onClick={() => openPurchaseDialog(article)}>
                        {t("common.buyNow")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Related Articles */}
              <Card>
                <CardHeader className="pb-2">
                  <h3 className="font-semibold">{t("articles.relatedArticles")}</h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fallbackRelated.map((relArticle) => (
                    <div
                      key={relArticle.id}
                      className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleArticleClick(relArticle)}
                    >
                      <div className={`h-14 w-14 rounded-lg bg-gradient-to-br ${relArticle.gradient} shrink-0`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium line-clamp-2 leading-snug">{localizedText(relArticle.title)}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relArticle.readTime} {t("articles.minute")}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </motion.div>
      </>
    );
  }

  // Listing View
  return (
    <>
    <PurchaseDialog
      open={purchaseDialogOpen}
      onOpenChange={setPurchaseDialogOpen}
      itemTitle={selectedLockedItem?.title || ""}
      itemPrice={selectedLockedItem?.price || 0}
      contentId={selectedLockedItem?.id || ""}
      contentType={selectedLockedItem?.contentType || "articles"}
      contentTitleAr={selectedLockedItem?.titleAr || ""}
    />

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">{t("articles.title")}</h1>
        <p className="text-muted-foreground text-base max-w-2xl">{t("articles.description")}</p>
      </div>

      {/* Search & Filter */}
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

      {/* Articles Grid */}
      <AnimatePresence mode="wait">
        {filteredArticles.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <Newspaper className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{t("common.noResults")}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 h-full flex flex-col"
                  onClick={() => handleArticleClick(article)}
                >
                  {/* Image */}
                  <div className={`relative h-40 bg-gradient-to-br ${article.gradient} overflow-hidden`}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                    {!canAccessContentById(userWithSub, 'articles', article.id, article.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                        <Lock className="h-8 w-8 text-white" />
                      </div>
                    )}
                    <Newspaper className="absolute bottom-3 start-3 h-8 w-8 text-white/30" />
                    <Badge className="absolute top-3 start-3">{localizedText(article.category)}</Badge>
                    {!article.isFree && article.price > 0 && (
                      <Badge className="absolute top-3 end-3 bg-teal-600 text-white border-0">
                        {article.price.toLocaleString()} {t("common.currency")}
                      </Badge>
                    )}
                    {!article.isFree && article.price === 0 && (
                      <Lock className="absolute top-3 end-3 h-4 w-4 text-white/70" />
                    )}
                  </div>

                  <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
                    <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {localizedText(article.title)}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                      {localizedText(article.excerpt)}
                    </p>

                    <Separator />

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>{localizedText(article.author.name)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {article.readTime} {t("articles.minute")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          {article.rating}
                        </span>
                        {article.price > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400">
                            {article.price.toLocaleString()} {t("common.currency")}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button variant="link" className="p-0 h-auto text-primary">
                      {t("articles.readMore")}
                      <ArrowIcon className="h-4 w-4 ms-1" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
}
