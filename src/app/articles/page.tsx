import type { Metadata } from "next";
import ArticlesPage from "@/components/pages/ArticlesPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "المقالات | Articles | Articles",
  description:
    "اقرأ المقالات المتخصصة في العلاج النفسي والصحة النفسية والتطوير الذاتي. Lisez des articles spécialisés en psychothérapie et santé mentale. Read specialized articles on psychotherapy, mental health, and personal development.",
  alternates: {
    canonical: `${SITE_URL}/articles`,
  },
  openGraph: {
    title: "المقالات | فضاء الشفاء",
    description: "مقالات متخصصة في العلاج النفسي والصحة النفسية",
    url: `${SITE_URL}/articles`,
    type: "website",
  },
};

export default function ArticlesRoute() {
  return (
    <SEOPageWrapper page="articles">
      <ArticlesPage />
    </SEOPageWrapper>
  );
}
