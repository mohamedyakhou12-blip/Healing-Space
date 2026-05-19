"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore, type Locale } from "@/lib/store";
import { useUserWithFreshSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Mail,
  Phone,
  Camera,
  Pencil,
  BookOpen,
  CreditCard,
  Calendar,
  RefreshCw,
  Clock,
  ShieldCheck,
  XCircle,
  ImageIcon,
  PackageOpen,
  Loader2,
  ShoppingBag,
  FileText,
  Video,
  Headphones,
  FileDown,
  Radio,
} from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Subscription {
  id: string;
  userId: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

interface Payment {
  id: string;
  userId: string;
  subscriptionType?: string;
  contentId?: string;
  contentType?: string;
  contentTitle?: string;
  contentTitleAr?: string;
  amount: number;
  receiptImage: string;
  ccpNumber: string;
  status: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

interface Purchase {
  id: string;
  userId: string;
  contentId: string;
  contentType: string;
  contentTitle?: string;
  contentTitleAr?: string;
  amount: number;
  status: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PLAN_TYPE_NAMES: Record<string, Record<Locale, string>> = {
  full:      { ar: "الوصول الكامل",    en: "Full Access",   fr: "Accès complet" },
  courses:   { ar: "الدورات فقط",      en: "Courses Only",  fr: "Cours uniquement" },
  articles:  { ar: "المقالات فقط",     en: "Articles Only", fr: "Articles uniquement" },
  podcasts:  { ar: "البودكاست فقط",    en: "Podcasts Only", fr: "Podcasts uniquement" },
  videos:    { ar: "الفيديوهات فقط",   en: "Videos Only",   fr: "Vidéos uniquement" },
  pdfs:      { ar: "الكتب الإلكترونية", en: "E-books",       fr: "E-books" },
  live:      { ar: "البث المباشر",     en: "Live",          fr: "En direct" },
};

const CONTENT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  courses: BookOpen,
  articles: FileText,
  podcasts: Headphones,
  videos: Video,
  pdfs: FileDown,
  live: Radio,
};

const CONTENT_TYPE_NAMES: Record<string, Record<Locale, string>> = {
  courses:   { ar: "دورة",     en: "Course",     fr: "Cours" },
  articles:  { ar: "مقال",     en: "Article",    fr: "Article" },
  podcasts:  { ar: "حلقة بودكاست", en: "Podcast",  fr: "Podcast" },
  videos:    { ar: "فيديو",    en: "Video",      fr: "Vidéo" },
  pdfs:      { ar: "كتاب إلكتروني", en: "E-book",  fr: "E-book" },
  live:      { ar: "بث مباشر", en: "Live",       fr: "En direct" },
};

function planName(type: string, locale: Locale): string {
  return PLAN_TYPE_NAMES[type]?.[locale] ?? type;
}

function contentTypeName(type: string, locale: Locale): string {
  return CONTENT_TYPE_NAMES[type]?.[locale] ?? type;
}

const SUB_GRADIENTS: Record<string, string> = {
  full: "from-amber-400 to-orange-600",
  courses: "from-emerald-400 to-teal-600",
  articles: "from-violet-400 to-purple-600",
  podcasts: "from-rose-400 to-pink-600",
  videos: "from-sky-400 to-blue-600",
  pdfs: "from-indigo-400 to-indigo-600",
  live: "from-red-400 to-rose-600",
};

function formatDate(dateStr: string, locale: Locale): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  const { t, locale } = useTranslation();
  const { user, setUser, navigate } = useAppStore();
  const { user: userWithSub, activePlans } = useUserWithFreshSubscription();
  const [purchasedContentIds, setPurchasedContentIds] = useState<string[]>([]);

  /* ---- Auth guard ---- */
  useEffect(() => {
    if (!user) {
      navigate("login");
    }
  }, [user, navigate]);

  // Fetch purchased content IDs
  useEffect(() => {
    if (!user) return;
    fetch(`/api/user-access`)
      .then(res => res.json())
      .then(data => {
        if (data.purchasedContentIds) {
          setPurchasedContentIds(data.purchasedContentIds);
        }
      })
      .catch(() => {});
  }, [user]);

  /* ---- Edit profile state ---- */
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Sync edit fields when dialog opens
  useEffect(() => {
    if (editDialogOpen && user) {
      setEditName(user.name || "");
      setEditPhone(user.phone || "");
    }
  }, [editDialogOpen, user]);

  /* ---- Data fetching ---- */
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    if (!user?.id) return;
    setLoadingSubs(true);
    try {
      const res = await fetch(`/api/subscriptions?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        // SAFETY: Filter by userId to prevent cross-user data leakage
        setSubscriptions((data.subscriptions || []).filter(
          (s: { userId?: string }) => !s.userId || s.userId === user.id
        ));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoadingSubs(false);
    }
  }, [user?.id, t]);

  const fetchPayments = useCallback(async () => {
    if (!user?.id) return;
    setLoadingPayments(true);
    try {
      const [payRes, purRes] = await Promise.all([
        fetch(`/api/payments?_t=${Date.now()}`),
        fetch(`/api/purchases?_t=${Date.now()}`),
      ]);
      const allPayments: Payment[] = [];
      let rawPurchases: any[] = [];

      if (payRes.ok) {
        const payData = await payRes.json();
        allPayments.push(...(payData.payments || []));
      }
      if (purRes.ok) {
        const purData = await purRes.json();
        rawPurchases = purData.purchases || [];
        allPayments.push(...rawPurchases.map((p: any) => ({
          ...p,
          subscriptionType: undefined,
          contentId: p.contentId,
          contentType: p.contentType,
          contentTitle: p.contentTitle,
          contentTitleAr: p.contentTitleAr,
        })));
      }
      // Sort by date descending
      allPayments.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setPayments(allPayments);

      // Store purchases separately for subscriptions tab
      setPurchases(rawPurchases.map((p: any) => ({
        id: p.id,
        userId: p.userId,
        contentId: p.contentId,
        contentType: p.contentType,
        contentTitle: p.contentTitle,
        contentTitleAr: p.contentTitleAr,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
      })));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoadingPayments(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    if (user?.id) {
      fetchSubscriptions();
      fetchPayments();
    }
  }, [user?.id, fetchSubscriptions, fetchPayments]);

  /* ---- Save profile ---- */
  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          name: editName,
          phone: editPhone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser({ ...user, name: data.user.name, phone: data.user.phone });
        setEditDialogOpen(false);
        toast.success(
          locale === "ar"
            ? "تم تحديث الملف الشخصي بنجاح"
            : locale === "fr"
            ? "Profil mis à jour avec succès"
            : "Profile updated successfully"
        );
      } else {
        const err = await res.json();
        toast.error(err.error || t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSavingProfile(false);
    }
  };

  /* ---- Payment status config ---- */
  const paymentStatusConfig = {
    pending: {
      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      icon: Clock,
      label: t("payment.pending"),
    },
    approved: {
      color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      icon: ShieldCheck,
      label: t("payment.approved"),
    },
    rejected: {
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      icon: XCircle,
      label: t("payment.rejected"),
    },
  };

  /* ---- Don't render until auth is resolved ---- */
  if (!user) return null;

  const isRTL = locale === "ar";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto"
    >
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">{t("profile.title")}</h1>
      </div>

      {/* Profile Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative">
            {/* Cover */}
            <div className="h-32 sm:h-40 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />

            {/* Avatar & Info */}
            <div className="px-4 sm:px-6 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14">
                {/* Avatar */}
                <div className="relative">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-background object-cover shadow-xl"
                    />
                  ) : (
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-background bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-xl">
                      <User className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 space-y-1 pb-1">
                  <h2 className="text-xl sm:text-2xl font-bold">{user.name}</h2>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {user.email}
                    </span>
                    {user.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {user.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit Button */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 shrink-0">
                      <Pencil className="h-4 w-4" />
                      {t("profile.editProfile")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t("profile.editProfile")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>{t("auth.name")}</Label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("auth.email")}</Label>
                        <Input
                          type="email"
                          value={user.email}
                          disabled
                          dir="ltr"
                          className="opacity-60"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("auth.phone")}</Label>
                        <Input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          {locale === "ar" ? "الصورة الشخصية" : locale === "fr" ? "Photo de profil" : "Profile Picture"}
                        </Label>
                        <div className="flex items-center gap-3">
                          <Button variant="outline" className="gap-2" disabled>
                            <Camera className="h-4 w-4" />
                            {locale === "ar" ? "تغيير الصورة" : locale === "fr" ? "Changer la photo" : "Change Photo"}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <DialogClose asChild>
                        <Button variant="outline">{t("profile.cancel")}</Button>
                      </DialogClose>
                      <Button onClick={handleSaveProfile} disabled={savingProfile}>
                        {savingProfile && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                        {t("profile.save")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="courses" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="courses" className="gap-2">
            <BookOpen className="h-4 w-4 hidden sm:block" />
            {t("profile.myCourses")}
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-2">
            <CreditCard className="h-4 w-4 hidden sm:block" />
            {t("profile.mySubscriptions")}
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4 hidden sm:block" />
            {t("profile.myPayments")}
          </TabsTrigger>
        </TabsList>

        {/* My Courses Tab */}
        <TabsContent value="courses" className="space-y-4">
          {(() => {
            // Show courses the user has access to (via subscription or individual purchase)
            const hasSubscription = userWithSub?.subscription?.status === "active" &&
              (userWithSub.subscription.plan === "full" || userWithSub.subscription.plan === "courses");
            const hasPurchasedCourses = purchasedContentIds.length > 0;

            if (!hasSubscription && !hasPurchasedCourses) {
              return (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                      <PackageOpen className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">
                      {locale === "ar"
                        ? "لا توجد دورات بعد"
                        : locale === "fr"
                        ? "Aucun cours pour le moment"
                        : "No courses yet"}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {locale === "ar"
                        ? "ستظهر دوراتك هنا بمجرد التسجيل في اشتراك يتضمن الدورات أو شراء دورة فردية. تابع الاشتراكات المتاحة للبدء."
                        : locale === "fr"
                        ? "Vos cours apparaîtront ici dès que vous serez inscrit à un abonnement comprenant des cours ou achèterez un cours individuel. Consultez les abonnements disponibles pour commencer."
                        : "Your courses will appear here once you subscribe to a plan that includes courses or purchase an individual course. Check out available subscriptions to get started."}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" className="gap-2" onClick={() => navigate("subscriptions")}>
                        <CreditCard className="h-4 w-4" />
                        {t("profile.mySubscriptions")}
                      </Button>
                      <Button className="gap-2" onClick={() => navigate("courses")}>
                        {locale === "ar" ? "تصفح الدورات" : locale === "fr" ? "Parcourir les cours" : "Browse Courses"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {hasSubscription && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                        <CreditCard className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                        <div>
                          <p className="font-medium text-teal-700 dark:text-teal-300">
                            {locale === "ar" ? "اشتراك نشط" : locale === "fr" ? "Abonnement actif" : "Active Subscription"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {locale === "ar" ? "لديك وصول كامل لجميع الدورات" : locale === "fr" ? "Vous avez accès à tous les cours" : "You have full access to all courses"}
                          </p>
                        </div>
                      </div>
                    )}
                    {hasPurchasedCourses && purchasedContentIds.length > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <ShoppingBag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="font-medium text-blue-700 dark:text-blue-300">
                            {locale === "ar" ? `دورات مشتراة (${purchasedContentIds.length})` : locale === "fr" ? `Cours achetés (${purchasedContentIds.length})` : `Purchased Courses (${purchasedContentIds.length})`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {locale === "ar" ? "هذه الدورات متاحة لك إلى الأبد" : locale === "fr" ? "Ces cours sont accessibles pour toujours" : "These courses are accessible forever"}
                          </p>
                        </div>
                      </div>
                    )}
                    <Button className="gap-2" onClick={() => navigate("courses")}>
                      {locale === "ar" ? "تصفح الدورات" : locale === "fr" ? "Parcourir les cours" : "Browse Courses"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* My Subscriptions Tab */}
        <TabsContent value="subscriptions" className="space-y-4">
          {/* ── Active Subscriptions ── */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {locale === "ar" ? "الاشتراكات النشطة" : locale === "fr" ? "Abonnements actifs" : "Active Subscriptions"}
            </h3>
            {loadingSubs ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : subscriptions.filter(s => s.status === 'active').length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <PackageOpen className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold">
                  {locale === "ar"
                    ? "لا توجد اشتراكات بعد"
                    : locale === "fr"
                    ? "Aucun abonnement pour le moment"
                    : "No subscriptions yet"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {locale === "ar"
                    ? "لم تشترك في أي خطة بعد. تصفح الاشتراكات المتاحة للوصول إلى المحتوى."
                    : locale === "fr"
                    ? "Vous n'êtes inscrit à aucun plan. Parcourez les abonnements disponibles pour accéder au contenu."
                    : "You haven't subscribed to any plan yet. Browse available subscriptions to access content."}
                </p>
                <Button variant="outline" className="gap-2" onClick={() => navigate("subscriptions")}>
                  <CreditCard className="h-4 w-4" />
                  {t("profile.mySubscriptions")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {subscriptions.filter(s => s.status === 'active').map((sub, index) => {
                const gradient = SUB_GRADIENTS[sub.type] || "from-gray-400 to-gray-600";
                const isActive = sub.status === "active";
                return (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          {/* Left accent */}
                          <div className={`w-full sm:w-2 bg-gradient-to-b ${gradient}`} />
                          <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                            {/* Plan info */}
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold">
                                  {planName(sub.type, locale)}
                                </h3>
                                <Badge
                                  className={
                                    isActive
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0"
                                      : "bg-muted text-muted-foreground border-0"
                                  }
                                >
                                  {isActive
                                    ? (locale === "ar" ? "نشط" : locale === "fr" ? "Actif" : "Active")
                                    : (locale === "ar" ? "منتهي" : locale === "fr" ? "Expiré" : "Expired")}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {locale === "ar" ? "بداية" : locale === "fr" ? "Début" : "Start"}: {formatDate(sub.startDate, locale)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {locale === "ar" ? "انتهاء" : locale === "fr" ? "Fin" : "Ends"}: {formatDate(sub.endDate, locale)}
                                </span>
                              </div>
                            </div>
                            {/* Action Button */}
                            {!isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 shrink-0"
                                onClick={() => navigate("subscriptions")}
                              >
                                <RefreshCw className="h-4 w-4" />
                                {locale === "ar" ? "تجديد" : locale === "fr" ? "Renouveler" : "Renew"}
                              </Button>
                            )}
                            {isActive && (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="gap-2 shrink-0"
                                onClick={() => navigate("subscriptions")}
                              >
                                {locale === "ar" ? "ترقية الخطة" : locale === "fr" ? "Mettre à niveau" : "Upgrade Plan"}
                              </Button>
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
          </div>

          {/* ── Individual Content Purchases ── */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {locale === "ar" ? "المحتوى المشترى" : locale === "fr" ? "Contenu acheté" : "Purchased Content"}
            </h3>
            {purchases.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingBag className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold">
                    {locale === "ar"
                      ? "لم تشترِ أي محتوى بعد"
                      : locale === "fr"
                      ? "Vous n'avez acheté aucun contenu"
                      : "No purchased content yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {locale === "ar"
                      ? "يمكنك شراء محتوى فردي مثل فيديو أو مقال أو دورة واحدة. تصفح المحتوى المتاح."
                      : locale === "fr"
                      ? "Vous pouvez acheter du contenu individuel comme une vidéo, un article ou un cours. Parcourez le contenu disponible."
                      : "You can purchase individual content like a video, article, or single course. Browse available content."}
                  </p>
                  <Button variant="outline" className="gap-2" onClick={() => navigate("home")}>
                    {locale === "ar" ? "تصفح المحتوى" : locale === "fr" ? "Parcourir le contenu" : "Browse Content"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {purchases.map((purchase, index) => {
                  const TypeIcon = CONTENT_TYPE_ICONS[purchase.contentType] || FileText;
                  const statusConfig = purchase.status === 'approved'
                    ? { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: locale === "ar" ? "مفعّل" : locale === "fr" ? "Actif" : "Active" }
                    : purchase.status === 'rejected'
                    ? { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: locale === "ar" ? "مرفوض" : locale === "fr" ? "Rejeté" : "Rejected" }
                    : { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: locale === "ar" ? "قيد المراجعة" : locale === "fr" ? "En attente" : "Pending" };
                  return (
                    <motion.div
                      key={purchase.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                    >
                      <Card className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex flex-col sm:flex-row">
                            <div className="w-full sm:w-2 bg-gradient-to-b from-teal-400 to-emerald-600" />
                            <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shrink-0">
                                <TypeIcon className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <h3 className="font-semibold text-sm">
                                  {(locale === "ar" ? purchase.contentTitleAr : purchase.contentTitle) || purchase.contentTitleAr || contentTypeName(purchase.contentType, locale)}
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{contentTypeName(purchase.contentType, locale)}</span>
                                  <span>•</span>
                                  <span>{formatDate(purchase.createdAt, locale)}</span>
                                  <span>•</span>
                                  <span>{purchase.amount.toLocaleString()} DA</span>
                                </div>
                              </div>
                              <Badge className={`${statusConfig.color} border-0 shrink-0`}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* My Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              {loadingPayments ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-8 w-12 rounded" />
                    </div>
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <PackageOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {locale === "ar"
                      ? "لا توجد مدفوعات بعد"
                      : locale === "fr"
                      ? "Aucun paiement pour le moment"
                      : "No payments yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {locale === "ar"
                      ? "لم تقم بأي عملية دفع بعد. اشترك في خطة للبدء."
                      : locale === "fr"
                      ? "Vous n'avez effectué aucun paiement. Abonnez-vous à un plan pour commencer."
                      : "You haven't made any payments yet. Subscribe to a plan to get started."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-start pb-3 font-medium text-muted-foreground">
                            {locale === "ar" ? "البند" : locale === "fr" ? "Article" : "Item"}
                          </th>
                          <th className="text-start pb-3 font-medium text-muted-foreground">
                            {t("payment.amount")}
                          </th>
                          <th className="text-start pb-3 font-medium text-muted-foreground">
                            {locale === "ar" ? "التاريخ" : locale === "fr" ? "Date" : "Date"}
                          </th>
                          <th className="text-start pb-3 font-medium text-muted-foreground">
                            {locale === "ar" ? "الحالة" : locale === "fr" ? "Statut" : "Status"}
                          </th>
                          <th className="text-start pb-3 font-medium text-muted-foreground">
                            {t("payment.receiptImage")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => {
                          const config = paymentStatusConfig[payment.status as keyof typeof paymentStatusConfig] || paymentStatusConfig.pending;
                          const StatusIcon = config.icon;
                          return (
                            <tr key={payment.id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="py-3 font-medium">{payment.contentId ? ((locale === "ar" ? payment.contentTitleAr : payment.contentTitle) || payment.contentTitleAr || contentTypeName(payment.contentType || "", locale)) : planName(payment.subscriptionType || "full", locale)}</td>
                              <td className="py-3">{payment.amount.toLocaleString()} DA</td>
                              <td className="py-3 text-muted-foreground">{formatDate(payment.createdAt, locale)}</td>
                              <td className="py-3">
                                <Badge className={`${config.color} border-0`}>
                                  <StatusIcon className={`h-3 w-3 ${isRTL ? "me-1" : "ms-1"}`} />
                                  {config.label}
                                </Badge>
                              </td>
                              <td className="py-3">
                                {payment.receiptImage ? (
                                  <a href={payment.receiptImage} target="_blank" rel="noopener noreferrer">
                                    <div className="h-8 w-12 rounded bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors cursor-pointer">
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </a>
                                ) : (
                                  <div className="h-8 w-12 rounded bg-muted flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground">—</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="sm:hidden space-y-3">
                    {payments.map((payment) => {
                      const config = paymentStatusConfig[payment.status as keyof typeof paymentStatusConfig] || paymentStatusConfig.pending;
                      const StatusIcon = config.icon;
                      return (
                        <div key={payment.id} className="flex items-center gap-3 p-3 rounded-lg border">
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="text-sm font-medium truncate">{payment.contentId ? ((locale === "ar" ? payment.contentTitleAr : payment.contentTitle) || payment.contentTitleAr || contentTypeName(payment.contentType || "", locale)) : planName(payment.subscriptionType || "full", locale)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(payment.createdAt, locale)} • {payment.amount.toLocaleString()} DA
                            </p>
                          </div>
                          <Badge className={`${config.color} border-0 shrink-0 text-[10px]`}>
                            <StatusIcon className={`h-3 w-3 ${isRTL ? "me-0.5" : "ms-0.5"}`} />
                            {config.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
