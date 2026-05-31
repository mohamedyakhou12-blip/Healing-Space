"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useUserWithFreshSubscription } from "@/hooks/useSubscription";
import { canAccessContentById } from "@/lib/content-access";
import { cachedFetch } from "@/lib/client-cache";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Clock,
  Lock,
  Eye,
  Heart,
  Activity,
  Brain,
  Music,
  Palette,
  Flower2,
  Stethoscope,
  PersonStanding,
  Sun,
  ArrowRight,
  ArrowLeft,
  Play,
  X,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";

interface CoachingItem {
  id: string;
  title: string;
  titleAr: string;
  titleFr: string;
  titleEn: string;
  description: string;
  descriptionAr: string;
  descriptionFr: string;
  descriptionEn: string;
  content: string;
  contentAr: string;
  contentFr: string;
  contentEn: string;
  videoUrl: string;
  image: string;
  duration: string;
  order: number;
  isFree: boolean;
  price: number;
  status: string;
  category: string;
  viewCount: number;
}

const COACHING_ICONS = [
  Sparkles,   // جلسة شهرية
  Activity,   // ورشة عمل
  Brain,      // تمارين
  Flower2,    // رحلة إعادة توازن
  Heart,      // حلول وفصول
  Music,      // تأمل
  Sun,        // تأكيدات إيجابية
  Palette,    // علاج فني
  Eye,        // طبيب العقل
  Stethoscope,// الطب الشمولي
  PersonStanding,       // ذاكرة الجسد
  Heart,      // شفاء وعلاج طبي
];

const COACHING_COLORS = [
  "from-rose-400 to-pink-500",
  "from-amber-400 to-orange-500",
  "from-violet-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-cyan-500",
  "from-indigo-400 to-blue-500",
  "from-yellow-400 to-amber-500",
  "from-pink-400 to-rose-500",
  "from-teal-400 to-emerald-500",
  "from-orange-400 to-red-500",
  "from-cyan-400 to-sky-500",
  "from-fuchsia-400 to-purple-500",
];

const COACHING_BG = [
  "bg-rose-50 dark:bg-rose-950/30",
  "bg-amber-50 dark:bg-amber-950/30",
  "bg-violet-50 dark:bg-violet-950/30",
  "bg-emerald-50 dark:bg-emerald-950/30",
  "bg-sky-50 dark:bg-sky-950/30",
  "bg-indigo-50 dark:bg-indigo-950/30",
  "bg-yellow-50 dark:bg-yellow-950/30",
  "bg-pink-50 dark:bg-pink-950/30",
  "bg-teal-50 dark:bg-teal-950/30",
  "bg-orange-50 dark:bg-orange-950/30",
  "bg-cyan-50 dark:bg-cyan-950/30",
  "bg-fuchsia-50 dark:bg-fuchsia-950/30",
];

export default function CoachingPage() {
  const { t, locale } = useTranslation();
  const { navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const [items, setItems] = useState<CoachingItem[]>([]);
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
  const [selectedItem, setSelectedItem] = useState<CoachingItem | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  // Fetch user purchases
  useEffect(() => {
    if (!userWithSub) return;
    fetch("/api/user-access")
      .then((res) => res.json())
      .then((data) => {
        if (data.purchasedContentIds) {
          setPurchasedContentIds(data.purchasedContentIds);
        }
      })
      .catch(() => {});
  }, [userWithSub]);

  useEffect(() => {
    cachedFetch<any>("/api/coachings", 60_000)
      .then((data) => {
        const coachings = (data.coachings || [])
          .filter((c: any) => c.status === "published")
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          .map((c: any) => ({
            id: c.id,
            title: c.titleAr || c.title || "",
            titleAr: c.titleAr || c.title || "",
            titleFr: c.titleFr || c.title || "",
            titleEn: c.titleEn || c.title || "",
            description: c.descriptionAr || c.description || "",
            descriptionAr: c.descriptionAr || c.description || "",
            descriptionFr: c.descriptionFr || c.description || "",
            descriptionEn: c.descriptionEn || c.description || "",
            content: c.contentAr || c.content || "",
            contentAr: c.contentAr || c.content || "",
            contentFr: c.contentFr || c.content || "",
            contentEn: c.contentEn || c.content || "",
            videoUrl: c.videoUrl || "",
            image: c.image || "",
            duration: c.duration || "",
            order: c.order || 0,
            isFree: c.isFree || false,
            price: c.price || 0,
            status: c.status || "draft",
            category: c.category || "",
            viewCount: c.viewCount || 0,
          }));
        setItems(coachings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const localizedTitle = (item: CoachingItem) =>
    locale === "ar" ? item.titleAr : locale === "fr" ? item.titleFr : item.titleEn;

  const localizedDesc = (item: CoachingItem) =>
    locale === "ar" ? item.descriptionAr : locale === "fr" ? item.descriptionFr : item.descriptionEn;

  const localizedContent = (item: CoachingItem) =>
    locale === "ar" ? item.contentAr : locale === "fr" ? item.contentFr : item.contentEn;

  const canAccess = (item: CoachingItem) =>
    canAccessContentById(
      userWithSub,
      "coaching",
      item.id,
      item.isFree,
      purchasedContentIds,
      activePlans,
      fullPlanIncludes,
      fullPlanExcludedItems
    );

  const openPurchaseDialog = (item: CoachingItem) => {
    setSelectedLockedItem({
      id: item.id,
      title: localizedTitle(item),
      titleAr: item.titleAr,
      price: item.price,
      contentType: "coaching",
    });
    setPurchaseDialogOpen(true);
  };

  const openCoachingDetail = (item: CoachingItem) => {
    setSelectedItem(item);
    setShowVideo(false);
  };

  const ArrowIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  // Helper: sanitize HTML for display
  const sanitizeDisplayHtml = (html: string): string => {
    if (!html) return '';
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
      .replace(/(href|src)\s*=\s*["']?\s*(javascript\s*:|data\s*:\s*text\/html)[^"'>]*/gi, '$1=""');
  };

  // ── Detail View ──
  if (selectedItem) {
    const item = selectedItem;
    const Icon = COACHING_ICONS[items.indexOf(item) % COACHING_ICONS.length];
    const gradient = COACHING_COLORS[items.indexOf(item) % COACHING_COLORS.length];
    const videoUrl = item.videoUrl;
    const content = localizedContent(item);
    const hasVideo = !!videoUrl;
    const hasContent = !!content && content !== localizedTitle(item);
    const isYouTube = hasVideo && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be'));

    return (
      <motion.div
        initial={{ opacity: 0, x: locale === "ar" ? -30 : 30 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-6 p-4 md:p-6 lg:p-8 max-w-4xl mx-auto"
      >
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => { setSelectedItem(null); setShowVideo(false); }}
          className="gap-2"
        >
          <ArrowIcon className="h-4 w-4" />
          {locale === "ar" ? "رجوع إلى الكوتشنغ" : locale === "fr" ? "Retour au coaching" : "Back to Coaching"}
        </Button>

        {/* Header Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className={`flex items-center gap-4 p-6 bg-gradient-to-br ${gradient}`}>
              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-lg">
                <Icon className="size-8 text-white" />
              </div>
              <div className="flex-1 min-w-0 text-white">
                <h1 className="text-2xl md:text-3xl font-bold leading-snug">
                  {localizedTitle(item)}
                </h1>
                {item.duration && (
                  <span className="flex items-center gap-1.5 text-white/80 text-sm mt-1">
                    <Clock className="size-4" />
                    {item.duration}
                  </span>
                )}
              </div>
            </div>
            {localizedDesc(item) && (
              <div className="px-6 py-4 bg-muted/30">
                <p className="text-muted-foreground leading-relaxed">
                  {localizedDesc(item)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Video Section */}
        {hasVideo && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-video bg-black">
                {isYouTube ? (
                  <>
                    {!showVideo ? (
                      <div
                        className="absolute inset-0 cursor-pointer group"
                        onClick={() => setShowVideo(true)}
                      >
                        <img
                          src={`https://img.youtube.com/vi/${videoUrl.match(/[\w-]{11}/)?.[0] || ''}/maxresdefault.jpg`}
                          alt="Video thumbnail"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                          <div className="flex size-20 items-center justify-center rounded-full bg-white/90 shadow-2xl group-hover:scale-110 transition-transform">
                            <Play className="size-10 text-rose-600 ms-1" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <iframe
                        src={`${videoUrl}${videoUrl.includes('?') ? '&' : '?'}autoplay=1&rel=0`}
                        title={localizedTitle(item)}
                        className="absolute inset-0 h-full w-full"
                        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    )}
                  </>
                ) : (
                  <>
                    {!showVideo ? (
                      <div
                        className="absolute inset-0 cursor-pointer group"
                        onClick={() => setShowVideo(true)}
                      >
                        {videoUrl.includes('res.cloudinary.com') ? (
                          <img
                            src={videoUrl.replace(/\/upload\/.*?\//, '/upload/so_0,w_800,h_450,c_pad,f_jpg/')}
                            alt="Video thumbnail"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-rose-900/50 to-pink-900/50">
                            <Play className="size-16 text-white/50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                          <div className="flex size-20 items-center justify-center rounded-full bg-white/90 shadow-2xl group-hover:scale-110 transition-transform">
                            <Play className="size-10 text-rose-600 ms-1" />
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
                      >
                        <source src={videoUrl} />
                        {locale === "ar" ? "متصفحك لا يدعم تشغيل الفيديو" : "Your browser does not support video playback"}
                      </video>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Text Content Section */}
        {hasContent && (
          <Card>
            <CardContent className="p-6">
              <div
                className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
                dir={locale === "ar" ? "rtl" : "ltr"}
                dangerouslySetInnerHTML={{ __html: sanitizeDisplayHtml(content) }}
              />
            </CardContent>
          </Card>
        )}

        {/* No content placeholder */}
        {!hasVideo && !hasContent && (
          <Card>
            <CardContent className="p-8 text-center space-y-3">
              <Sparkles className="h-12 w-12 text-muted-foreground/20 mx-auto" />
              <p className="text-muted-foreground">
                {locale === "ar" ? "سيتم إضافة محتوى هذا العنصر قريباً" : locale === "fr" ? "Le contenu de cet élément sera bientôt disponible" : "Content for this item will be available soon"}
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  }

  // ── Grid View ──
  return (
    <>
      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        itemTitle={selectedLockedItem?.title || ""}
        itemPrice={selectedLockedItem?.price || 0}
        contentId={selectedLockedItem?.id || ""}
        contentType={selectedLockedItem?.contentType || "coaching"}
        contentTitleAr={selectedLockedItem?.titleAr || ""}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
      >
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 shadow-lg">
              <Sparkles className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">{t("coaching.title")}</h1>
              <p className="text-muted-foreground text-base max-w-2xl">{t("coaching.description")}</p>
            </div>
          </div>
        </div>

        {/* Coaching Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border bg-card p-6 space-y-3">
                <div className="h-12 w-12 rounded-xl bg-muted" />
                <div className="h-5 w-3/4 bg-muted rounded" />
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-3 w-1/3 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Sparkles className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">
              {locale === "ar" ? "لا توجد عناصر كوتشنغ متاحة حالياً" : locale === "fr" ? "Aucun élément de coaching disponible pour le moment" : "No coaching items available at the moment"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, index) => {
              const Icon = COACHING_ICONS[index % COACHING_ICONS.length];
              const gradient = COACHING_COLORS[index % COACHING_COLORS.length];
              const bgColor = COACHING_BG[index % COACHING_BG.length];
              const accessible = canAccess(item);
              const hasContent = item.videoUrl || (item.contentAr && item.contentAr !== item.titleAr) || (item.contentFr && item.contentFr !== item.titleFr) || (item.contentEn && item.contentEn !== item.titleEn);

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                >
                  <Card
                    className={`group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${!accessible ? "opacity-85" : ""}`}
                  >
                    <CardContent className="p-0">
                      {/* Top colored section with icon */}
                      <div className={`relative flex items-center gap-4 p-5 ${bgColor}`}>
                        <div
                          className={`flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md`}
                        >
                          {!accessible ? (
                            <Lock className="size-6 text-white" />
                          ) : (
                            <Icon className="size-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base leading-snug line-clamp-2">
                            {localizedTitle(item)}
                          </h3>
                          {item.duration && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Clock className="size-3" />
                              {item.duration}
                            </span>
                          )}
                        </div>
                        {/* Price badge */}
                        {!item.isFree && item.price > 0 && (
                          <Badge className="shrink-0 bg-teal-600 text-white border-0 text-xs">
                            {item.price.toLocaleString()} {t("common.currency")}
                          </Badge>
                        )}
                        {item.isFree && (
                          <Badge variant="outline" className="shrink-0 text-xs border-emerald-400 text-emerald-600">
                            {t("common.free")}
                          </Badge>
                        )}
                      </div>

                      {/* Description section */}
                      <div className="px-5 pb-5 pt-3 space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {localizedDesc(item)}
                        </p>

                        {/* Content type indicator */}
                        {accessible && hasContent && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {item.videoUrl && (
                              <span className="flex items-center gap-1">
                                <Play className="size-3" />
                                {locale === "ar" ? "فيديو" : "Video"}
                              </span>
                            )}
                            {(item.contentAr || item.contentFr || item.contentEn) && (
                              <span className="flex items-center gap-1">
                                <Eye className="size-3" />
                                {locale === "ar" ? "محتوى" : "Content"}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Action button */}
                        <div className="flex items-center gap-2">
                          {accessible ? (
                            <Button
                              size="sm"
                              className="gap-1.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white border-0"
                              onClick={() => openCoachingDetail(item)}
                            >
                              <Sparkles className="size-3.5" />
                              {locale === "ar" ? "ابدأ الآن" : locale === "fr" ? "Commencer" : "Start Now"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-primary/30 text-primary"
                              onClick={() => {
                                if (individualPurchasesEnabled && item.price > 0) {
                                  openPurchaseDialog(item);
                                } else {
                                  navigate("subscriptions");
                                }
                              }}
                            >
                              <Lock className="size-3.5" />
                              {t("common.subscribeToAccess")}
                            </Button>
                          )}
                          {item.viewCount > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Eye className="size-3" />
                              {item.viewCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </>
  );
}
