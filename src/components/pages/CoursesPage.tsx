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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  Clock,
  Users,
  Star,
  Search,
  ArrowRight,
  ArrowLeft,
  Lock,
  CheckCircle2,
  Play,
  Award,
  ChevronRight,
} from "lucide-react";
import { PurchaseDialog } from "@/components/PurchaseDialog";
import { getOptimizedImageUrl } from "@/lib/cloudinary-utils";
import Link from "next/link";

interface Lesson {
  id: string;
  title: { ar: string; en: string; fr: string };
  duration: string;
  isFree: boolean;
  isCompleted: boolean;
}

interface Chapter {
  id: string;
  title: { ar: string; en: string; fr: string };
  lessons: Lesson[];
}

interface Course {
  id: string;
  title: { ar: string; en: string; fr: string };
  description: { ar: string; en: string; fr: string };
  instructor: { ar: string; en: string; fr: string };
  image: string;
  gradient: string;
  chapters: Chapter[];
  totalLessons: number;
  totalDuration: string;
  students: number;
  rating: number;
  isFree: boolean;
  enrolled: boolean;
  progress: number;
  price: number;
}


const GRADIENTS = [
  "from-healing-beige to-healing-brown",
  "from-amber-400 to-orange-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-sky-400 to-healing-sand",
];

export default function CoursesPage() {
  const { t, locale } = useTranslation();
  const { pageParams, navigate } = useAppStore();
  const individualPurchasesEnabled = useAppStore((s) => s.individualPurchasesEnabled);
  const { user: userWithSub, activePlans, fullPlanIncludes, fullPlanExcludedItems } = useUserWithFreshSubscription();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "free" | "paid">("all");
  const [apiCourses, setApiCourses] = useState<Course[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasedContentIds, setPurchasedContentIds] = useState<string[]>([]);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedCourseForPurchase, setSelectedCourseForPurchase] = useState<Course | null>(null);
  const [courseReviews, setCourseReviews] = useState<Array<{ id: string; name: string; rating: number; comment: string }>>([]);

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

  useEffect(() => {
    cachedFetch<any>('/api/courses', 60_000)
      .then(data => {
        const courses = (data.courses || [])
          .filter((c: any) => c.status === 'published')
          .map((c: any, i: number) => ({
            id: c.id,
            title: { ar: c.titleAr || c.title, en: c.titleEn || c.title, fr: c.titleFr || c.title },
            description: { ar: c.descriptionAr || c.description, en: c.descriptionEn || c.description, fr: c.descriptionFr || c.description },
            instructor: { ar: c.instructor || "", en: c.instructor || "", fr: c.instructor || "" },
            image: c.image || c.thumbnail || "",
            gradient: GRADIENTS[i % GRADIENTS.length],
            chapters: (c.chapters || []).map((ch: any) => ({
              id: ch.id,
              title: { ar: ch.titleAr || ch.title, en: ch.titleEn || ch.title, fr: ch.titleFr || ch.title },
              lessons: (ch.lessons || []).map((l: any) => ({
                id: l.id,
                title: { ar: l.titleAr || l.title, en: l.titleEn || l.title, fr: l.titleFr || l.title },
                duration: l.duration || "",
                isFree: l.isFree || false,
                isCompleted: false,
              })),
            })),
            totalLessons: (c.chapters || []).reduce((acc: number, ch: any) => acc + (ch.lessons || []).length, 0),
            totalDuration: c.duration || "",
            students: 0,
            rating: c.avgRating || 0,
            isFree: c.isFree || false,
            enrolled: false,
            progress: 0,
            price: c.price || 0,
          }));
        setApiCourses(courses);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Compute enrolled dynamically based on current user - NOT baked into state
  const displayCourses = useMemo(() => {
    const base = apiCourses || [];
    return base.map(c => ({
      ...c,
      enrolled: canAccessContentById(userWithSub, 'courses' as any, c.id, c.isFree, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems),
    }));
  }, [apiCourses, userWithSub, purchasedContentIds, activePlans, fullPlanIncludes, fullPlanExcludedItems]);

  const courseId = pageParams?.courseId as string | undefined;
  const selectedCourse = courseId
    ? displayCourses.find((c) => c.id === courseId)
    : null;

  // Fetch real reviews for the selected course detail
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    fetch(`/api/reviews?contentType=course&contentId=${encodeURIComponent(courseId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setCourseReviews((data.reviews || []).map((r: any) => ({
          id: r.id,
          name: r.user?.name || "",
          rating: r.rating || 0,
          comment: r.comment || "",
        })));
      })
      .catch(() => { if (!cancelled) setCourseReviews([]); });
    return () => { cancelled = true; };
  }, [courseId]);

  const filteredCourses = useMemo(() => {
    return displayCourses.filter((course) => {
      const title = course.title[locale] || course.title.ar;
      const matchesSearch =
        !searchQuery || title.includes(searchQuery);
      const matchesFilter =
        filterType === "all" ||
        (filterType === "free" && course.isFree) ||
        (filterType === "paid" && !course.isFree);
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filterType, locale, displayCourses]);

  const localizedText = (obj: { ar: string; en: string; fr: string }) =>
    obj[locale] || obj.ar;

  const ArrowIcon = locale === "ar" ? ArrowLeft : ArrowRight;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
      >
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
  if (selectedCourse) {
    const course = selectedCourse;
    const totalCompleted = course.chapters.reduce(
      (acc, ch) => acc + ch.lessons.filter((l) => l.isCompleted).length,
      0
    );
    const totalAll = course.chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
      >
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate("courses")}
          className="gap-2"
        >
          <ArrowIcon className="h-4 w-4" />
          {t("courses.backToCourses")}
        </Button>

        {/* Course Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Image */}
            <div
              className={`relative h-48 sm:h-64 md:h-80 rounded-2xl bg-gradient-to-br ${course.gradient} overflow-hidden`}
            >
              <div className="absolute inset-0 bg-black/20 flex items-end p-6">
                <div className="text-white">
                  {course.isFree && (
                    <Badge className="bg-healing-brown mb-2">
                      {t("common.free")}
                    </Badge>
                  )}
                  {!course.isFree && course.price > 0 && (
                    <Badge className="bg-healing-brown text-white border-0 mb-2">
                      {course.price.toLocaleString()} {t("common.currency")}
                    </Badge>
                  )}
                  {!course.isFree && course.price === 0 && (
                    <Badge variant="secondary" className="bg-white/20 text-white border-0 mb-2">
                      {t("common.paid")}
                    </Badge>
                  )}
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
                    {localizedText(course.title)}
                  </h1>
                </div>
              </div>
              <BookOpen className="absolute top-6 end-6 h-16 w-16 text-white/20" />
            </div>

            {/* Course Info */}
            <div className="space-y-4">
              <p className="text-muted-foreground text-base leading-relaxed">
                {localizedText(course.description)}
              </p>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>{course.students} {t("courses.students")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>{course.rating}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{course.totalDuration}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  <span>{course.chapters.length} {t("courses.chapters")} - {course.totalLessons} {t("courses.lessons")}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold text-sm">
                    {localizedText(course.instructor).charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{t("courses.instructor")}</p>
                  <p className="text-sm text-muted-foreground">{localizedText(course.instructor)}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Curriculum */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {t("courses.curriculum")}
              </h2>
              <Accordion type="multiple" className="space-y-3">
                {course.chapters.map((chapter) => (
                  <AccordionItem
                    key={chapter.id}
                    value={chapter.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="text-right hover:no-underline">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 text-start">
                          <span className="font-medium">{localizedText(chapter.title)}</span>
                          <span className="text-sm text-muted-foreground ms-2">
                            {chapter.lessons.length} {t("courses.lessons")}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pb-2">
                        {chapter.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            {lesson.isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-healing-brown shrink-0" />
                            ) : (
                              <Play className="h-5 w-5 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">
                                  {localizedText(lesson.title)}
                                </p>
                                {!lesson.isFree && !course.enrolled && (
                                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                <Clock className="h-3 w-3" />
                                {lesson.duration}
                                {lesson.isFree && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    {t("common.free")}
                                  </Badge>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <Separator />

            {/* Reviews Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                {t("reviews.title")} ({courseReviews.length})
              </h2>
              {courseReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("reviews.noReviews")}</p>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {courseReviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold text-sm">
                            {(review.name || "؟").charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{review.name || (locale === "ar" ? "مستخدم" : locale === "fr" ? "Utilisateur" : "User")}</p>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i < review.rating
                                    ? "text-amber-500 fill-amber-500"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  {/* Progress Circle */}
                  {course.enrolled && course.progress > 0 && (
                    <div className="flex flex-col items-center gap-3 mb-4">
                      <div className="relative h-28 w-28">
                        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                          <circle
                            cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                            strokeDasharray={`${course.progress * 2.64} ${264 - course.progress * 2.64}`}
                            strokeLinecap="round"
                            className="text-primary"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold">{course.progress}%</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {totalCompleted} / {totalAll} {t("courses.lessons")}
                      </p>
                    </div>
                  )}

                  {/* Price Display */}
                  {!course.isFree && course.price > 0 && (
                    <div className="text-center py-3">
                      <p className="text-sm text-muted-foreground">{t("common.priceLabel")}</p>
                      <p className="text-3xl font-bold text-healing-brown dark:text-healing-beige">{course.price.toLocaleString()} <span className="text-base font-normal">{t("common.currency")}</span></p>
                    </div>
                  )}

                  {/* Action Button */}
                  {!course.isFree && !course.enrolled && (
                    <div className="space-y-3">
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <Lock className="h-4 w-4 shrink-0" />
                          {locale === "ar" ? "هذا المحتوى مدفوع. قم بالاشتراك للوصول إليه." : locale === "fr" ? "Ce contenu est payant. Abonnez-vous pour y accéder." : "This content requires a subscription."}
                        </p>
                      </div>
                      {individualPurchasesEnabled && (
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => {
                            setSelectedCourseForPurchase(course);
                            setPurchaseDialogOpen(true);
                          }}
                        >
                          {t("common.buyNow")}
                        </Button>
                      )}
                    </div>
                  )}
                  {course.enrolled && course.progress < 100 && (
                    <Button className="w-full" size="lg">
                      <Play className="h-4 w-4 me-2" />
                      {t("courses.continue")}
                    </Button>
                  )}
                  {course.enrolled && course.progress === 100 && (
                    <Button className="w-full" size="lg" variant="secondary">
                      <Award className="h-4 w-4 me-2" />
                      {t("courses.certificate")}
                    </Button>
                  )}
                  {course.isFree && !course.enrolled && (
                    <Button className="w-full" size="lg">
                      {t("courses.enroll")}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Course Info Card */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold">{t("courses.totalDuration")}</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t("courses.lessons")}</span>
                      <span className="font-medium text-foreground">{course.totalLessons}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("courses.chapters")}</span>
                      <span className="font-medium text-foreground">{course.chapters.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("courses.students")}</span>
                      <span className="font-medium text-foreground">{course.students}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("common.rating")}</span>
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        {course.rating}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Purchase Dialog */}
        <PurchaseDialog
          open={purchaseDialogOpen}
          onOpenChange={setPurchaseDialogOpen}
          itemTitle={selectedCourseForPurchase ? localizedText(selectedCourseForPurchase.title) : ""}
          itemPrice={selectedCourseForPurchase?.price || 0}
          contentId={selectedCourseForPurchase?.id || ""}
          contentType="courses"
          contentTitleAr={selectedCourseForPurchase?.title.ar || ""}
        />
      </motion.div>
    );
  }

  // Listing View
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">{t("courses.title")}</h1>
        <p className="text-muted-foreground text-base max-w-2xl">{t("courses.description")}</p>
      </div>

      {/* Search & Filter Bar */}
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

      {/* Course Grid */}
      <AnimatePresence mode="wait">
        {filteredCourses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">{t("common.noResults")}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300 h-full"
                  onClick={() => navigate("courses", { courseId: course.id })}
                >
                  {/* Card Image */}
                  <div className={`relative h-40 bg-gradient-to-br ${course.gradient} overflow-hidden`}>
                    {course.image && <img src={getOptimizedImageUrl(course.image, { width: 400, height: 250, quality: "auto:good" })} alt={localizedText(course.title)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                    <BookOpen className="absolute bottom-3 start-3 h-8 w-8 text-white/30" />
                    {course.isFree ? (
                      <Badge className="absolute top-3 start-3 bg-healing-brown border-0">
                        {t("common.free")}
                      </Badge>
                    ) : course.price > 0 ? (
                      <Badge className="absolute top-3 start-3 bg-healing-brown text-white border-0">
                        {course.price.toLocaleString()} {t("common.currency")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="absolute top-3 start-3 bg-white/90 text-foreground border-0">
                        {t("common.paid")}
                      </Badge>
                    )}
                    <div className="absolute top-3 end-3 flex items-center gap-1 bg-black/40 text-white text-xs px-2 py-1 rounded-full">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      {course.rating}
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {localizedText(course.title)}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {localizedText(course.description)}
                    </p>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {course.chapters.length} {t("courses.chapters")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Play className="h-3.5 w-3.5" />
                        {course.totalLessons} {t("courses.lessons")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {course.totalDuration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {course.students}
                      </span>
                      {course.price > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-healing-brown dark:text-healing-beige">
                          {course.price.toLocaleString()} {t("common.currency")}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar (if enrolled) */}
                    {course.enrolled && course.progress > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{t("courses.progress")}</span>
                          <span className="font-medium">{course.progress}%</span>
                        </div>
                        <Progress value={course.progress} className="h-2" />
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="mt-auto pt-2">
                      {!course.isFree && course.price > 0 && !course.enrolled && (
                        <div className="flex items-center justify-between">
                          {individualPurchasesEnabled && (
                            <span className="font-bold text-healing-brown dark:text-healing-beige">{course.price.toLocaleString()} {t("common.currency")}</span>
                          )}
                          {individualPurchasesEnabled && (
                            <Button className="flex-1 ms-3" size="sm" onClick={() => {
                              setSelectedCourseForPurchase(course);
                              setPurchaseDialogOpen(true);
                            }}>
                              {t("common.buyNow")}
                            </Button>
                          )}
                          {!individualPurchasesEnabled && (
                            <Button className="w-full" size="sm" variant="secondary" disabled>
                              <Lock className="h-4 w-4 me-2" />
                              {t("common.subscribeToAccess")}
                            </Button>
                          )}
                        </div>
                      )}
                      {!course.enrolled && course.isFree && (
                        <Button asChild className="w-full" size="sm">
                          <Link href={`/courses/${course.id}`}>
                            {t("courses.enroll")}
                          </Link>
                        </Button>
                      )}
                      {!course.enrolled && !course.isFree && course.price === 0 && (
                        <Button asChild className="w-full" size="sm">
                          <Link href={`/courses/${course.id}`}>
                            {t("courses.enroll")}
                          </Link>
                        </Button>
                      )}
                      {course.enrolled && course.progress < 100 && (
                        <Button asChild className="w-full" size="sm" variant="secondary">
                          <Link href={`/courses/${course.id}`}>
                            {t("courses.continue")}
                          </Link>
                        </Button>
                      )}
                      {course.enrolled && course.progress === 100 && (
                        <Button asChild className="w-full" size="sm" variant="outline">
                          <Link href={`/courses/${course.id}`}>
                            <CheckCircle2 className="h-4 w-4 me-1.5 text-healing-brown" />
                            {t("courses.completed")}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        itemTitle={selectedCourseForPurchase ? localizedText(selectedCourseForPurchase.title) : ""}
        itemPrice={selectedCourseForPurchase?.price || 0}
        contentId={selectedCourseForPurchase?.id || ""}
        contentType="courses"
        contentTitleAr={selectedCourseForPurchase?.title.ar || ""}
      />
    </motion.div>
  );
}
