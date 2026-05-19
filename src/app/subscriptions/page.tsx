import type { Metadata } from "next";
import SubscriptionsPage from "@/components/pages/SubscriptionsPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "الاشتراكات | Abonnements | Subscriptions",
  description:
    "اشترك في منصة فضاء الشفاء واحصل على وصول كامل لجميع الدورات والمقالات والبودكاست والفيديوهات. Abonnez-vous à Espace de Guérison pour un accès complet. Subscribe to Healing Space for full access to all content.",
  alternates: {
    canonical: `${SITE_URL}/subscriptions`,
  },
  openGraph: {
    title: "الاشتراكات | فضاء الشفاء",
    description: "اشترك في منصة فضاء الشفاء واحصل على وصول كامل لجميع المحتوى",
    url: `${SITE_URL}/subscriptions`,
    type: "website",
  },
};

export default function SubscriptionsRoute() {
  return (
    <SEOPageWrapper page="subscriptions">
      <SubscriptionsPage />
    </SEOPageWrapper>
  );
}
