import type { Metadata } from "next";
import PdfsPage from "@/components/pages/PdfsPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "الكتب والملفات | Livres & Fichiers | E-Books & PDFs",
  description:
    "تصفح الكتب الإلكترونية والملفات الصوتية المتخصصة في العلاج النفسي والتطوير الذاتي. Parcourez les livres électroniques et fichiers audio. Browse e-books and audio files on psychotherapy and personal development.",
  alternates: {
    canonical: `${SITE_URL}/pdfs`,
  },
  openGraph: {
    title: "الكتب والملفات | فضاء الشفاء",
    description: "كتب إلكترونية وملفات صوتية متخصصة في العلاج النفسي",
    url: `${SITE_URL}/pdfs`,
    type: "website",
  },
};

export default function PdfsRoute() {
  return (
    <SEOPageWrapper page="pdfs">
      <PdfsPage />
    </SEOPageWrapper>
  );
}
