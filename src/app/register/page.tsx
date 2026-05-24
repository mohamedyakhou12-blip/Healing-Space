import type { Metadata } from "next";
import RegisterPage from "@/components/pages/RegisterPage";
import { SEOPageWrapper } from "@/components/pages/SEOPageWrapper";
import { SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "إنشاء حساب | Inscription | Register",
  description: "إنشاء حساب جديد في فضاء الشفاء. Créer un compte sur Espace de Guérison. Create a new account on Healing Space.",
  alternates: { canonical: `${SITE_URL}/register` },
  robots: { index: false, follow: true },
};

export default function RegisterRoute() {
  return (
    <SEOPageWrapper page="register">
      <RegisterPage />
    </SEOPageWrapper>
  );
}
