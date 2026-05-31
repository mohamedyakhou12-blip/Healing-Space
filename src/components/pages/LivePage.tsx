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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Radio,
  Clock,
  Users,
  Bell,
  BellRing,
  Eye,
  Calendar,
  Play,
  Lock,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { toast } from "sonner";

type SessionStatus = "live" | "upcoming" | "ended";

interface LiveSession {
  id: string;
  title: { ar: string; en: string; fr: string };
  description: { ar: string; en: string; fr: string };
  instructor: { ar: string; en: string; fr: string };
  scheduledAt: Date;
  duration: string;
  status: SessionStatus;
  viewers: number;
  gradient: string;
  category: { ar: string; en: string; fr: string };
  price: number;
  isFree: boolean;
  meetingUrl?: string;
}

const GRADIENTS = [
  "from-red-500 to-rose-600",
  "from-amber-400 to-orange-600",
  "from-violet-400 to-purple-600",
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-cyan-600",
];

const mockSessions: LiveSession[] = [
  {
    id: "live-1",
    title: {
      ar: "ورشة تفاعلية: التعامل مع ضغوط الامتحانات",
      en: "Interactive Workshop: Dealing with Exam Stress",
      fr: "Atelier Interactif: Gérer le Stress des Examens",
    },
    description: {
      ar: "ورشة تفاعلية مباشرة مع د. سارة بن علي حول استراتيجيات التعامل مع ضغوط الامتحانات وتحقيق التركيز الأمثل.",
      en: "A live interactive workshop with Dr. Sara Ben Ali on strategies for dealing with exam stress and achieving optimal focus.",
      fr: "Un atelier interactif en direct avec le Dr. Sara Ben Ali sur les stratégies de gestion du stress des examens.",
    },
    instructor: { ar: "د. سارة بن علي", en: "Dr. Sara Ben Ali", fr: "Dr. Sara Ben Ali" },
    scheduledAt: new Date(Date.now() - 30 * 60 * 1000), // Started 30 min ago
    duration: "90 دقيقة",
    status: "live",
    viewers: 234,
    gradient: "from-red-500 to-rose-600",
    category: { ar: "ورشات تفاعلية", en: "Interactive Workshops", fr: "Ateliers Interactifs" },
    price: 0,
    isFree: true,
  },
  {
    id: "live-2",
    title: {
      ar: "جلسة أسئلة وأجوبة: التحديات النفسية في العلاقات",
      en: "Q&A Session: Psychological Challenges in Relationships",
      fr: "Session Q&R: Défis Psychologiques dans les Relations",
    },
    description: {
      ar: "جلسة بث مباشر مفتوحة للأسئلة والأجوبة مع د. محمد أمين حول التحديات النفسية في العلاقات العاطفية.",
      en: "An open live Q&A session with Dr. Mohamed Amine about psychological challenges in romantic relationships.",
      fr: "Une session de questions-réponses en direct avec le Dr. Mohamed Amine sur les défis psychologiques dans les relations.",
    },
    instructor: { ar: "د. محمد أمين", en: "Dr. Mohamed Amine", fr: "Dr. Mohamed Amine" },
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // In 2 hours
    duration: "60 دقيقة",
    status: "upcoming",
    viewers: 0,
    gradient: "from-amber-400 to-orange-600",
    category: { ar: "جلسات حوارية", en: "Discussion Sessions", fr: "Sessions de Discussion" },
    price: 1500,
    isFree: false,
  },
  {
    id: "live-3",
    title: {
      ar: "جلسة تأمل جماعية مباشرة",
      en: "Live Group Meditation Session",
      fr: "Séance de Méditation de Groupe en Direct",
    },
    description: {
      ar: "جلسة تأمل جماعية مباشرة مدتها 30 دقيقة مع أ. فاطمة الزهراء للاسترخاء والصفاء الذهني.",
      en: "A 30-minute live group meditation session with Ms. Fatima El Zahra for relaxation and mental clarity.",
      fr: "Une séance de méditation de groupe en direct de 30 minutes avec Mme Fatima El Zahra.",
    },
    instructor: { ar: "أ. فاطمة الزهراء", en: "Ms. Fatima El Zahra", fr: "Mme Fatima El Zahra" },
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    duration: "30 دقيقة",
    status: "upcoming",
    viewers: 0,
    gradient: "from-violet-400 to-purple-600",
    category: { ar: "تأمل ويقظة", en: "Meditation & Mindfulness", fr: "Méditation & Pleine Conscience" },
    price: 0,
    isFree: true,
  },
];

function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));

  function getTimeLeft(target: Date) {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const units = [
    { value: timeLeft.days, label: t("live.days") },
    { value: timeLeft.hours, label: t("live.hours") },
    { value: timeLeft.minutes, label: t("live.minutes") },
    { value: timeLeft.seconds, label: t("live.seconds") },
  ];

  return (
    <div className="flex items-center gap-2">
      {units.map((unit, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="bg-muted rounded-md px-2 py-1 text-center min-w-[2.5rem]">
            <span className="text-lg font-bold tabular-nums">{String(unit.value).padStart(2, "0")}</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">{unit.label}</span>
          {i < units.length - 1 && (
            <span className="text-lg font-bold text-muted-foreground me-1">:</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function LivePage() {
  const { t, locale } = useTranslation();
  const { navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const [activeTab, setActiveTab] = useState<string>("live");
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const [apiSessions, setApiSessions] = useState<LiveSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasedContentIds, setPurchasedContentIds] = useState<string[]>([]);
  const [selectedLockedItem, setSelectedLockedItem] = useState<LiveSession | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  // Fetch user purchases
  useEffect(() => {
    if (!userWithSub) return;
    fetch(`/api/user-access`)
      .then(res => res.json())
      .then(data => {
        if (data.purchasedContentIds) {
          setPurchasedContentIds(data.purchasedContentIds);
        }
      })
      .catch(() => {});
  }, [userWithSub]);

  // Fetch live sessions from API
  useEffect(() => {
    cachedFetch<any>('/api/live', 60_000)
      .then(data => {
        const sessions = (data.liveSessions || [])
          .filter((s: any) => s.status === 'published' || s.status === 'live' || s.status === 'upcoming' || s.status === 'ended')
          .map((s: any, i: number) => ({
            id: s.id,
            title: { ar: s.titleAr || s.title, en: s.titleEn || s.title, fr: s.titleFr || s.title },
            description: { ar: s.descriptionAr || s.description, en: s.descriptionEn || s.description, fr: s.descriptionFr || s.description },
            instructor: { ar: s.instructor || s.author || "", en: s.instructor || s.author || "", fr: s.instructor || s.author || "" },
            scheduledAt: s.scheduledAt ? new Date(s.scheduledAt) : s.createdAt ? new Date(s.createdAt) : new Date(),
            duration: s.duration || "",
            status: (s.status === 'live' ? 'live' : s.status === 'upcoming' ? 'upcoming' : s.status === 'ended' ? 'ended' : 'upcoming') as SessionStatus,
            viewers: s.viewers || 0,
            gradient: GRADIENTS[i % GRADIENTS.length],
            category: { ar: s.category || "", en: s.category || "", fr: s.category || "" },
            price: s.price || 0,
            isFree: s.isFree || false,
            meetingUrl: s.meetingUrl || s.videoUrl || "",
          }))
        if (sessions.length > 0) setApiSessions(sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const localizedText = (obj: { ar: string; en: string; fr: string }) =>
    obj[locale] || obj.ar;

  const displaySessions = apiSessions || mockSessions;

  const sessionsByTab = useMemo(() => {
    const liveSessions = displaySessions.filter((s) => s.status === "live");
    const upcomingSessions = displaySessions.filter((s) => s.status === "upcoming");
    const endedSessions = displaySessions.filter((s) => s.status === "ended");
    return { live: liveSessions, upcoming: upcomingSessions, ended: endedSessions };
  }, [displaySessions]);

  const toggleReminder = (sessionId: string) => {
    setReminders((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case "live":
        return (
          <Badge className="bg-red-500 border-0 animate-pulse flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            {t("live.liveNow")}
          </Badge>
        );
      case "upcoming":
        return (
          <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
            {t("live.upcoming")}
          </Badge>
        );
      case "ended":
        return (
          <Badge variant="secondary">
            {t("live.ended")}
          </Badge>
        );
    }
  };

  const SessionCard = ({ session }: { session: LiveSession }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-300">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row">
            {/* Left/Start: Image area */}
            <div className={`relative h-40 sm:h-auto sm:w-48 shrink-0 bg-gradient-to-br ${session.gradient} flex items-center justify-center p-6`}>
              {!canAccessContentById(userWithSub, 'live', session.id, session.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                  <Lock className="h-8 w-8 text-white" />
                </div>
              )}
              <Radio className="h-12 w-12 text-white/40" />
              {session.status === "live" && (
                <div className="absolute top-3 start-3">
                  {getStatusBadge("live")}
                </div>
              )}
              <Badge className="absolute bottom-3 start-3 bg-white/20 text-white border-0 text-[10px]">
                {localizedText(session.category)}
              </Badge>
              {!session.isFree && session.price > 0 && (
                <Badge className="absolute top-3 end-3 bg-teal-600 text-white border-0 text-[10px]">
                  {session.price.toLocaleString()} {t("common.currency")}
                </Badge>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-lg leading-snug flex-1 min-w-0 line-clamp-2">
                  {localizedText(session.title)}
                </h3>
                {session.status !== "live" && getStatusBadge(session.status)}
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {localizedText(session.description)}
              </p>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {localizedText(session.instructor)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {session.duration}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {session.scheduledAt.toLocaleDateString(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US", {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Viewers for live */}
              {session.status === "live" && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1 text-red-500">
                    <Eye className="h-4 w-4" />
                    <span className="font-medium">{session.viewers}</span>
                    <span className="text-muted-foreground text-xs">{t("live.viewers")}</span>
                  </div>
                </div>
              )}

              {/* Countdown for upcoming */}
              {session.status === "upcoming" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t("live.countdownTitle")}</p>
                  <CountdownTimer targetDate={session.scheduledAt} />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-1">
                {session.price > 0 && (session.status === "live" || session.status === "upcoming") && (
                  <div className="mb-2">
                    <span className="font-bold text-teal-600 dark:text-teal-400">{session.price.toLocaleString()} {t("common.currency")}</span>
                  </div>
                )}
                {session.status === "live" && (
                  !canAccessContentById(userWithSub, 'live', session.id, session.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) ? (
                    individualPurchasesEnabled && session.price > 0 ? (
                      <Button className="gap-2" onClick={() => { setSelectedLockedItem(session); setPurchaseDialogOpen(true); }}>
                        <Lock className="h-4 w-4" />
                        {t("common.buyNow")} - {session.price.toLocaleString()} {t("common.currency")}
                      </Button>
                    ) : (
                      <Button className="gap-2" variant="secondary" onClick={() => navigate("subscriptions")}>
                        <Lock className="h-4 w-4" />
                        {t("common.subscribeToAccess")}
                      </Button>
                    )
                  ) : (
                    <Button className="gap-2" onClick={() => {
                      if (session.meetingUrl) {
                        window.open(session.meetingUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        toast.info(
                          locale === "ar" ? "البث المباشر سيكون متاحاً قريباً. ترقبوا الجلسة!" : locale === "fr" ? "Le direct sera bientôt disponible. Restez à l'écoute!" : "Live stream will be available soon. Stay tuned!",
                          { duration: 5000 }
                        );
                      }
                    }}>
                      <Play className="h-4 w-4 fill-current" />
                      {t("live.watchLive")}
                    </Button>
                  )
                )}
                {session.status === "upcoming" && (
                  !canAccessContentById(userWithSub, 'live', session.id, session.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems) ? (
                    individualPurchasesEnabled && session.price > 0 ? (
                      <Button className="gap-2" onClick={() => { setSelectedLockedItem(session); setPurchaseDialogOpen(true); }}>
                        <Lock className="h-4 w-4" />
                        {t("common.buyNow")} - {session.price.toLocaleString()} {t("common.currency")}
                      </Button>
                    ) : (
                      <Button className="gap-2" variant="secondary" onClick={() => navigate("subscriptions")}>
                        <Lock className="h-4 w-4" />
                        {t("common.subscribeToAccess")}
                      </Button>
                    )
                  ) : (
                    <Button
                      variant={reminders.has(session.id) ? "secondary" : "outline"}
                      className="gap-2"
                      onClick={() => {
                        toggleReminder(session.id);
                        if (!reminders.has(session.id)) {
                          toast.success(
                            locale === "ar" ? "سيتم تذكيرك عند بدء الجلسة" : locale === "fr" ? "Vous serez rappelé au début de la session" : "You will be reminded when the session starts",
                            { duration: 3000 }
                          );
                        }
                      }}
                    >
                      {reminders.has(session.id) ? (
                        <>
                          <BellRing className="h-4 w-4" />
                          {t("live.reminderSet")}
                        </>
                      ) : (
                        <>
                          <Bell className="h-4 w-4" />
                          {t("live.setReminder")}
                        </>
                      )}
                    </Button>
                  )
                )}
                {session.status === "ended" && (
                  <Button variant="outline" className="gap-2" disabled>
                    {t("live.ended")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto"
      >
        <div className="space-y-2">
          <div className="h-10 w-64 bg-muted animate-pulse rounded" />
          <div className="h-5 w-96 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border bg-card p-0">
              <div className="flex items-stretch">
                <div className="w-48 bg-muted shrink-0" />
                <div className="flex-1 p-5 space-y-2">
                  <div className="h-5 w-3/4 bg-muted rounded" />
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-4 w-1/2 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto"
    >
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl md:text-4xl font-bold">{t("live.title")}</h1>
          {sessionsByTab.live.length > 0 && (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            </motion.div>
          )}
        </div>
        <p className="text-muted-foreground text-base max-w-2xl">{t("live.description")}</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="live" className="gap-1.5 relative">
            {t("live.liveNow")}
            {sessionsByTab.live.length > 0 && (
              <span className="absolute -top-1 -end-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white items-center justify-center font-bold">
                  {sessionsByTab.live.length}
                </span>
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5">
            {t("live.upcoming")}
          </TabsTrigger>
          <TabsTrigger value="ended" className="gap-1.5">
            {t("live.ended")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          {sessionsByTab.live.length === 0 ? (
            <div className="text-center py-16">
              <Radio className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">{t("live.noLive")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessionsByTab.live.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming">
          {sessionsByTab.upcoming.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">{t("common.noResults")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessionsByTab.upcoming.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ended">
          {sessionsByTab.ended.length === 0 ? (
            <div className="text-center py-16">
              <Radio className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">{t("common.noResults")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessionsByTab.ended.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Purchase Dialog for locked content */}
      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        itemTitle={selectedLockedItem ? localizedText(selectedLockedItem.title) : ""}
        itemPrice={selectedLockedItem?.price || 0}
        contentId={selectedLockedItem?.id || ""}
        contentType="live"
        contentTitleAr={selectedLockedItem?.title.ar || ""}
      />
    </motion.div>
  );
}
