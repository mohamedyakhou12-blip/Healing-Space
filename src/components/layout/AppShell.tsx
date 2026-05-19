"use client";

import { useEffect, useState, useRef } from "react";
import { ThemeProvider } from "next-themes";
import { useTranslation } from "@/lib/i18n";
import { useAppStore, ROUTE_TO_PAGE } from "@/lib/store";
import { Header } from "@/components/layout/Header";
import { SidebarDesktop, SidebarMobile } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";
import { SplashScreen } from "@/components/SplashScreen";
import { initCSRFProtection } from "@/lib/csrf-client";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

/* ================================================================== */
/*  AppShell                                                           */
/*                                                                     */
/*  Auth flow:                                                         */
/*  PRIMARY: signInWithPopup — handled in LoginPage/RegisterPage.      */
/*  Result is available immediately, no page navigation, no state loss.*/
/*                                                                     */
/*  SAFETY NET: onAuthStateChanged — detects any Firebase sign-in      */
/*  that wasn't processed by the popup handler (e.g., popup succeeded  */
/*  but backend call failed). Creates the server session automatically.*/
/*                                                                     */
/*  Session restoration on page load is done via /api/auth/session      */
/*  which checks the iron-session cookie — no Firebase dependency.     */
/*                                                                     */
/*  NOTE: signInWithRedirect is NOT used because it's broken on Vercel */
/*  serverless (JS state is lost on page navigation).                  */
/* ================================================================== */

// Track whether we've already processed a Google sign-in during this mount
// This prevents double-processing by both onAuthStateChanged and the popup handler
let googleAuthProcessedThisMount = false;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { dir } = useTranslation();
  const [bgLoaded, setBgLoaded] = useState(false);
  const authListenerSetup = useRef(false);

  // ── Initialize CSRF Protection ──
  // This must run before any mutating fetch calls are made.
  useEffect(() => {
    initCSRFProtection();
  }, []);

  // ── onAuthStateChanged: Safety net for Firebase sign-ins ──
  // This catches cases where:
  // 1. The popup succeeded but the backend call failed (network error, etc.)
  // 2. The user was already signed in from a previous session (Firebase persistence)
  //
  // This does NOT replace the popup handler — it's a fallback only.
  // It checks: is there a Firebase user but NO client-side user state? → create session
  useEffect(() => {
    if (authListenerSetup.current) return;
    authListenerSetup.current = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      // Skip if already logged in on the client side (popup handler already processed)
      const store = useAppStore.getState();
      if (store.user) {
        console.log("[AppShell] onAuthStateChanged: user already in store, skipping");
        return;
      }

      // Skip if the popup handler already processed this sign-in
      if (googleAuthProcessedThisMount) {
        console.log("[AppShell] onAuthStateChanged: auth already processed this mount, skipping");
        return;
      }

      if (!firebaseUser) {
        // No Firebase user — not signed in via Firebase
        return;
      }

      // We have a Firebase user but no client-side user state!
      // This means the popup handler didn't process this sign-in successfully.
      // Let's create the session now as a safety net.
      const email = firebaseUser.email;
      console.log("[AppShell] onAuthStateChanged: Detected Firebase sign-in not processed by popup handler:", email);

      // Mark as processed to prevent double-processing
      googleAuthProcessedThisMount = true;
      store.setIsLoadingAuth(true);

      try {
        const idToken = await firebaseUser.getIdToken();
        console.log("[AppShell] onAuthStateChanged: Got ID token, sending to backend...");

        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          useAppStore.getState().setUser({
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            avatar: data.user.avatar,
            phone: data.user.phone,
          });

          const { locale } = useAppStore.getState();
          const toast = (await import("sonner")).toast;
          toast.success(
            data.isNewUser
              ? (locale === "ar" ? "تم إنشاء الحساب بنجاح! مرحباً بك" : "Account created successfully! Welcome")
              : (locale === "ar" ? "تم تسجيل الدخول بنجاح!" : "Login successful!")
          );
          useAppStore.getState().navigate("home");
          console.log("[AppShell] onAuthStateChanged: Session created for:", email);
        } else {
          console.error("[AppShell] onAuthStateChanged: Backend verification failed:", data.error);
          // Don't show error toast here — the popup handler's error message is already visible
        }
      } catch (err) {
        console.error("[AppShell] onAuthStateChanged: Failed to create session:", err);
      } finally {
        useAppStore.getState().setIsLoadingAuth(false);
        if (typeof window !== "undefined") {
          (window as any).__googleSignInInProgress = false;
        }
      }
    });

    return () => unsubscribe();
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
            // Fetch full user data from profile API
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
                  console.log("[AppShell] Session restored for:", profileData.user.email);
                }
              }
            } catch {
              console.warn("[AppShell] Session exists but profile fetch failed");
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

    // Fetch public site settings (e.g., individualPurchasesEnabled)
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
  // setBgLoaded kept for potential future use
  useEffect(() => { setBgLoaded(true); }, []);

  // ── Sync initial route from browser URL ──
  // When a user navigates directly to a route like /courses, the Zustand
  // store starts with currentPage: "home". This effect detects the actual
  // URL and syncs the store so the correct page is rendered.
  useEffect(() => {
    const path = window.location.pathname;
    const page = ROUTE_TO_PAGE[path];
    if (page && page !== "home") {
      const store = useAppStore.getState();
      if (store.currentPage === "home") {
        // Use setState directly to avoid pushState (we're already at this URL)
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
          store.navigate(page, event.state?.params || {});
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
