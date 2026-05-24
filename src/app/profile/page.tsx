import type { Metadata } from "next";
import ProfilePage from "@/components/pages/ProfilePage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "الملف الشخصي | Profil | Profile",
  description: "إدارة الملف الشخصي والاشتراك في فضاء الشفاء. Manage your profile and subscription on Healing Space.",
  alternates: { canonical: `${SITE_URL}/profile` },
  robots: { index: false, follow: true },
};

export default function ProfileRoute() {
  return (
    <SEOPageWrapper page="profile">
      <ProfilePage />
    </SEOPageWrapper>
  );
}
