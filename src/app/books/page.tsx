import type { Metadata } from "next";
import BooksPage from "@/components/pages/BooksPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "الكتب الإلكترونية | Livres | E-Books",
  description:
    "تصفح الكتب الإلكترونية المتخصصة في العلاج النفسي والتطوير الذاتي. Parcourez les livres électroniques en psychothérapie. Browse e-books specialized in psychotherapy and personal development.",
  alternates: {
    canonical: `${SITE_URL}/books`,
    languages: {
      "ar": `${SITE_URL}/books`,
      "fr": `${SITE_URL}/books`,
      "en": `${SITE_URL}/books`,
    },
  },
  openGraph: {
    title: "الكتب الإلكترونية | فضاء الشفاء",
    description: "كتب إلكترونية متخصصة في العلاج النفسي والتطوير الذاتي",
    url: `${SITE_URL}/books`,
    siteName: "فضاء الشفاء",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "الكتب الإلكترونية - فضاء الشفاء",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "الكتب الإلكترونية | فضاء الشفاء",
    description: "كتب إلكترونية متخصصة في العلاج النفسي والتطوير الذاتي",
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function BooksRoute() {
  return (
    <SEOPageWrapper page="pdfs">
      <BooksPage />
    </SEOPageWrapper>
  );
}
