'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Clock, Star, Users, BookOpen, Play, Lock, Loader2, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from "@/lib/store";

type Lesson = {
  id?: string;
  titleAr?: string;
  titleFr?: string;
  titleEn?: string;
  duration?: string;
  isFree?: boolean;
  videoUrl?: string | null;
};

type Chapter = {
  id?: string;
  titleAr?: string;
  titleFr?: string;
  titleEn?: string;
  lessons?: Lesson[];
};

type Course = {
  id: string;
  titleAr?: string;
  titleFr?: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  instructor?: string;
  duration?: string;
  image?: string;
  price?: number;
  isFree?: boolean;
  avgRating?: number;
  reviewCount?: number;
  chapters?: Chapter[];
};

function localize(locale: string, ar?: string | null, fr?: string | null, en?: string | null): string {
  if (locale === "fr") return fr || ar || "";
  if (locale === "en") return en || ar || "";
  return ar || "";
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const locale = useAppStore((s) => s.locale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    fetch(`/api/courses/${encodeURIComponent(id)}`)
      .then((res) => {
        if (res.status === 404) throw new Error("not-found");
        if (!res.ok) throw new Error("server");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const found = (data as { course: Course }).course || null;
        setCourse(found);
        if (!found) setError("not-found");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error && e.message === "not-found" ? "not-found" : "server");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const title = course ? localize(locale, course.titleAr, course.titleFr, course.titleEn) : "";
  const description = course ? localize(locale, course.descriptionAr, course.descriptionFr, course.descriptionEn) : "";
  const chapters = course?.chapters || [];
  const anyLocked = chapters.some((ch) =>
    (ch.lessons || []).some((l) => !l.isFree && !l.videoUrl)
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30 py-8" dir={dir}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/courses"
            className="inline-flex items-center gap-1 text-primary hover:text-accent mb-6"
          >
            <GraduationCap className="h-4 w-4 rtl:rotate-180" />
            {locale === "ar" ? "العودة للدورات" : locale === "fr" ? "Retour aux cours" : "Back to courses"}
          </Link>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {locale === "ar" ? "جاري تحميل الدورة..." : locale === "fr" ? "Chargement du cours..." : "Loading course..."}
              </p>
            </div>
          )}

          {!loading && (error === "not-found" || !id) && (
            <div className="text-center py-20">
              <GraduationCap className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">
                {locale === "ar" ? "الدورة غير موجودة" : locale === "fr" ? "Cours introuvable" : "Course not found"}
              </h1>
              <p className="text-muted-foreground mb-6">
                {locale === "ar" ? "قد تكون الدورة محذوفة أو غير متاحة." : locale === "fr" ? "Ce cours peut avoir été supprimé ou n'est pas disponible." : "This course may have been removed or is unavailable."}
              </p>
              <Link href="/courses">
                <Button variant="outline">
                  {locale === "ar" ? "تصفح الدورات" : locale === "fr" ? "Parcourir les cours" : "Browse courses"}
                </Button>
              </Link>
            </div>
          )}

          {!loading && error === "server" && (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-6">
                {locale === "ar" ? "حدث خطأ أثناء تحميل الدورة. حاول مرة أخرى لاحقاً." : locale === "fr" ? "Une erreur est survenue lors du chargement. Réessayez plus tard." : "An error occurred while loading. Please try again later."}
              </p>
              <Link href="/courses">
                <Button variant="outline">
                  {locale === "ar" ? "العودة للدورات" : locale === "fr" ? "Retour aux cours" : "Back to courses"}
                </Button>
              </Link>
            </div>
          )}

          {!loading && !error && course && (
            <>
              {/* Course Header */}
              <div className="relative overflow-hidden rounded-2xl p-0 text-white mb-8">
                {course.image ? (
                  <img
                    src={course.image}
                    alt={title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary to-stone-700" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                <div className="relative max-w-3xl p-8">
                  <h1 className="text-3xl font-bold mb-4">{title}</h1>
                  <p className="text-stone-100 mb-6 leading-relaxed">{description}</p>
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    {!!course.avgRating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        {course.avgRating}
                        {!!course.reviewCount && ` (${course.reviewCount})`}
                      </div>
                    )}
                    {course.instructor && (
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {course.instructor}
                      </div>
                    )}
                    {course.duration && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {course.duration}
                      </div>
                    )}
                    {chapters.length > 0 && (
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {chapters.length}
                        {" "}
                        {locale === "ar" ? "فصول" : locale === "fr" ? "chapitres" : "chapters"}
                      </div>
                    )}
                  </div>
                  {anyLocked && (
                    <div className="mt-6">
                      <Link href="/subscriptions">
                        <Button className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold">
                          {locale === "ar" ? "اشترك الآن للوصول الكامل" : locale === "fr" ? "Abonnez-vous pour un accès complet" : "Subscribe now for full access"}
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Course Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <h2 className="text-xl font-bold mb-4">
                    {locale === "ar" ? "محتوى الدورة" : locale === "fr" ? "Contenu du cours" : "Course content"}
                  </h2>
                  {chapters.length === 0 ? (
                    <p className="text-muted-foreground">
                      {locale === "ar" ? "لا توجد فصول في هذه الدورة بعد." : locale === "fr" ? "Aucun chapitre dans ce cours pour le moment." : "No chapters in this course yet."}
                    </p>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-3">
                      {chapters.map((chapter, chapterIdx) => {
                        const chapterTitle = localize(locale, chapter.titleAr, chapter.titleFr, chapter.titleEn) ||
                          (locale === "ar" ? `الفصل ${chapterIdx + 1}` : locale === "fr" ? `Chapitre ${chapterIdx + 1}` : `Chapter ${chapterIdx + 1}`);
                        const lessons = chapter.lessons || [];
                        return (
                          <AccordionItem
                            key={chapter.id || `chapter-${chapterIdx}`}
                            value={`chapter-${chapter.id || chapterIdx}`}
                            className="bg-background rounded-lg shadow-sm border border-border px-4"
                          >
                            <AccordionTrigger className="hover:no-underline py-4">
                              <div className="flex items-center gap-3">
                                <span className="h-8 w-8 rounded-full bg-secondary text-primary flex items-center justify-center text-sm font-bold">
                                  {chapterIdx + 1}
                                </span>
                                <span className="font-medium">{chapterTitle}</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pb-2">
                                {lessons.length === 0 && (
                                  <p className="text-sm text-muted-foreground py-2">
                                    {locale === "ar" ? "لا توجد دروس في هذا الفصل بعد." : locale === "fr" ? "Aucune leçon dans ce chapitre pour le moment." : "No lessons in this chapter yet."}
                                  </p>
                                )}
                                {lessons.map((lesson, lessonIdx) => {
                                  const lessonTitle = localize(locale, lesson.titleAr, lesson.titleFr, lesson.titleEn) || "";
                                  const accessible = lesson.isFree === true || !!lesson.videoUrl;
                                  return (
                                    <div key={lesson.id || `lesson-${lessonIdx}`} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                                      <div className="flex items-center gap-3">
                                        {accessible ? (
                                          <Play className="h-4 w-4 text-primary" />
                                        ) : (
                                          <Lock className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className="text-sm">{lessonTitle}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">{lesson.duration}</span>
                                        {lesson.isFree && (
                                          <span className="text-xs text-primary font-medium">
                                            {locale === "ar" ? "مجاني" : locale === "fr" ? "Gratuit" : "Free"}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </div>

                {/* Sidebar */}
                <div>
                  <Card className="shadow-sm border-border sticky top-20">
                    <CardContent className="p-6">
                      <h3 className="font-bold text-lg mb-4">
                        {locale === "ar" ? "عن الدورة" : locale === "fr" ? "À propos du cours" : "About the course"}
                      </h3>
                      {course.instructor && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                            <span className="text-primary font-bold">{course.instructor.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium">{course.instructor}</p>
                            <p className="text-sm text-muted-foreground">
                              {locale === "ar" ? "مُدرّب الدورة" : locale === "fr" ? "Formateur du cours" : "Course instructor"}
                            </p>
                          </div>
                        </div>
                      )}
                      {!!course.price && course.price > 0 && !course.isFree ? (
                        <p className="text-lg font-bold mb-4">
                          {course.price.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-lg font-bold mb-4">
                          {locale === "ar" ? "مجاني" : locale === "fr" ? "Gratuit" : "Free"}
                        </p>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {anyLocked ? (
                          <span>
                            {locale === "ar"
                              ? "بعض دروس هذه الدورة متاحة فقط للمشتركين."
                              : locale === "fr"
                                ? "Certaines leçons de ce cours sont réservées aux abonnés."
                                : "Some lessons in this course are available only to subscribers."}
                          </span>
                        ) : (
                          <span>
                            {locale === "ar"
                              ? "هذه الدورة متاحة بالكامل."
                              : locale === "fr"
                                ? "Ce cours est entièrement disponible."
                                : "This course is fully available."}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}