"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import dynamic from "next/dynamic";

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
  const PageComponent = pageComponents[currentPage] ?? HomePage;

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
