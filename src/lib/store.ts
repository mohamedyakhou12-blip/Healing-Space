import { create } from "zustand";
import { clearCSRFToken } from "./csrf-client";

export type Locale = "ar" | "fr" | "en";

export type PageName =
  | "home"
  | "courses"
  | "articles"
  | "podcasts"
  | "videos"
  | "pdfs"
  | "live"
  | "profile"
  | "admin"
  | "login"
  | "register"
  | "subscriptions"
  | "payment"
  | "notifications"
  | "homepageCustomizer";

/** Map page names to their URL paths for SEO-friendly routing */
export const PAGE_ROUTES: Record<PageName, string> = {
  home: "/",
  courses: "/courses",
  articles: "/articles",
  podcasts: "/podcasts",
  videos: "/videos",
  pdfs: "/pdfs",
  live: "/live",
  subscriptions: "/subscriptions",
  profile: "/profile",
  admin: "/admin",
  login: "/login",
  register: "/register",
  payment: "/payment",
  notifications: "/notifications",
  homepageCustomizer: "/admin",
};

/** Map URL paths back to page names */
export const ROUTE_TO_PAGE: Record<string, PageName> = {
  "/": "home",
  "/courses": "courses",
  "/articles": "articles",
  "/podcasts": "podcasts",
  "/videos": "videos",
  "/pdfs": "pdfs",
  "/live": "live",
  "/subscriptions": "subscriptions",
  "/profile": "profile",
  "/admin": "admin",
  "/login": "login",
  "/register": "register",
  "/payment": "payment",
  "/notifications": "notifications",
};

// Admin access code is ONLY available server-side (ADMIN_ACCESS_CODE env var).
// NEVER expose the admin code in the client bundle (no NEXT_PUBLIC_ prefix).
// The client sends the code to /api/auth/verify-admin for server-side validation.

export interface UserSubscription {
  plan: string;
  status: "active" | "expired" | "none";
  expiresAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: "user" | "admin";
  subscription?: UserSubscription;
}

interface AppState {
  // Locale / Language
  locale: Locale;
  setLocale: (locale: Locale) => void;

  // Navigation
  currentPage: PageName;
  pageParams: Record<string, unknown>;
  navigate: (page: PageName, params?: Record<string, unknown>) => void;
  /** Whether the app was initially loaded on the SPA root page "/" */
  _spaMode: boolean;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // User / Auth
  user: User | null;
  isAdmin: boolean;
  isLoadingAuth: boolean;
  setUser: (user: User | null) => void;
  clearUserBeforeLogin: () => void;
  setIsLoadingAuth: (loading: boolean) => void;
  logout: () => void;

  // Admin access
  showAdminLogin: boolean;
  setShowAdminLogin: (show: boolean) => void;

  // Site settings (fetched from API)
  individualPurchasesEnabled: boolean;
  setIndividualPurchasesEnabled: (enabled: boolean) => void;
  siteSettings: Record<string, string>;
  setSiteSettings: (settings: Record<string, string>) => void;
}

/**
 * Detect if SPA mode should be active.
 *
 * Since vercel.json rewrites ALL routes to the root page "/",
 * the SPA always handles routing client-side. Therefore SPA mode
 * should ALWAYS be true when running in the browser.
 *
 * Previously this only returned true for pathname === "/", which
 * broke navigation on any other URL since the SPA root page is
 * actually served for ALL routes via the rewrite rules.
 */
function detectSpaMode(): boolean {
  if (typeof window === "undefined") return false;
  // Always true — the SPA root handles all routes via vercel.json rewrites
  return true;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // Locale defaults to Arabic (primary audience)
  locale: "ar",
  setLocale: (locale) => set({ locale }),

  // Navigation
  currentPage: "home",
  pageParams: {},
  _spaMode: typeof window !== "undefined" ? detectSpaMode() : false,
  navigate: (page, params = {}) => {
    const state = get();
    set({ currentPage: page, pageParams: params });
    const route = PAGE_ROUTES[page];
    if (route && typeof window !== "undefined") {
      const currentPath = window.location.pathname;
      if (currentPath !== route) {
        if (state._spaMode) {
          // ── SPA MODE: use pushState for smooth client-side navigation ──
          // The SPA on "/" renders all pages dynamically via Zustand state.
          // pushState changes the URL for bookmarkability without a full reload.
          window.history.pushState({ page, params }, "", route);
        } else {
          // ── ROUTE MODE: full page navigation for reliable page switches ──
          // We're on a dedicated Next.js route page (e.g. /login, /admin).
          // Must use full navigation to load the target Next.js page.
          window.location.href = route;
        }
      }
    }
  },

  // Sidebar
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // User / Auth
  user: null,
  isAdmin: false,
  isLoadingAuth: true,
  setUser: (user) =>
    set({
      // NEVER store subscription in Zustand — always fetch fresh from API.
      // This is the nuclear fix for the subscription leaking bug.
      user: user ? { ...user, subscription: undefined } : null,
      isAdmin: user?.role === "admin",
    }),
  clearUserBeforeLogin: () =>
    set({
      user: null,
      isAdmin: false,
    }),
  setIsLoadingAuth: (loading) => set({ isLoadingAuth: loading }),
  logout: async () => {
    // 1. Clear server session
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors
    }
    // 2. Clear CSRF token
    clearCSRFToken();
    // 3. Clear client state
    set({
      user: null,
      isAdmin: false,
      currentPage: "home",
    });
    // 4. Navigate to home page — use full page navigation to ensure
    // the page component switches correctly from any route page
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
  },

  // Admin access
  showAdminLogin: false,
  setShowAdminLogin: (show) => set({ showAdminLogin: show }),

  // Site settings
  individualPurchasesEnabled: true, // default: enabled
  setIndividualPurchasesEnabled: (enabled) => set({ individualPurchasesEnabled: enabled }),
  siteSettings: {},
  setSiteSettings: (settings) => set({
    siteSettings: settings,
    individualPurchasesEnabled: settings.individualPurchasesEnabled !== "false",
  }),
}));
