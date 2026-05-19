import type { Metadata } from "next";
import VideosPage from "@/components/pages/VideosPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "الفيديوهات | Vidéos | Videos",
  description:
    "شاهد الفيديوهات التعليمية في مجال العلاج النفسي والتطوير الذاتي مع الدكتورة نسرين. Regardez les vidéos éducatives en psychothérapie. Watch educational videos on psychotherapy and personal development by Dr. Ness.",
  alternates: {
    canonical: `${SITE_URL}/videos`,
  },
  openGraph: {
    title: "الفيديوهات | فضاء الشفاء",
    description: "فيديوهات تعليمية متخصصة في العلاج النفسي والتطوير الذاتي",
    url: `${SITE_URL}/videos`,
    type: "website",
  },
};

export default function VideosRoute() {
  return (
    <SEOPageWrapper page="videos">
      <VideosPage />
    </SEOPageWrapper>
  );
}
