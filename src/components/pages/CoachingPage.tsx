"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
                        {!item.isFree && (
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

                        {/* Action button */}
                        <div className="flex items-center gap-2">
                          {accessible ? (
                            <Button
                              size="sm"
                              className="gap-1.5 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white border-0"
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
