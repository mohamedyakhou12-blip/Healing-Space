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

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
};

const pageTransition = {
  type: "tween" as const,
  ease: "easeInOut" as const,
  duration: 0.25,
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
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
        >
          <PageComponent />
        </motion.div>
      </AnimatePresence>
    </PageErrorBoundary>
  );
}
