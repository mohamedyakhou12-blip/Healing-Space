"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { useUserWithFreshSubscription } from "@/hooks/useSubscription";
import { canAccessContentById } from "@/lib/content-access";
import { cachedFetch } from "@/lib/client-cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Headphones,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Clock,
  Mic,
  Lock,
  Music,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { toast } from "sonner";

interface PodcastEpisode {
  id: string;
  episodeNumber: number;
  title: { ar: string; en: string; fr: string };
  description: { ar: string; en: string; fr: string };
  duration: string;
  durationSeconds: number;
  guest: { ar: string; en: string; fr: string };
  date: string;
  isFree: boolean;
  price: number;
  gradient: string;
  audioUrl?: string;
}

const GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-amber-400 to-orange-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-cyan-600",
];

const mockEpisodes: PodcastEpisode[] = [
  {
    id: "pod-1",
    episodeNumber: 1,
    title: {
      ar: "فن التواصل الفعال في العلاقات",
      en: "The Art of Effective Communication in Relationships",
      fr: "L'Art de la Communication Efficace dans les Relations",
    },
    description: {
      ar: "في هذه الحلقة، نستضيف د. سارة بن علي لمناقشة أساسيات التواصل الفعال وكيفية تحسين جودة علاقاتنا من خلال الاستماع النشط والتعبير الواضح عن المشاعر.",
      en: "In this episode, we host Dr. Sara Ben Ali to discuss the basics of effective communication and how to improve our relationships through active listening and clear expression of feelings.",
      fr: "Dans cet épisode, nous recevons le Dr. Sara Ben Ali pour discuter des bases de la communication efficace.",
    },
    duration: "45:30",
    durationSeconds: 2730,
    guest: { ar: "د. سارة بن علي", en: "Dr. Sara Ben Ali", fr: "Dr. Sara Ben Ali" },
    date: "2025-01-10",
    isFree: true,
    price: 0,
    gradient: "from-emerald-400 to-teal-600",
  },
  {
    id: "pod-2",
    episodeNumber: 2,
    title: {
      ar: "التعافي من الصدمات النفسية",
      en: "Recovering from Psychological Trauma",
      fr: "Se Remettre des Traumatismes Psychologiques",
    },
    description: {
      ar: "حلقة خاصة حول التعافي من الصدمات النفسية مع د. خالد مراد، نتحدث عن مراحل التعافي والدعم المتاح.",
      en: "A special episode on recovering from psychological trauma with Dr. Khaled Mourad, discussing recovery stages and available support.",
      fr: "Un épisode spécial sur la récupération des traumatismes psychologiques avec le Dr. Khaled Mourad.",
    },
    duration: "52:15",
    durationSeconds: 3135,
    guest: { ar: "د. خالد مراد", en: "Dr. Khaled Mourad", fr: "Dr. Khaled Mourad" },
    date: "2025-02-05",
    isFree: true,
    price: 0,
    gradient: "from-amber-400 to-orange-600",
  },
  {
    id: "pod-3",
    episodeNumber: 3,
    title: {
      ar: "اليقظة الذهنية للمبتدئين",
      en: "Mindfulness for Beginners",
      fr: "Pleine Conscience pour Débutants",
    },
    description: {
      ar: "دليل عملي للمبتدئين في اليقظة الذهنية مع أ. فاطمة الزهراء، تعلم التأمل خطوة بخطوة.",
      en: "A practical beginner's guide to mindfulness with Ms. Fatima El Zahra, learn meditation step by step.",
      fr: "Un guide pratique pour débutants en pleine conscience avec Mme Fatima El Zahra.",
    },
    duration: "38:00",
    durationSeconds: 2280,
    guest: { ar: "أ. فاطمة الزهراء", en: "Ms. Fatima El Zahra", fr: "Mme Fatima El Zahra" },
    date: "2025-03-12",
    isFree: false,
    price: 1500,
    gradient: "from-violet-400 to-purple-600",
  },
  {
    id: "pod-4",
    episodeNumber: 4,
    title: {
      ar: "بناء الثقة بالنفس",
      en: "Building Self-Confidence",
      fr: "Construire la Confiance en Soi",
    },
    description: {
      ar: "حلقة ملهمة حول بناء الثقة بالنفس مع د. محمد أمين، استراتيجيات عملية لتطوير ثقتك بنفسك.",
      en: "An inspiring episode on building self-confidence with Dr. Mohamed Amine, practical strategies to develop your confidence.",
      fr: "Un épisode inspirant sur la construction de la confiance en soi avec le Dr. Mohamed Amine.",
    },
    duration: "41:45",
    durationSeconds: 2505,
    guest: { ar: "د. محمد أمين", en: "Dr. Mohamed Amine", fr: "Dr. Mohamed Amine" },
    date: "2025-04-01",
    isFree: false,
    price: 1000,
    gradient: "from-rose-400 to-pink-600",
  },
  {
    id: "pod-5",
    episodeNumber: 5,
    title: {
      ar: "التعامل مع القلق في أوقات الأزمات",
      en: "Managing Anxiety During Crisis Times",
      fr: "Gérer l'Anxiété en Période de Crise",
    },
    description: {
      ar: "نصائح متخصصة للتعامل مع القلق في الأوقات الصعبة، مع د. ليلى مراد.",
      en: "Specialized tips for managing anxiety during difficult times, with Dr. Laila Mourad.",
      fr: "Conseils spécialisés pour gérer l'anxiété dans les moments difficiles, avec le Dr. Laila Mourad.",
    },
    duration: "35:20",
    durationSeconds: 2120,
    guest: { ar: "د. ليلى مراد", en: "Dr. Laila Mourad", fr: "Dr. Laila Mourad" },
    date: "2025-04-20",
    isFree: true,
    price: 0,
    gradient: "from-sky-400 to-cyan-600",
  },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Waveform decoration component
function AudioWaveform({ isPlaying, color = "currentColor" }: { isPlaying: boolean; color?: string }) {
  return (
    <div className="flex items-end gap-[2px] h-8">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ backgroundColor: color, opacity: 0.6 }}
          animate={
            isPlaying
              ? {
                  height: [4, 8 + Math.random() * 24, 4],
                }
              : { height: [4, 4] }
          }
          transition={
            isPlaying
              ? {
                  duration: 0.8 + Math.random() * 0.5,
                  repeat: Infinity,
                  delay: i * 0.05,
                  ease: "easeInOut",
                }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}

export default function PodcastsPage() {
  const { t, locale } = useTranslation();
  const { navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [apiEpisodes, setApiEpisodes] = useState<PodcastEpisode[] | null>(null);
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
    cachedFetch<any>('/api/podcasts', 60_000)
      .then(data => {
        const episodes = (data.podcasts || [])
          .filter((p: any) => p.status === 'published')
          .map((p: any, i: number) => ({
            id: p.id,
            episodeNumber: p.episodeNumber || (i + 1),
            title: { ar: p.titleAr || p.title, en: p.titleEn || p.title, fr: p.titleFr || p.title },
            description: { ar: p.descriptionAr || p.description, en: p.descriptionEn || p.description, fr: p.descriptionFr || p.description },
            duration: p.duration || "",
            durationSeconds: p.durationSeconds || 0,
            guest: { ar: p.guest || p.author || "", en: p.guest || p.author || "", fr: p.guest || p.author || "" },
            date: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : "",
            isFree: p.isFree || false,
            price: p.price || 0,
            gradient: GRADIENTS[i % GRADIENTS.length],
          }));
        if (episodes.length > 0) setApiEpisodes(episodes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayEpisodes = apiEpisodes || mockEpisodes;

  const localizedText = (obj: { ar: string; en: string; fr: string }) =>
    obj[locale] || obj.ar;

  const activeEpisode = useMemo(
    () => displayEpisodes.find((e) => e.id === playingEpisode),
    [playingEpisode, displayEpisodes]
  );

  const openPurchaseDialog = (episode: PodcastEpisode) => {
    setSelectedLockedItem({
      id: episode.id,
      title: localizedText(episode.title),
      titleAr: episode.title.ar,
      price: episode.price,
      contentType: "podcasts",
    });
    setPurchaseDialogOpen(true);
  };

  const handlePlayPause = (episode: PodcastEpisode) => {
    if (!canAccessContentById(userWithSub, 'podcasts', episode.id, episode.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems)) {
      if (individualPurchasesEnabled) {
        openPurchaseDialog(episode);
      }
      return;
    }

    if (!episode.audioUrl) {
      toast.info(locale === "ar" ? "هذه الحلقة غير متاحة حالياً" : locale === "fr" ? "Cet épisode n'est pas encore disponible" : "This episode is not available yet");
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (playingEpisode === episode.id && isPlaying) {
      setIsPlaying(false);
    } else {
      audioRef.current = new Audio(episode.audioUrl);
      audioRef.current.ontimeupdate = () => {
        setCurrentTime(audioRef.current!.currentTime);
      };
      audioRef.current.ondurationchange = () => {
        setAudioDuration(audioRef.current!.duration);
      };
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      audioRef.current.play().catch(() => {
        toast.info(locale === "ar" ? "هذه الحلقة غير متاحة حالياً" : locale === "fr" ? "Cet épisode n'est pas encore disponible" : "This episode is not available yet");
      });
      setIsPlaying(true);
      setPlayingEpisode(episode.id);
      setCurrentTime(0);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current && audioDuration > 0) {
      audioRef.current.currentTime = value[0] * audioDuration;
      setCurrentTime(value[0] * audioDuration);
    } else if (activeEpisode) {
      setCurrentTime(value[0] * activeEpisode.durationSeconds);
    }
  };

  const progress = activeEpisode
    ? (audioDuration > 0 ? currentTime / audioDuration : currentTime / (activeEpisode.durationSeconds || 1))
    : 0;

  return (
    <>
    <PurchaseDialog
      open={purchaseDialogOpen}
      onOpenChange={setPurchaseDialogOpen}
      itemTitle={selectedLockedItem?.title || ""}
      itemPrice={selectedLockedItem?.price || 0}
      contentId={selectedLockedItem?.id || ""}
      contentType={selectedLockedItem?.contentType || "podcasts"}
      contentTitleAr={selectedLockedItem?.titleAr || ""}
    />

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">{t("podcasts.title")}</h1>
        <p className="text-muted-foreground text-base max-w-2xl">{t("podcasts.description")}</p>
      </div>

      {/* Episodes List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border bg-card p-0">
              <div className="flex items-stretch">
                <div className="w-16 sm:w-24 bg-muted shrink-0" />
                <div className="flex-1 p-4 sm:p-5 space-y-2">
                  <div className="h-4 w-1/3 bg-muted rounded" />
                  <div className="h-5 w-3/4 bg-muted rounded" />
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="space-y-4">
        {displayEpisodes.map((episode, index) => (
          <motion.div
            key={episode.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <Card
              className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${
                playingEpisode === episode.id
                  ? "ring-2 ring-primary/50 shadow-lg"
                  : ""
              }`}
            >
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  {/* Left/Start side: Episode number + play button */}
                  <div className={`relative flex flex-col items-center justify-center w-16 sm:w-24 shrink-0 bg-gradient-to-br ${episode.gradient} p-4`}>
                    {!canAccessContentById(userWithSub, 'podcasts', episode.id, episode.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                        <Lock className="h-8 w-8 text-white" />
                      </div>
                    )}
                    <span className="text-white/60 text-xs font-medium mb-1">
                      {t("podcasts.episode")} {episode.episodeNumber}
                    </span>
                    <button
                      className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors backdrop-blur-sm"
                      onClick={() => handlePlayPause(episode)}
                      aria-label={isPlaying && playingEpisode === episode.id ? t("podcasts.pause") : t("podcasts.play")}
                    >
                      {!canAccessContentById(userWithSub, 'podcasts', episode.id, episode.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) ? (
                        <Lock className="h-5 w-5 text-white/80" />
                      ) : isPlaying && playingEpisode === episode.id ? (
                        <Pause className="h-5 w-5 text-white fill-white" />
                      ) : (
                        <Play className="h-5 w-5 text-white fill-white ms-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {!episode.isFree && episode.price > 0 && (
                            <Badge className="text-xs shrink-0 bg-teal-600 text-white border-0">
                              {episode.price.toLocaleString()} {t("common.currency")}
                            </Badge>
                          )}
                          {!episode.isFree && episode.price === 0 && (
                            <Badge variant="outline" className="text-xs shrink-0">
                              {t("common.paid")}
                            </Badge>
                          )}
                          {playingEpisode === episode.id && isPlaying && (
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                            >
                              <Badge className="bg-primary shrink-0 flex items-center gap-1">
                                <Music className="h-3 w-3" />
                                {t("podcasts.nowPlaying")}
                              </Badge>
                            </motion.div>
                          )}
                        </div>
                        <h3 className="font-semibold text-base sm:text-lg leading-snug mb-1.5 line-clamp-2">
                          {localizedText(episode.title)}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {localizedText(episode.description)}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mic className="h-3.5 w-3.5" />
                            {localizedText(episode.guest)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {episode.duration}
                          </span>
                        </div>
                      </div>

                      {/* Waveform decoration */}
                      <div className="hidden md:flex items-center shrink-0">
                        <AudioWaveform
                          isPlaying={playingEpisode === episode.id && isPlaying}
                          color={playingEpisode === episode.id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      )}

      {/* Sticky Bottom Audio Player */}
      <AnimatePresence>
        {activeEpisode && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-background border-t shadow-2xl"
          >
            {/* Progress bar (thin line at top of player) */}
            <div className="h-1 bg-muted relative">
              <motion.div
                className="absolute inset-y-0 start-0 bg-primary"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className="max-w-7xl mx-auto p-3 sm:p-4 flex items-center gap-4">
              {/* Episode Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${activeEpisode.gradient} flex items-center justify-center shrink-0`}>
                    <Headphones className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{localizedText(activeEpisode.title)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("podcasts.episode")} {activeEpisode.episodeNumber} • {localizedText(activeEpisode.guest)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                  aria-label="Previous"
                >
                  <SkipBack className="h-4 w-4" />
                </button>

                <button
                  className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-colors"
                  onClick={() => {
                    if (isPlaying) {
                      audioRef.current?.pause();
                      setIsPlaying(false);
                    } else {
                      audioRef.current?.play();
                      setIsPlaying(true);
                    }
                  }}
                  aria-label={isPlaying ? t("podcasts.pause") : t("podcasts.play")}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current ms-0.5" />
                  )}
                </button>

                <button
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                  aria-label="Next"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>

              {/* Time + Seek */}
              <div className="hidden sm:flex flex-col gap-1 flex-1 max-w-xs">
                <Slider
                  value={[progress]}
                  max={1}
                  step={0.001}
                  onValueChange={handleSeek}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{audioDuration > 0 ? formatTime(audioDuration) : activeEpisode.duration}</span>
                </div>
              </div>

              {/* Volume */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                  onClick={() => {
                    setIsMuted(!isMuted);
                    if (audioRef.current) {
                      audioRef.current.muted = !isMuted;
                    }
                  }}
                  aria-label={t("podcasts.volume")}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={100}
                  step={1}
                  onValueChange={(v) => {
                    setVolume(v[0]);
                    setIsMuted(v[0] === 0);
                    if (audioRef.current) {
                      audioRef.current.volume = v[0] / 100;
                    }
                  }}
                  className="w-20"
                />
              </div>

              {/* Close player button */}
              <button
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                  }
                  setPlayingEpisode(null);
                  setIsPlaying(false);
                  setCurrentTime(0);
                  setAudioDuration(0);
                }}
                aria-label={t("common.close")}
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
}
