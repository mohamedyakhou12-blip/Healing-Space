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
import {
  Play,
  Clock,
  Eye,
  ThumbsUp,
  X,
  Lock,
  Video,
  Search,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { toast } from "sonner";

interface VideoItem {
  id: string;
  title: { ar: string; en: string; fr: string };
  description: { ar: string; en: string; fr: string };
  duration: string;
  views: number;
  likes: number;
  publishedDate: string;
  gradient: string;
  image: string;
  isFree: boolean;
  price: number;
  youtubeId?: string;
}

const GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-cyan-600",
];

const mockVideos: VideoItem[] = [
  {
    id: "vid-1",
    title: { ar: "مقدمة في العلاج النفسي: ما تحتاج أن تعرفه", en: "Introduction to Psychotherapy: What You Need to Know", fr: "Introduction à la Psychothérapie: Ce Que Vous Devez Savoir" },
    description: { ar: "في هذا الفيديو نقدم مقدمة شاملة عن العلاج النفسي وأنواعه المختلفة ومتى يجب التفكير في زيارة معالج نفسي.", en: "In this video we present a comprehensive introduction to psychotherapy, its different types, and when to consider visiting a therapist.", fr: "Dans cette vidéo, nous présentons une introduction complète à la psychothérapie." },
    duration: "18:45", views: 12450, likes: 892, publishedDate: "2025-01-20",
    gradient: "from-emerald-400 to-teal-600",
    image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=250&fit=crop",
    isFree: true, price: 0, youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "vid-2",
    title: { ar: "تمارين التنفس للاسترخاء الفوري", en: "Breathing Exercises for Instant Relaxation", fr: "Exercices de Respiration pour une Relaxation Instantanée" },
    description: { ar: "تعلم 5 تمارين تنفس بسيطة وفعالة يمكنك ممارستها في أي وقت ومكان للاسترخاء الفوري والتخلص من التوتر.", en: "Learn 5 simple and effective breathing exercises you can practice anytime, anywhere for instant relaxation and stress relief.", fr: "Apprenez 5 exercices de respiration simples et efficaces pour une relaxation instantanée." },
    duration: "12:30", views: 8900, likes: 654, publishedDate: "2025-02-15",
    gradient: "from-amber-400 to-orange-600",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=250&fit=crop",
    isFree: true, price: 0, youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "vid-3",
    title: { ar: "كيف تتعامل مع الأفكار السلبية؟", en: "How to Deal with Negative Thoughts?", fr: "Comment Gérer les Pensées Négatives ?" },
    description: { ar: "استراتيجيات عملية وفعالة للتعامل مع الأفكار السلبية وتحويلها إلى أفكار إيجابية وبناءة.", en: "Practical and effective strategies for dealing with negative thoughts and transforming them into positive ones.", fr: "Stratégies pratiques et efficaces pour gérer les pensées négatives." },
    duration: "22:15", views: 15200, likes: 1100, publishedDate: "2025-03-10",
    gradient: "from-violet-400 to-purple-600",
    image: "https://images.unsplash.com/photo-1515894203077-9cd36032142f?w=400&h=250&fit=crop",
    isFree: false, price: 2000, youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "vid-4",
    title: { ar: "دليل الآباء: فهم مشاعر أبنائك", en: "Parents' Guide: Understanding Your Children's Feelings", fr: "Guide des Parents: Comprendre les Sentiments de Vos Enfants" },
    description: { ar: "في هذا الفيديو نستضيف د. ليلى مراد لمناقشة كيفية فهم مشاعر الأطفال والتواصل معهم بطريقة صحية.", en: "In this video we host Dr. Laila Mourad to discuss how to understand children's feelings and communicate with them healthily.", fr: "Dans cette vidéo, nous recevons le Dr. Laila Mourad pour discuter de la compréhension des sentiments des enfants." },
    duration: "28:00", views: 9800, likes: 780, publishedDate: "2025-03-25",
    gradient: "from-rose-400 to-pink-600",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=250&fit=crop",
    isFree: false, price: 2500, youtubeId: "dQw4w9WgXcQ",
  },
  {
    id: "vid-5",
    title: { ar: "جلسة تأمل موجّهة لمدة 10 دقائق", en: "10-Minute Guided Meditation Session", fr: "Séance de Méditation Guidée de 10 Minutes" },
    description: { ar: "جلسة تأمل موجّهة مع أ. فاطمة الزهراء للاسترخاء العميق وتصفية الذهن.", en: "A guided meditation session with Ms. Fatima El Zahra for deep relaxation and mind clearing.", fr: "Une séance de méditation guidée avec Mme Fatima El Zahra." },
    duration: "10:30", views: 22000, likes: 1850, publishedDate: "2025-04-05",
    gradient: "from-sky-400 to-cyan-600",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=250&fit=crop",
    isFree: true, price: 0, youtubeId: "dQw4w9WgXcQ",
  },
];

export default function VideosPage() {
  const { t, locale } = useTranslation();
  const { navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [apiVideos, setApiVideos] = useState<VideoItem[] | null>(null);
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
    cachedFetch<any>('/api/videos', 60_000)
      .then(data => {
        const videos = (data.videos || [])
          .filter((v: any) => v.status === 'published')
          .map((v: any, i: number) => ({
            id: v.id,
            title: { ar: v.titleAr || v.title, en: v.titleEn || v.title, fr: v.titleFr || v.title },
            description: { ar: v.descriptionAr || v.description, en: v.descriptionEn || v.description, fr: v.descriptionFr || v.description },
            duration: v.duration || "",
            views: v.views || 0,
            likes: v.likes || 0,
            publishedDate: v.createdAt ? new Date(v.createdAt).toISOString().split('T')[0] : "",
            gradient: GRADIENTS[i % GRADIENTS.length],
            image: v.image || v.thumbnail || "",
            isFree: v.isFree || false,
            price: v.price || 0,
            youtubeId: v.youtubeId || undefined,
          }));
        if (videos.length > 0) setApiVideos(videos);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayVideos = apiVideos || mockVideos;

  const filteredVideos = useMemo(() => {
    return displayVideos.filter((video) => {
      const title = video.title[locale] || video.title.ar;
      return !searchQuery || title.includes(searchQuery);
    });
  }, [searchQuery, locale, displayVideos]);

  const localizedText = (obj: { ar: string; en: string; fr: string }) =>
    obj[locale] || obj.ar;

  const relatedVideos = selectedVideo
    ? displayVideos.filter((v) => v.id !== selectedVideo.id).slice(0, 3)
    : [];

  const openPurchaseDialog = (video: VideoItem) => {
    setSelectedLockedItem({
      id: video.id,
      title: video.title[locale] || video.title.ar || video.title.en,
      titleAr: video.title.ar,
      price: video.price,
      contentType: "videos",
    });
    setPurchaseDialogOpen(true);
  };

  const handleVideoClick = (video: VideoItem) => {
    if (!canAccessContentById(userWithSub, 'videos', video.id, video.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems)) {
      if (individualPurchasesEnabled) {
        openPurchaseDialog(video);
      }
      return;
    }
    setSelectedVideo(video);
  };

  return (
    <>
    <PurchaseDialog
      open={purchaseDialogOpen}
      onOpenChange={setPurchaseDialogOpen}
      itemTitle={selectedLockedItem?.title || ""}
      itemPrice={selectedLockedItem?.price || 0}
      contentId={selectedLockedItem?.id || ""}
      contentType={selectedLockedItem?.contentType || "videos"}
      contentTitleAr={selectedLockedItem?.titleAr || ""}
    />

    {loading ? (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <div className="h-10 w-64 bg-muted animate-pulse rounded" />
          <div className="h-5 w-96 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-video bg-muted animate-pulse rounded-xl" />
              <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
              <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </motion.div>
    ) : selectedVideo ? (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
      >
        <Button variant="ghost" size="sm" onClick={() => setSelectedVideo(null)} className="gap-2">
          <X className="h-4 w-4" />
          {t("common.back")}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
              {selectedVideo.youtubeId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1&rel=0`}
                  title={localizedText(selectedVideo.title)}
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <>
                  {selectedVideo.image && (
                    <img src={selectedVideo.image} alt={localizedText(selectedVideo.title)} className="absolute inset-0 h-full w-full object-cover opacity-40" />
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-br ${selectedVideo.gradient} opacity-30`} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <Video className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-sm opacity-70">
                      {locale === "ar" ? "الفيديو سيكون متاحاً قريباً" : locale === "fr" ? "La vidéo sera bientôt disponible" : "Video will be available soon"}
                    </p>
                  </div>
                </>
              )}
              <Badge className="absolute bottom-3 end-3 bg-black/70 text-white border-0">
                <Clock className="h-3 w-3 me-1" />
                {selectedVideo.duration}
              </Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-xl sm:text-2xl font-bold leading-snug">{localizedText(selectedVideo.title)}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{selectedVideo.views.toLocaleString()} {t("videos.views")}</span>
                <span className="flex items-center gap-1"><ThumbsUp className="h-4 w-4" />{selectedVideo.likes.toLocaleString()}</span>
                <span>{selectedVideo.publishedDate}</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{localizedText(selectedVideo.description)}</p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <CardHeader className="pb-2"><h3 className="font-semibold">{t("videos.relatedVideos")}</h3></CardHeader>
            <div className="space-y-3">
              {relatedVideos.map((video) => (
                <Card key={video.id} className="cursor-pointer hover:shadow-md transition-all overflow-hidden" onClick={() => handleVideoClick(video)}>
                  <CardContent className="p-0">
                    <div className="flex gap-3">
                      <div className={`relative w-32 sm:w-40 shrink-0 bg-gradient-to-br ${video.gradient}`}>
                        {video.image && <img src={video.image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {!canAccessContentById(userWithSub, 'videos', video.id, video.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) ? (
                            <Lock className="h-8 w-8 text-white/50" />
                          ) : (
                            <Play className="h-8 w-8 text-white/50 fill-white/50" />
                          )}
                        </div>
                        <Badge className="absolute bottom-2 end-2 text-[10px] bg-black/70 text-white border-0 px-1.5 py-0">{video.duration}</Badge>
                      </div>
                      <div className="py-2 pe-3 flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2 leading-snug">{localizedText(video.title)}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Eye className="h-3 w-3" />{video.views.toLocaleString()} {t("videos.views")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    ) : (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">{t("videos.title")}</h1>
          <p className="text-muted-foreground text-base max-w-2xl">{t("videos.description")}</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search") + "..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="ps-10" />
        </div>

        <AnimatePresence mode="wait">
          {filteredVideos.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
              <Video className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">{t("common.noResults")}</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((video, index) => (
                <motion.div key={video.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  <Card className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 h-full flex flex-col" onClick={() => handleVideoClick(video)}>
                    <div className={`relative aspect-video bg-gradient-to-br ${video.gradient} overflow-hidden`}>
                      {video.image && <img src={video.image} alt={localizedText(video.title)} className="absolute inset-0 h-full w-full object-cover" />}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          {!canAccessContentById(userWithSub, 'videos', video.id, video.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) ? <Lock className="h-6 w-6 text-muted-foreground" /> : <Play className="h-6 w-6 text-primary fill-primary ms-0.5" />}
                        </div>
                      </div>
                      <Badge className="absolute bottom-2 end-2 text-[10px] bg-black/70 text-white border-0"><Clock className="h-3 w-3 me-1" />{video.duration}</Badge>
                      {video.isFree ? (
                        <Badge className="absolute top-2 start-2 text-[10px] bg-emerald-500 border-0">{t("common.free")}</Badge>
                      ) : video.price > 0 ? (
                        <Badge className="absolute top-2 start-2 text-[10px] bg-teal-600 text-white border-0">{video.price.toLocaleString()} {t("common.currency")}</Badge>
                      ) : (
                        <Badge variant="secondary" className="absolute top-2 start-2 text-[10px] bg-white/90 text-foreground border-0">{t("common.paid")}</Badge>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">{localizedText(video.title)}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{localizedText(video.description)}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{video.views.toLocaleString()}</span>
                        <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{video.likes.toLocaleString()}</span>
                        {video.price > 0 && <span className="flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400">{video.price.toLocaleString()} {t("common.currency")}</span>}
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
