import type { Metadata } from "next";
import CoursesPage from "@/components/pages/CoursesPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "الدورات التعليمية | Cours | Courses",
  description:
    "اكتشف الدورات التعليمية في مجال العلاج النفسي والتطوير الذاتي مع الدكتورة نسرين. Découvrez les cours de psychothérapie et développement personnel par Dr. Ness. Explore courses in psychotherapy and personal development by Dr. Ness.",
  alternates: {
    canonical: `${SITE_URL}/courses`,
  },
  openGraph: {
    title: "الدورات التعليمية | فضاء الشفاء",
    description: "دورات تعليمية متخصصة في العلاج النفسي والتطوير الذاتي",
    url: `${SITE_URL}/courses`,
    type: "website",
  },
};

export default function CoursesRoute() {
  return (
    <SEOPageWrapper page="courses">
      <CoursesPage />
    </SEOPageWrapper>
  );
}
