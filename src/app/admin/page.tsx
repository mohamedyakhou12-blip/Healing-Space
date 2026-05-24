import type { Metadata } from "next";
import AdminPage from "@/components/pages/AdminPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";

export const metadata: Metadata = {
  title: "لوحة التحكم | Administration",
  description: "لوحة تحكم فضاء الشفاء - إدارة المحتوى والمستخدمين والاشتراكات",
  robots: { index: false, follow: false },
};

export default function AdminRoute() {
  return (
    <SEOPageWrapper page="admin">
      <AdminPage />
    </SEOPageWrapper>
  );
}
