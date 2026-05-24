import type { Metadata } from "next";
import CoachingPage from "@/components/pages/CoachingPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "كوتشنغ | Coaching | Coaching",
  description:
    "برنامج الشفاء المتكامل — جلسات شهرية، ورش عمل، تمارين، تأمل، علاج فني والمزيد. Programme de Guérison Intégré. Integrated Healing Program with monthly sessions, workshops, exercises, meditation, art therapy and more.",
  alternates: {
    canonical: `${SITE_URL}/coaching`,
  },
  openGraph: {
    title: "كوتشنغ | فضاء الشفاء",
    description: "برنامج الشفاء المتكامل — رحلة شاملة نحو التعافي والتوازن",
    url: `${SITE_URL}/coaching`,
    type: "website",
  },
};

export default function CoachingRoute() {
  return (
    <SEOPageWrapper page="coaching">
      <CoachingPage />
    </SEOPageWrapper>
  );
}
