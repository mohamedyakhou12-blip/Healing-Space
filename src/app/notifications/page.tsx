import type { Metadata } from "next";
import NotificationsPage from "@/components/pages/NotificationsPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

export const metadata: Metadata = {
  title: "الإشعارات | Notifications",
  description: "عرض إشعاراتك في فضاء الشفاء. View your notifications on Healing Space.",
  robots: { index: false, follow: true },
};

export default function NotificationsRoute() {
  return (
    <SEOPageWrapper page="notifications">
      <NotificationsPage />
    </SEOPageWrapper>
  );
}
