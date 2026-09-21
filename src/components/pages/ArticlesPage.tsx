"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useUserWithFreshSubscription } from "@/hooks/useSubscription";
import { canAccessContentById } from "@/lib/content-access";
import { cachedFetch } from "@/lib/client-cache";
import { getOptimizedImageUrl } from "@/lib/cloudinary-utils";
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
  FileText,
  ExternalLink,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";

interface Attachment {
  name: string;
  url: string;
  size?: string;
}

interface Article {
  id: string;
  title: { ar: string; en: string; fr: string };
  excerpt: { ar: string; en: string; fr: string };
  content: { ar: string; en: string; fr: string };
  author: { name: { ar: string; en: string; fr: string }; bio: { ar: string; en: string; fr: string } };
  category: { ar: string; en: string; fr: string };
  image: string;
  attachments: Attachment[];
  gradient: string;
  readTime: number;
  publishedDate: string;
  rating: number;
  isFree: boolean;
  price: number;
}

const GRADIENTS = [
  "from-healing-beige to-healing-brown",
  "from-amber-400 to-orange-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-healing-sand",
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
            image: a.image || a.thumbnail || "",
            attachments: (a.attachments as Array<{name: string; url: string; size?: string}> || []),
            gradient: GRADIENTS[i % GRADIENTS.length],
            readTime: a.readTime || 5,
            publishedDate: a.createdAt ? new Date(a.createdAt).toISOString().split('T')[0] : "",
            rating: a.avgRating || 0,
            isFree: a.isFree || false,
            price: a.price || 0,
          }));
        setApiArticles(articles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayArticles = apiArticles || [];

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
                  <Badge variant="outline" className="text-healing-brown border-healing-beige-light bg-healing-cream">
                    {t("common.free")}
                  </Badge>
                ) : article.price > 0 ? (
                  <Badge variant="outline" className="text-healing-brown border-healing-beige-light bg-healing-cream">
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
                    {article.image && <img src={getOptimizedImageUrl(article.image, { width: 800, height: 450, quality: "auto:good" })} alt={localizedText(article.title)} className="h-full w-full object-cover" loading="lazy" />}
                    <Newspaper className="absolute bottom-4 start-4 h-12 w-12 text-white/20" />
                  </div>
                  <div
                    className="prose prose-neutral dark:prose-invert max-w-none text-base leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: localizedText(article.content) }}
                  />
                  {/* Attachments */}
                  {article.attachments && article.attachments.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <h3 className="font-semibold mb-3">{t("admin.attachments") || "الملفات المرفقة"}</h3>
                      <div className="space-y-2">
                        {article.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                          >
                            <FileText className="size-5 text-primary" />
                            <span className="font-medium truncate flex-1">{att.name}</span>
                            {att.size && <span className="text-xs text-muted-foreground">{att.size}</span>}
                            <ExternalLink className="size-4 text-muted-foreground" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rating Section */}
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <h3 className="font-semibold">{t("reviews.writeReview")}</h3>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-7 w-7 text-amber-400 fill-amber-400 cursor-pointer hover:scale-110 transition-transform" />
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
                      <p className="text-3xl font-bold text-healing-brown dark:text-healing-beige">{article.price.toLocaleString()} <span className="text-base font-normal">{t("common.currency")}</span></p>
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
                    {article.image && <img src={getOptimizedImageUrl(article.image, { width: 400, height: 250, quality: "auto:good" })} alt={localizedText(article.title)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                    {!canAccessContentById(userWithSub, 'articles', article.id, article.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                        <Lock className="h-8 w-8 text-white" />
                      </div>
                    )}
                    <Newspaper className="absolute bottom-3 start-3 h-8 w-8 text-white/30" />
                    <Badge className="absolute top-3 start-3">{localizedText(article.category)}</Badge>
                    {!article.isFree && article.price > 0 && (
                      <Badge className="absolute top-3 end-3 bg-healing-brown text-white border-0">
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
                          <span className="flex items-center gap-1 font-semibold text-healing-brown dark:text-healing-beige">
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
