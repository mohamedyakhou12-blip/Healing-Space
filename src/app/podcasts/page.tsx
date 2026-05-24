import type { Metadata } from "next";
import PodcastsPage from "@/components/pages/PodcastsPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "البودكاست | Podcast | Podcasts",
  description:
    "استمع إلى حلقات البودكاست المتخصصة في العلاج النفسي والتطوير الذاتي مع الدكتورة نسرين. Écoutez les podcasts spécialisés en psychothérapie. Listen to podcasts on psychotherapy and personal development by Dr. Ness.",
  alternates: {
    canonical: `${SITE_URL}/podcasts`,
  },
  openGraph: {
    title: "البودكاست | فضاء الشفاء",
    description: "حلقات بودكاست متخصصة في العلاج النفسي والتطوير الذاتي",
    url: `${SITE_URL}/podcasts`,
    type: "website",
  },
};

export default function PodcastsRoute() {
  return (
    <SEOPageWrapper page="podcasts">
      <PodcastsPage />
    </SEOPageWrapper>
  );
}
