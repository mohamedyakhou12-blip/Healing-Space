'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, User, ArrowRight, Loader2, Lock, FileText } from 'lucide-react';
import Link from 'next/link';
import { useAppStore } from "@/lib/store";

type Article = {
  id: string;
  titleAr?: string;
  titleFr?: string;
  titleEn?: string;
  contentAr?: string | null;
  contentFr?: string | null;
  contentEn?: string | null;
  excerptAr?: string;
  excerptFr?: string;
  excerptEn?: string;
  author?: string;
  image?: string;
  readTime?: string;
  publishedDate?: string;
  category?: string;
  isFree?: boolean;
  price?: number;
  status?: string;
};

function localize(locale: string, ar?: string | null, fr?: string | null, en?: string | null): string {
  if (locale === "fr") return fr || ar || "";
  if (locale === "en") return en || ar || "";
  return ar || "";
}

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const locale = useAppStore((s) => s.locale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    fetch(`/api/articles/${encodeURIComponent(id)}`)
      .then((res) => {
        if (res.status === 404) throw new Error("not-found");
        if (!res.ok) throw new Error("server");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setArticle((data as { article: Article }).article || null);
        if (!(data as { article: Article }).article) {
          setError("not-found");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error && e.message === "not-found" ? "not-found" : "server");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Related articles (exclude the current one)
    fetch("/api/articles?status=published&limit=4")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (cancelled) return;
        const others = ((data as { articles?: Article[] }).articles || []).filter((a: Article) => a.id !== id);
        setRelated(others.slice(0, 3));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id]);

  const title = article ? localize(locale, article.titleAr, article.titleFr, article.titleEn) : "";
  const content = article ? localize(locale, article.contentAr, article.contentFr, article.contentEn) : "";
  const excerpt = article ? localize(locale, article.excerptAr, article.excerptFr, article.excerptEn) : "";
  const locked = article ? !content : false;

  const ArrowIcon = locale === "ar" ? ArrowRight : ArrowRight;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 bg-muted/30 py-8" dir={dir}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/articles"
            className="inline-flex items-center gap-1 text-primary hover:text-accent mb-6"
          >
            <ArrowIcon className="h-4 w-4 rtl:rotate-180" />
            {locale === "ar" ? "العودة للمقالات" : locale === "fr" ? "Retour aux articles" : "Back to articles"}
          </Link>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {locale === "ar" ? "جاري تحميل المقال..." : locale === "fr" ? "Chargement de l'article..." : "Loading article..."}
              </p>
            </div>
          )}

          {!loading && (error === "not-found" || !id) && (
            <div className="text-center py-20">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">
                {locale === "ar" ? "المقال غير موجود" : locale === "fr" ? "Article introuvable" : "Article not found"}
              </h1>
              <p className="text-muted-foreground mb-6">
                {locale === "ar" ? "قد يكون المقال محذوفاً أو غير متاح." : locale === "fr" ? "Cet article peut avoir été supprimé ou n'est pas disponible." : "This article may have been removed or is unavailable."}
              </p>
              <Link href="/articles">
                <Button variant="outline">
                  {locale === "ar" ? "تصفح المقالات" : locale === "fr" ? "Parcourir les articles" : "Browse articles"}
                </Button>
              </Link>
            </div>
          )}

          {!loading && error === "server" && (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-6">
                {locale === "ar" ? "حدث خطأ أثناء تحميل المقال. حاول مرة أخرى لاحقاً." : locale === "fr" ? "Une erreur est survenue lors du chargement. Réessayez plus tard." : "An error occurred while loading. Please try again later."}
              </p>
              <Link href="/articles">
                <Button variant="outline">
                  {locale === "ar" ? "العودة للمقالات" : locale === "fr" ? "Retour aux articles" : "Back to articles"}
                </Button>
              </Link>
            </div>
          )}

          {!loading && !error && article && (
            <article className="bg-background rounded-2xl shadow-sm border border-border p-8">
              {article.category && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                    {article.category}
                  </span>
                  {!article.isFree && !!article.price && article.price > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      {article.price.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              {article.image && (
                <img
                  src={article.image}
                  alt={title}
                  className="w-full h-56 sm:h-72 object-cover rounded-xl mb-6"
                />
              )}
              <h1 className="text-3xl font-bold mb-4">{title}</h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground mb-8 pb-6 border-b border-border">
                {article.author && (
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {article.author}
                  </div>
                )}
                {article.publishedDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {article.publishedDate}
                  </div>
                )}
                {article.readTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {article.readTime}
                  </div>
                )}
              </div>

              {locked ? (
                <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center">
                  <Lock className="h-10 w-10 text-primary mx-auto mb-4" />
                  <h2 className="text-lg font-bold mb-2">
                    {locale === "ar" ? "هذا المقال للمشتركين" : locale === "fr" ? "Cet article est réservé aux abonnés" : "This article is for subscribers"}
                  </h2>
                  <p className="text-muted-foreground text-sm mb-2 max-w-md mx-auto">
                    {excerpt}
                  </p>
                  <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                    {locale === "ar"
                      ? "اشترك في إحدى الباقات للوصول الكامل إلى هذا المحتوى."
                      : locale === "fr"
                        ? "Abonnez-vous pour accéder à l'intégralité de ce contenu."
                        : "Subscribe to a plan to get full access to this content."}
                  </p>
                  <Link href="/subscriptions">
                    <Button>
                      {locale === "ar" ? "عرض باقات الاشتراك" : locale === "fr" ? "Voir les abonnements" : "View subscription plans"}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div
                  className="prose prose-lg max-w-none text-foreground leading-relaxed [&_h2]:text-primary [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:my-4 [&_ol]:my-4"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              )}
            </article>
          )}

          {!loading && !error && article && related.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">
                {locale === "ar" ? "مقالات ذات صلة" : locale === "fr" ? "Articles similaires" : "Related articles"}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((rel) => {
                  const relTitle = localize(locale, rel.titleAr, rel.titleFr, rel.titleEn);
                  return (
                    <Link key={rel.id} href={`/articles/${rel.id}`}>
                      <Card className="hover:shadow-md transition-all cursor-pointer h-full">
                        <CardContent className="p-4">
                          {rel.image && (
                            <img
                              src={rel.image}
                              alt={relTitle}
                              className="w-full h-24 object-cover rounded-lg mb-3"
                            />
                          )}
                          <h3 className="font-medium text-sm line-clamp-2">{relTitle}</h3>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}