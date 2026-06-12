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
  BookOpen,
  Download,
  Search,
  Lock,
  HardDrive,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";

interface BookItem {
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
}

const GRADIENTS = [
  "from-amber-400 to-orange-600",
  "from-emerald-400 to-teal-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-cyan-600",
];

const mockBooks: BookItem[] = [
  {
    id: "book-1",
    title: {
      ar: "دليلك الشامل للصحة النفسية",
      en: "Your Comprehensive Guide to Mental Health",
      fr: "Votre Guide Complet de Santé Mentale",
    },
    description: {
      ar: "دليل شامل يغطي أساسيات الصحة النفسية وكيفية الحفاظ عليها وتطوير المرونة النفسية.",
      en: "A comprehensive guide covering the fundamentals of mental health and how to maintain and develop psychological resilience.",
      fr: "Un guide complet couvrant les fondamentaux de la santé mentale et comment développer la résilience psychologique.",
    },
    author: { ar: "د. سارة بن علي", en: "Dr. Sara Ben Ali", fr: "Dr. Sara Ben Ali" },
    fileSize: "5.2 MB",
    pages: 245,
    isFree: true,
    price: 0,
    gradient: "from-amber-400 to-orange-600",
    category: { ar: "الصحة النفسية", en: "Mental Health", fr: "Santé Mentale" },
  },
  {
    id: "book-2",
    title: {
      ar: "فن العلاج النفسي المعرفي",
      en: "The Art of Cognitive Psychotherapy",
      fr: "L'Art de la Psychothérapie Cognitive",
    },
    description: {
      ar: "كتاب متقدم في العلاج المعرفي السلوكي يشرح التقنيات والتطبيقات العملية.",
      en: "An advanced book on cognitive behavioral therapy explaining techniques and practical applications.",
      fr: "Un livre avancé sur la thérapie cognitivo-comportementale expliquant les techniques et applications pratiques.",
    },
    author: { ar: "د. خالد مراد", en: "Dr. Khaled Mourad", fr: "Dr. Khaled Mourad" },
    fileSize: "8.1 MB",
    pages: 320,
    isFree: false,
    price: 1500,
    gradient: "from-emerald-400 to-teal-600",
    category: { ar: "العلاج المعرفي", en: "Cognitive Therapy", fr: "Thérapie Cognitive" },
  },
  {
    id: "book-3",
    title: {
      ar: "التأمل والوعي الذاتي",
      en: "Meditation and Self-Awareness",
      fr: "Méditation et Conscience de Soi",
    },
    description: {
      ar: "كتاب يأخذك في رحلة داخلية لاكتشاف الذات من خلال تقنيات التأمل والذهنية.",
      en: "A book that takes you on an inner journey of self-discovery through meditation and mindfulness techniques.",
      fr: "Un livre qui vous emmène dans un voyage intérieur de découverte de soi à travers la méditation et la pleine conscience.",
    },
    author: { ar: "أ. فاطمة الزهراء", en: "Ms. Fatima El Zahra", fr: "Mme Fatima El Zahra" },
    fileSize: "3.7 MB",
    pages: 180,
    isFree: false,
    price: 2000,
    gradient: "from-violet-400 to-purple-600",
    category: { ar: "التأمل", en: "Meditation", fr: "Méditation" },
  },
  {
    id: "book-4",
    title: {
      ar: "بناء المرونة النفسية",
      en: "Building Psychological Resilience",
      fr: "Construire la Résilience Psychologique",
    },
    description: {
      ar: "دليل عملي لبناء المرونة النفسية والتعامل مع الضغوط والتحديات الحياتية.",
      en: "A practical guide to building psychological resilience and dealing with life's pressures and challenges.",
      fr: "Un guide pratique pour développer la résilience psychologique et faire face aux pressions de la vie.",
    },
    author: { ar: "د. ليلى مراد", en: "Dr. Laila Mourad", fr: "Dr. Laila Mourad" },
    fileSize: "6.3 MB",
    pages: 275,
    isFree: true,
    price: 0,
    gradient: "from-rose-400 to-pink-600",
    category: { ar: "التطوير الشخصي", en: "Personal Development", fr: "Développement Personnel" },
  },
  {
    id: "book-5",
    title: {
      ar: "التعامل مع الضغوط الحياتية",
      en: "Managing Life Pressures",
      fr: "Gérer les Pressions de la Vie",
    },
    description: {
      ar: "كتاب شامل عن استراتيجيات التعامل مع الضغوط اليومية وتقنيات الاسترخاء.",
      en: "A comprehensive book about strategies for dealing with daily pressures and relaxation techniques.",
      fr: "Un livre complet sur les stratégies pour gérer les pressions quotidiennes et les techniques de relaxation.",
    },
    author: { ar: "د. محمد أمين", en: "Dr. Mohamed Amine", fr: "Dr. Mohamed Amine" },
    fileSize: "4.8 MB",
    pages: 210,
    isFree: false,
    price: 1800,
    gradient: "from-sky-400 to-cyan-600",
    category: { ar: "إدارة الضغوط", en: "Stress Management", fr: "Gestion du Stress" },
  },
  {
    id: "book-6",
    title: {
      ar: "مقدمة في العلاج بالفن",
      en: "Introduction to Art Therapy",
      fr: "Introduction à l'Art-thérapie",
    },
    description: {
      ar: "كتاب تعريفي بالعلاج بالفن وتطبيقاته في تحسين الصحة النفسية والتعبير عن المشاعر.",
      en: "An introductory book on art therapy and its applications in improving mental health and emotional expression.",
      fr: "Un livre d'introduction à l'art-thérapie et ses applications dans l'amélioration de la santé mentale.",
    },
    author: { ar: "د. سارة بن علي", en: "Dr. Sara Ben Ali", fr: "Dr. Sara Ben Ali" },
    fileSize: "3.2 MB",
    pages: 155,
    isFree: true,
    price: 0,
    gradient: "from-amber-400 to-orange-600",
    category: { ar: "العلاج بالفن", en: "Art Therapy", fr: "Art-thérapie" },
  },
];

export default function BooksPage() {
  const { t, locale } = useTranslation();
  const { navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "paid">("all");
  const [apiBooks, setApiBooks] = useState<BookItem[] | null>(null);
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
    cachedFetch<any>('/api/pdfs', 60_000)
      .then(data => {
        const books = (data.pdfs || [])
          .filter((p: any) => p.status === 'published')
          .map((p: any, i: number) => ({
            id: p.id,
            title: { ar: p.titleAr || p.title, en: p.titleEn || p.title, fr: p.titleFr || p.title },
            description: { ar: p.descriptionAr || p.description, en: p.descriptionEn || p.description, fr: p.descriptionFr || p.description },
            author: { ar: p.author || "", en: p.author || "", fr: p.author || "" },
            fileSize: p.fileSize || "",
            pages: p.pages || 0,
            isFree: p.isFree || false,
            price: p.price || 0,
            gradient: GRADIENTS[i % GRADIENTS.length],
            category: { ar: p.category || "", en: p.category || "", fr: p.category || "" },
          }));
        if (books.length > 0) setApiBooks(books);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayBooks = apiBooks || mockBooks;

  const filteredBooks = useMemo(() => {
    return displayBooks.filter((book) => {
      const title = book.title[locale] || book.title.ar;
      const matchesSearch = !searchQuery || title.includes(searchQuery);
      const matchesFilter =
        filterType === "all" ||
        (filterType === "free" && book.isFree) ||
        (filterType === "paid" && !book.isFree);
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filterType, locale, displayBooks]);

  const localizedText = (obj: { ar: string; en: string; fr: string }) =>
    obj[locale] || obj.ar;

  const openPurchaseDialog = (book: BookItem) => {
    setSelectedLockedItem({
      id: book.id,
      title: localizedText(book.title),
      titleAr: book.title.ar,
      price: book.price,
      contentType: "pdfs",
    });
    setPurchaseDialogOpen(true);
  };

  const handleDownload = (book: any) => {
    if (!canAccessContentById(userWithSub, 'pdfs', book.id, book.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems)) {
      if (individualPurchasesEnabled) {
        openPurchaseDialog(book);
      }
      return;
    }
    if (!book.fileUrl && !book.pdfUrl) {
      toast.error(locale === "ar" ? "رابط الملف غير متوفر" : locale === "fr" ? "Lien du fichier non disponible" : "File URL not available");
      return;
    }
    const url = book.fileUrl || book.pdfUrl;
    window.open(url, '_blank');
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

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">{t("books.title")}</h1>
        <p className="text-muted-foreground text-base max-w-2xl">{t("books.description")}</p>
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

      {/* Books Grid */}
      <AnimatePresence mode="wait">
        {filteredBooks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{t("books.noBooks")}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBooks.map((book, index) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="group hover:shadow-lg transition-all duration-300 h-full flex flex-col overflow-hidden">
                  <CardContent className="p-0 flex flex-col h-full">
                    {/* Top section: gradient header */}
                    <div className={`relative h-32 bg-gradient-to-br ${book.gradient} p-5 flex items-end`}>
                      {!canAccessContentById(userWithSub, 'pdfs', book.id, book.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                          <Lock className="h-8 w-8 text-white" />
                        </div>
                      )}
                      <div className="absolute top-4 start-4">
                        {book.isFree ? (
                          <Badge className="bg-white/90 text-emerald-700 border-0">
                            {t("common.free")}
                          </Badge>
                        ) : book.price > 0 ? (
                          <Badge className="bg-teal-600 text-white border-0">
                            {book.price.toLocaleString()} {t("common.currency")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-white/90 text-foreground border-0">
                            {t("common.paid")}
                          </Badge>
                        )}
                      </div>
                      <div className="relative z-10">
                        <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2">
                          <BookOpen className="h-7 w-7 text-white" />
                        </div>
                        <Badge className="bg-white/20 text-white border-0 text-[10px]">
                          {localizedText(book.category)}
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 space-y-3 flex flex-col">
                      <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {localizedText(book.title)}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                        {localizedText(book.description)}
                      </p>

                      {/* Meta Info */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1 border-t">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3.5 w-3.5" />
                          {book.fileSize}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5" />
                          {book.pages} {t("books.pageCount")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {localizedText(book.author)}
                        </span>
                      </div>

                      {/* Download Button */}
                      <div className="mt-auto pt-2">
                        {!canAccessContentById(userWithSub, 'pdfs', book.id, book.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) ? (
                          individualPurchasesEnabled && book.price > 0 ? (
                            <Button className="w-full" size="sm" onClick={() => openPurchaseDialog(book)}>
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
                            onClick={() => handleDownload(book)}
                          >
                            <Download className="h-4 w-4 me-2" />
                            {t("books.download")}
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
    </>
  );
}
