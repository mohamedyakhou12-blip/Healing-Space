"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import dynamic from "next/dynamic";
import { getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Use dynamic imports to prevent all pages from loading at once
// and to isolate potential errors to individual pages
const HomePage = dynamic(() => import("@/components/pages/HomePage"));
const LoginPage = dynamic(() => import("@/components/pages/LoginPage"));
const RegisterPage = dynamic(() => import("@/components/pages/RegisterPage"));

const CoursesPage = dynamic(() => import("@/components/pages/CoursesPage"));
const ArticlesPage = dynamic(() => import("@/components/pages/ArticlesPage"));
const PodcastsPage = dynamic(() => import("@/components/pages/PodcastsPage"));
const VideosPage = dynamic(() => import("@/components/pages/VideosPage"));
const PdfsPage = dynamic(() => import("@/components/pages/PdfsPage"));
const LivePage = dynamic(() => import("@/components/pages/LivePage"));
const SubscriptionsPage = dynamic(() => import("@/components/pages/SubscriptionsPage"));
const PaymentPage = dynamic(() => import("@/components/pages/PaymentPage"));
const ProfilePage = dynamic(() => import("@/components/pages/ProfilePage"));
const AdminPage = dynamic(() => import("@/components/pages/AdminPage"));
const NotificationsPage = dynamic(() => import("@/components/pages/NotificationsPage"));
const HomepageCustomizerPage = dynamic(() => import("@/components/pages/HomepageCustomizerPage"));

const pageComponents: Record<string, React.ComponentType> = {
  home: HomePage,
  login: LoginPage,
  register: RegisterPage,
  courses: CoursesPage,
  articles: ArticlesPage,
  podcasts: PodcastsPage,
  videos: VideosPage,
  pdfs: PdfsPage,
  live: LivePage,
  subscriptions: SubscriptionsPage,
  payment: PaymentPage,
  profile: ProfilePage,
  admin: AdminPage,
  notifications: NotificationsPage,
  homepageCustomizer: HomepageCustomizerPage,
};

export default function Page() {
  const currentPage = useAppStore((s) => s.currentPage);
  const userId = useAppStore((s) => s.user?.id);
  const setUser = useAppStore((s) => s.setUser);
  const PageComponent = pageComponents[currentPage] ?? HomePage;

  // ── Handle Google Sign-In redirect result (for mobile) ──
  // When signInWithRedirect is used on mobile, the page reloads after
  // the user completes sign-in on Google's page. We need to catch the
  // result here and send the ID token to our server.
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) return; // No redirect result — normal page load
        console.log("[Google Redirect] Got redirect result");
        const idToken = await result.user.getIdToken();
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = await res.json().catch(() => ({ success: false }));
        if (data.success && data.user) {
          setUser({
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            avatar: data.user.avatar,
            phone: data.user.phone,
          });
          const target = data.user.role === "admin" ? "admin" : "home";
          useAppStore.getState().navigate(target);
        }
      })
      .catch((err) => {
        console.error("[Google Redirect] Error:", err);
      });
  }, [setUser]);

  // CRITICAL: key includes userId so ALL pages remount when user changes.
  // This prevents stale subscription state from leaking between accounts.
  const pageKey = `${currentPage}::${userId}`;

  return (
    <PageErrorBoundary>
      <AnimatePresence mode="wait">
        <motion.div
          key={pageKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <PageComponent />
        </motion.div>
      </AnimatePresence>
    </PageErrorBoundary>
  );
}
