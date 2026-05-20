"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { useTranslation } from "@/lib/i18n";
import { useAppStore, ROUTE_TO_PAGE, PAGE_ROUTES } from "@/lib/store";
import { Header } from "@/components/layout/Header";
import { SidebarDesktop, SidebarMobile } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";
import { SplashScreen } from "@/components/SplashScreen";
import { initCSRFProtection } from "@/lib/csrf-client";

/* ================================================================== */
/*  AppShell                                                           */
/*                                                                     */
/*  Auth flow:                                                         */
/*  - Email/password login: handled by LoginPage → /api/auth/login     */
/*  - Admin login: handled by LoginPage → /api/auth/verify-admin       */
/*                                                                     */
/*  Session restoration on page load is done via /api/auth/session      */
/*  which checks the iron-session cookie — no Firebase dependency.     */
/*                                                                     */
/*  Navigation:                                                        */
/*  - SPA mode (loaded from "/"): pushState + Zustand state            */
/*  - Route mode (loaded from /login, /admin, etc.): full page nav     */
/*  The _spaMode flag in the store determines which strategy is used.  */
/* ================================================================== */

export function AppShell({ children }: { children: React.ReactNode }) {
  const { dir } = useTranslation();
  const [bgLoaded, setBgLoaded] = useState(false);

  // ── Initialize CSRF Protection ──
  useEffect(() => {
    initCSRFProtection();
  }, []);

  // ── Restore session on mount ──
  // Check iron-session cookie to see if user is already logged in.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const data = await res.json();

        if (cancelled) return;

        if (data.isLoggedIn && data.userId) {
          const store = useAppStore.getState();
          // Only restore if not already logged in
          if (!store.user) {
            let profileRestored = false;

            // Try to fetch full user data from profile API
            try {
              const profileRes = await fetch("/api/auth/profile");
              if (profileRes.ok) {
                const profileData = await profileRes.json();
                if (profileData.user) {
                  store.setUser({
                    id: profileData.user.id,
                    name: profileData.user.name,
                    email: profileData.user.email,
                    role: profileData.user.role,
                    avatar: profileData.user.avatar,
                    phone: profileData.user.phone,
                  });
                  profileRestored = true;
                  console.log("[AppShell] Session restored for:", profileData.user.email);
                }
              }
            } catch {
              console.warn("[AppShell] Session exists but profile fetch failed");
            }

            // FALLBACK: If profile fetch failed but session says user is logged in,
            // set user from session data.
            if (!profileRestored && !useAppStore.getState().user) {
              console.log("[AppShell] Falling back to session data for user:", data.userId);
              store.setUser({
                id: data.userId,
                name: data.role === "admin" ? "Admin" : "User",
                email: data.role === "admin" ? "admin@healingspace.com" : "",
                role: (data.role as "user" | "admin") || "user",
                avatar: undefined,
                phone: undefined,
              });
            }
          }
        }
      } catch {
        // Network error — ignore
      } finally {
        useAppStore.getState().setIsLoadingAuth?.(false);
      }
    }

    restoreSession();

    // Fetch public site settings
    (async () => {
      try {
        const res = await fetch("/api/public-settings");
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            useAppStore.getState().setSiteSettings(data.settings);
          }
        }
      } catch {
        // Ignore — settings will use defaults
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Set document direction and lang dynamically
  useEffect(() => {
    const htmlEl = document.documentElement;
    htmlEl.setAttribute("dir", dir);
    const { locale } = useAppStore.getState();
    htmlEl.setAttribute("lang", locale);
  }, [dir]);

  // Sync locale changes to <html lang>
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      if (state.locale !== prevState.locale) {
        document.documentElement.setAttribute("lang", state.locale);
      }
    });
    return unsubscribe;
  }, []);

  // Background is now pure CSS — no image preload needed
  useEffect(() => { setBgLoaded(true); }, []);

  // ── Set SPA mode and sync initial route from browser URL ──
  useEffect(() => {
    const path = window.location.pathname;
    const isSpaMode = path === "/";

    // Set SPA mode flag — this determines navigation strategy
    useAppStore.setState({ _spaMode: isSpaMode });

    // If we're on a route page, update currentPage to match the URL
    // so the sidebar highlights correctly
    if (!isSpaMode) {
      const page = ROUTE_TO_PAGE[path];
      if (page) {
        useAppStore.setState({ currentPage: page });
      }
    } else {
      // In SPA mode, also check URL for initial page
      const page = ROUTE_TO_PAGE[path];
      if (page && page !== "home") {
        useAppStore.setState({ currentPage: page });
      }
    }
  }, []);

  // ── Handle browser back/forward buttons ──
  useEffect(() => {
    function handlePopState(event: PopStateEvent) {
      const path = window.location.pathname;
      const page = ROUTE_TO_PAGE[path];
      if (page) {
        const store = useAppStore.getState();
        if (store.currentPage !== page) {
          // Use setState directly (no pushState) since browser already changed URL
          useAppStore.setState({ currentPage: page, pageParams: event.state?.params || {} });
        }
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {/* Splash screen overlay */}
      <SplashScreen />

      <div
        className="healing-site-bg min-h-screen flex flex-col bg-background text-foreground"
      >
        {/* ── Background Layer 1: Gradient wash (via ::before pseudo-element) ── */}

        {/* ── Background Layer 2: Fine noise texture ── */}
        <div className="healing-noise" />

        {/* Content layer above all backgrounds */}
        <div className="relative z-10 flex min-h-screen flex flex-col">
          {/* Header — always on top */}
          <Header />

          {/* Desktop sidebar */}
          <SidebarDesktop />

          {/* Mobile sidebar sheet */}
          <SidebarMobile />

          {/* Main content — with left margin on desktop for the sidebar */}
          <main className="flex flex-1 flex-col lg:ms-64">
            <div className="flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
              {children}
            </div>

            {/* Footer */}
            <Footer />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
