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
import { getOptimizedImageUrl } from "@/lib/cloudinary-utils";

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
  videoUrl: string;
}

const GRADIENTS = [
  "from-healing-beige to-healing-brown",
  "from-amber-400 to-orange-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-healing-sand",
];

const extractYouTubeId = (url: string): string | undefined => {
  if (!url) return undefined;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  return match?.[1];
};


export default function VideosPage() {
  const { t, locale } = useTranslation();
  const { navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "paid">("all");
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
            youtubeId: extractYouTubeId(v.videoUrl) || v.youtubeId || undefined,
            videoUrl: v.videoUrl || "",
          }));
        setApiVideos(videos);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayVideos = apiVideos || [];
  const hasVideoContent = displayVideos.length > 0;

  const filteredVideos = useMemo(() => {
    return displayVideos.filter((video) => {
      const title = video.title[locale] || video.title.ar;
      const matchesSearch = !searchQuery || title.includes(searchQuery);
      const matchesFilter =
        filterType === "all" ||
        (filterType === "free" && video.isFree) ||
        (filterType === "paid" && !video.isFree);
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filterType, locale, displayVideos]);

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
      } else {
        navigate("subscriptions");
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
              {selectedVideo.videoUrl && !selectedVideo.youtubeId ? (
                <video
                  src={selectedVideo.videoUrl}
                  controls
                  autoPlay
                  className="absolute inset-0 h-full w-full object-contain bg-black"
                  preload="metadata"
                />
              ) : selectedVideo.youtubeId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${selectedVideo.youtubeId}?autoplay=1&rel=0`}
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

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative max-w-md flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("common.search") + "..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="ps-10" />
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
                      {video.image && <img src={getOptimizedImageUrl(video.image, { width: 400, height: 225, quality: "auto:good" })} alt={localizedText(video.title)} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          {!canAccessContentById(userWithSub, 'videos', video.id, video.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) ? <Lock className="h-6 w-6 text-muted-foreground" /> : <Play className="h-6 w-6 text-primary fill-primary ms-0.5" />}
                        </div>
                      </div>
                      <Badge className="absolute bottom-2 end-2 text-[10px] bg-black/70 text-white border-0"><Clock className="h-3 w-3 me-1" />{video.duration}</Badge>
                      {video.isFree ? (
                        <Badge className="absolute top-2 start-2 text-[10px] bg-primary border-0">{t("common.free")}</Badge>
                      ) : video.price > 0 ? (
                        <Badge className="absolute top-2 start-2 text-[10px] bg-primary text-white border-0">{video.price.toLocaleString()} {t("common.currency")}</Badge>
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
                        {video.price > 0 && <span className="flex items-center gap-1 font-semibold text-primary">{video.price.toLocaleString()} {t("common.currency")}</span>}
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
