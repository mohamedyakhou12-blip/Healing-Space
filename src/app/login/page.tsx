import type { Metadata } from "next";
import LoginPage from "@/components/pages/LoginPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "تسجيل الدخول | Connexion | Login",
  description: "تسجيل الدخول إلى فضاء الشفاء. Connexion à Espace de Guérison. Login to Healing Space.",
  alternates: { canonical: `${SITE_URL}/login` },
  robots: { index: false, follow: true },
};

export default function LoginRoute() {
  return (
    <SEOPageWrapper page="login">
      <LoginPage />
    </SEOPageWrapper>
  );
}
