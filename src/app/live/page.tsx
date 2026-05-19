import type { Metadata } from "next";
import LivePage from "@/components/pages/LivePage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "البث المباشر | En direct | Live Stream",
  description:
    "شاهد البث المباشر للدكتورة نسرين في مجال العلاج النفسي والتطوير الذاتي. Regardez le live streaming de Dr. Ness. Watch live streams by Dr. Ness on psychotherapy and personal development.",
  alternates: {
    canonical: `${SITE_URL}/live`,
  },
  openGraph: {
    title: "البث المباشر | فضاء الشفاء",
    description: "بث مباشر في العلاج النفسي والتطوير الذاتي",
    url: `${SITE_URL}/live`,
    type: "website",
  },
};

export default function LiveRoute() {
  return (
    <SEOPageWrapper page="live">
      <LivePage />
    </SEOPageWrapper>
  );
}
