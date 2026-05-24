import type { Metadata } from "next";
import PaymentPage from "@/components/pages/PaymentPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "الدفع | Paiement | Payment",
  description: "إتمام عملية الدفع للاشتراك في فضاء الشفاء. Complete your payment for Healing Space subscription.",
  alternates: { canonical: `${SITE_URL}/payment` },
  robots: { index: false, follow: true },
};

export default function PaymentRoute() {
  return (
    <SEOPageWrapper page="payment">
      <PaymentPage />
    </SEOPageWrapper>
  );
}
