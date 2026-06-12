"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useUserWithFreshSubscription } from "@/hooks/useSubscription";
import { canAccessContentById } from "@/lib/content-access";
import { cachedFetch } from "@/lib/client-cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Search,
  Lock,
  BookOpen,
  HardDrive,
  X,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";

interface PdfItem {
  id: string;
  title: { ar: string; en: string; fr: string };
  description: { ar: string; en: string; fr: string };
  author: { ar: string; en: string; fr: string };
  fileSize: string;
  pages: number;
  isFree: boolean;
  price: number;
  gradient: string;
  category: { ar: string; en: string; fr: string };
  fileUrl: string;
}

const GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-cyan-600",
];

const mockPdfs: PdfItem[] = [
  {
    id: "pdf-1",
    title: {
      ar: "دليل التأمل واليقظة الذهنية",
      en: "Guide to Meditation and Mindfulness",
      fr: "Guide de Méditation et Pleine Conscience",
    },
    description: {
      ar: "دليل عملي شامل يتضمن تمارين التأمل الموجه ونصائح لتطوير ممارسة اليقظة الذهنية في حياتك اليومية.",
      en: "A comprehensive practical guide including guided meditation exercises and tips for developing mindfulness practice in your daily life.",
      fr: "Un guide pratique complet incluant des exercices de méditation guidée et des conseils pour développer la pleine conscience.",
    },
    author: { ar: "أ. فاطمة الزهراء", en: "Ms. Fatima El Zahra", fr: "Mme Fatima El Zahra" },
    fileSize: "4.2 MB",
    pages: 45,
    isFree: true,
    price: 0,
    gradient: "from-emerald-400 to-teal-600",
    category: { ar: "التأمل", en: "Meditation", fr: "Méditation" },
    fileUrl: "",
  },
  {
    id: "pdf-2",
    title: {
      ar: "فهم اضطرابات القلق: دليل شامل",
      en: "Understanding Anxiety Disorders: A Comprehensive Guide",
      fr: "Comprendre les Troubles Anxieux: Un Guide Complet",
    },
    description: {
      ar: "كتاب إلكتروني متخصص يشرح أنواع اضطرابات القلق وأعراضها وطرق التشخيص والعلاج المتاحة.",
      en: "A specialized e-book explaining types of anxiety disorders, their symptoms, diagnosis methods, and available treatments.",
      fr: "Un e-book spécialisé expliquant les types de troubles anxieux, leurs symptômes et traitements.",
    },
    author: { ar: "د. خالد مراد", en: "Dr. Khaled Mourad", fr: "Dr. Khaled Mourad" },
    fileSize: "8.7 MB",
    pages: 120,
    isFree: false,
    price: 1500,
    gradient: "from-amber-400 to-orange-600",
    category: { ar: "اضطرابات القلق", en: "Anxiety Disorders", fr: "Troubles Anxieux" },
    fileUrl: "",
  },
  {
    id: "pdf-3",
    title: {
      ar: "مفكرة العافية النفسية اليومية",
      en: "Daily Mental Wellness Journal",
      fr: "Journal Quotidien de Bien-Être Mental",
    },
    description: {
      ar: "مفكرة تفاعلية تساعدك على تتبع مزاجك اليومي وممارسة الامتنان وتحديد أهدافك النفسية.",
      en: "An interactive journal to help you track your daily mood, practice gratitude, and set mental health goals.",
      fr: "Un journal interactif pour suivre votre humeur quotidienne et pratiquer la gratitude.",
    },
    author: { ar: "د. ليلى مراد", en: "Dr. Laila Mourad", fr: "Dr. Laila Mourad" },
    fileSize: "2.1 MB",
    pages: 30,
    isFree: true,
    price: 0,
    gradient: "from-violet-400 to-purple-600",
    category: { ar: "التطوير الشخصي", en: "Personal Development", fr: "Développement Personnel" },
    fileUrl: "",
  },
  {
    id: "pdf-4",
    title: {
      ar: "الذكاء العاطفي في مكان العمل",
      en: "Emotional Intelligence in the Workplace",
      fr: "L'Intelligence Émotionnelle au Travail",
    },
    description: {
      ar: "كتاب متقدم عن تطبيق مهارات الذكاء العاطفي في بيئة العمل لتحسين الأداء وبناء علاقات مهنية أفضل.",
      en: "An advanced book on applying emotional intelligence skills in the workplace to improve performance and professional relationships.",
      fr: "Un livre avancé sur l'application de l'intelligence émotionnelle au travail.",
    },
    author: { ar: "د. محمد أمين", en: "Dr. Mohamed Amine", fr: "Dr. Mohamed Amine" },
    fileSize: "5.5 MB",
    pages: 85,
    isFree: false,
    price: 2500,
    gradient: "from-rose-400 to-pink-600",
    category: { ar: "الذكاء العاطفي", en: "Emotional Intelligence", fr: "Intelligence Émotionnelle" },
    fileUrl: "",
  },
];

export default function PdfsPage() {
  const { t, locale } = useTranslation();
  const { navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "paid">("all");
  const [apiPdfs, setApiPdfs] = useState<PdfItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasedContentIds, setPurchasedContentIds] = useState<string[]>([]);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<PdfItem | null>(null);
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
    cachedFetch<any>('/api/pdfs', 60_000)
      .then(data => {
        const pdfs = (data.pdfs || [])
          .filter((p: any) => p.status === 'published')
          .map((p: any, i: number) => ({
            id: p.id,
            title: { ar: p.titleAr || p.title, en: p.titleEn || p.title, fr: p.titleFr || p.title },
            description: { ar: p.descriptionAr || p.description, en: p.descriptionEn || p.description, fr: p.descriptionFr || p.description },
            author: { ar: p.author || "", en: p.author || "", fr: p.author || "" },
            fileSize: p.fileSize || "",
            pages: p.pageCount || p.pages || 0,
            isFree: p.isFree || false,
            price: p.price || 0,
            gradient: GRADIENTS[i % GRADIENTS.length],
            category: { ar: p.category || "", en: p.category || "", fr: p.category || "" },
            fileUrl: p.fileUrl || "",
          }));
        if (pdfs.length > 0) setApiPdfs(pdfs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayPdfs = apiPdfs || mockPdfs;

  const filteredPdfs = useMemo(() => {
    return displayPdfs.filter((pdf) => {
      const title = pdf.title[locale] || pdf.title.ar;
      const matchesSearch = !searchQuery || title.includes(searchQuery);
      const matchesFilter =
        filterType === "all" ||
        (filterType === "free" && pdf.isFree) ||
        (filterType === "paid" && !pdf.isFree);
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filterType, locale, displayPdfs]);

  const localizedText = (obj: { ar: string; en: string; fr: string }) =>
    obj[locale] || obj.ar;

  const openPurchaseDialog = (pdf: PdfItem) => {
    setSelectedLockedItem({
      id: pdf.id,
      title: localizedText(pdf.title),
      titleAr: pdf.title.ar,
      price: pdf.price,
      contentType: "pdfs",
    });
    setPurchaseDialogOpen(true);
  };

  const handleDownload = (pdf: PdfItem) => {
    if (!canAccessContentById(userWithSub, 'pdfs', pdf.id, pdf.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems)) {
      if (individualPurchasesEnabled) {
        openPurchaseDialog(pdf);
      }
      return;
    }
    if (pdf.fileUrl) {
      setSelectedPdf(pdf);
    } else {
      toast.error(locale === "ar" ? "الملف غير متوفر بعد" : locale === "fr" ? "Fichier pas encore disponible" : "File not available yet");
    }
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
              <div className="h-32 bg-muted animate-pulse rounded-xl" />
              <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <>
    <PurchaseDialog
      open={purchaseDialogOpen}
      onOpenChange={setPurchaseDialogOpen}
      itemTitle={selectedLockedItem?.title || ""}
      itemPrice={selectedLockedItem?.price || 0}
      contentId={selectedLockedItem?.id || ""}
      contentType={selectedLockedItem?.contentType || "pdfs"}
      contentTitleAr={selectedLockedItem?.titleAr || ""}
    />

    {selectedPdf && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setSelectedPdf(null)} className="gap-2">
          <X className="h-4 w-4" />
          {t("common.back")}
        </Button>

        <div className="space-y-3">
          <h1 className="text-xl sm:text-2xl font-bold">{localizedText(selectedPdf.title)}</h1>
          <p className="text-muted-foreground">{localizedText(selectedPdf.description)}</p>
        </div>

        {/* PDF Viewer */}
        <div className="w-full border rounded-xl overflow-hidden bg-muted" style={{ height: '80vh' }}>
          <iframe
            src={selectedPdf.fileUrl}
            className="w-full h-full"
            title={localizedText(selectedPdf.title)}
          />
          {/* Fallback: if iframe fails, show download link */}
          <noscript>
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <FileText className="h-16 w-16 text-muted-foreground/50" />
              <p className="text-muted-foreground text-center">
                {locale === "ar" ? "متصفحك لا يدعم عرض PDF مباشرة" : locale === "fr" ? "Votre navigateur ne supporte pas l'affichage PDF" : "Your browser doesn't support inline PDF viewing"}
              </p>
            </div>
          </noscript>
        </div>

        {/* Download button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="w-full sm:w-auto" onClick={() => window.open(selectedPdf.fileUrl, '_blank')}>
            <Download className="h-4 w-4 me-2" />
            {t("pdfs.download")}
          </Button>
          {/* Alternative: Open in Google Docs Viewer for browsers without PDF support */}
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(selectedPdf.fileUrl)}&embedded=true`, '_blank')}
          >
            <FileText className="h-4 w-4 me-2" />
            {locale === "ar" ? "عرض في عارض Google" : locale === "fr" ? "Voir dans Google Viewer" : "Open in Google Viewer"}
          </Button>
        </div>
      </motion.div>
    )}

    {!selectedPdf && (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">{t("pdfs.title")}</h1>
        <p className="text-muted-foreground text-base max-w-2xl">{t("pdfs.description")}</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
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

      {/* PDF Grid */}
      <AnimatePresence mode="wait">
        {filteredPdfs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{t("common.noResults")}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPdfs.map((pdf, index) => (
              <motion.div
                key={pdf.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="group hover:shadow-lg transition-all duration-300 h-full flex flex-col overflow-hidden">
                  <CardContent className="p-0 flex flex-col h-full">
                    {/* Top section: gradient header */}
                    <div className={`relative h-32 bg-gradient-to-br ${pdf.gradient} p-5 flex items-end`}>
                      {!canAccessContentById(userWithSub, 'pdfs', pdf.id, pdf.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                          <Lock className="h-8 w-8 text-white" />
                        </div>
                      )}
                      <div className="absolute top-4 start-4">
                        {pdf.isFree ? (
                          <Badge className="bg-white/90 text-emerald-700 border-0">
                            {t("common.free")}
                          </Badge>
                        ) : pdf.price > 0 ? (
                          <Badge className="bg-teal-600 text-white border-0">
                            {pdf.price.toLocaleString()} {t("common.currency")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-white/90 text-foreground border-0">
                            {t("common.paid")}
                          </Badge>
                        )}
                      </div>
                      <div className="relative z-10">
                        <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2">
                          <FileText className="h-7 w-7 text-white" />
                        </div>
                        <Badge className="bg-white/20 text-white border-0 text-[10px]">
                          {localizedText(pdf.category)}
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 space-y-3 flex flex-col">
                      <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {localizedText(pdf.title)}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                        {localizedText(pdf.description)}
                      </p>

                      {/* Meta Info */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1 border-t">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3.5 w-3.5" />
                          {pdf.fileSize}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          {pdf.pages} {t("pdfs.pageCount")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {localizedText(pdf.author)}
                        </span>
                      </div>

                      {/* Download Button */}
                      <div className="mt-auto pt-2">
                        {!canAccessContentById(userWithSub, 'pdfs', pdf.id, pdf.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) ? (
                          individualPurchasesEnabled && pdf.price > 0 ? (
                            <Button className="w-full" size="sm" onClick={() => openPurchaseDialog(pdf)}>
                              {t("common.buyNow")}
                            </Button>
                          ) : (
                            <Button className="w-full" size="sm" variant="secondary" disabled>
                              <Lock className="h-4 w-4 me-2" />
                              {t("common.subscribeToAccess")}
                            </Button>
                          )
                        ) : (
                          <Button
                            className="w-full"
                            size="sm"
                            onClick={() => handleDownload(pdf)}
                          >
                            <Download className="h-4 w-4 me-2" />
                            {t("pdfs.download")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </motion.div>
    )}
    </>
  );
}
