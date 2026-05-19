"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Eye, EyeOff, Heart, Sparkles, Leaf, Shield, ArrowRight, KeyRound } from "lucide-react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { setStoredAdminCode } from "@/lib/api-helpers";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Schemas                                                             */
/* ------------------------------------------------------------------ */

const loginSchema = z.object({
  email: z.string().email("يرجى إدخال بريد إلكتروني صحيح"),
  password: z.string().min(1, "يرجى إدخال كلمة المرور"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const adminSchema = z.object({
  code: z.string().min(1, "يرجى إدخال الكود"),
});

type AdminFormValues = z.infer<typeof adminSchema>;

/* ------------------------------------------------------------------ */
/*  Animation                                                          */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

/* ------------------------------------------------------------------ */
/*  Global mutex: prevents double sign-in attempts                     */
/*  Uses window object so it's shared across component re-mounts       */
/*  and page navigations (React Strict Mode, double-clicks, etc.)      */
/* ------------------------------------------------------------------ */
function isGoogleSignInInProgress(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).__googleSignInInProgress;
}
function setGoogleSignInInProgress(val: boolean): void {
  if (typeof window !== "undefined") {
    (window as any).__googleSignInInProgress = val;
  }
}

/* ================================================================== */
/*  LoginPage                                                          */
/*                                                                     */
/*  Google sign-in uses signInWithPopup (primary method).              */
/*  The popup method is more reliable than redirect because:           */
/*  - No page navigation → no state loss                               */
/*  - Result available immediately in the same JS context              */
/*  - No need for getRedirectResult() which often fails on Vercel      */
/*                                                                     */
/*  Flow:                                                              */
/*  1. User clicks "Sign in with Google"                               */
/*  2. signInWithPopup opens a popup to Google                         */
/*  3. After sign-in, the popup closes and result is available         */
/*  4. ID token is sent to /api/auth/google for verification           */
/*  5. Session is created and user is logged in                        */
/*                                                                     */
/*  AppShell also has an onAuthStateChanged safety net that detects    */
/*  Firebase sign-ins that weren't processed by the popup handler.     */
/* ================================================================== */

export default function LoginPage() {
  const { t, locale } = useTranslation();
  const navigate = useAppStore((s) => s.navigate);
  const setUser = useAppStore((s) => s.setUser);
  const dir = useAppStore((s) => (s.locale === "ar" ? "rtl" : "ltr"));
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminCodeError, setAdminCodeError] = useState("");

  // ── Handle redirect result (when user returns from Google) ──
  useEffect(() => {
    let handled = false;
    getRedirectResult(auth).then((result) => {
      if (result && !handled) {
        handled = true;
        const email = result.user.email;
        console.log("[Google Auth] Redirect sign-in successful for:", email);
        result.user.getIdToken().then((idToken) => {
          sendTokenToBackend(idToken);
        });
      }
    }).catch((error) => {
      console.error("[Google Auth] getRedirectResult error:", error?.code, error?.message);
    });
    return () => { handled = true; };
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const adminForm = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    useAppStore.getState().clearUserBeforeLogin();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({ error: t("common.serverError") }));
        console.error("Login API error:", result);
        const apiError = result.error || "";
        let displayError: string;
        if (apiError.includes("Invalid credentials")) {
          displayError = locale === "ar" ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email or password";
        } else if (apiError.includes("temporarily locked") || apiError.includes("Too many")) {
          displayError = locale === "ar" ? "محاولات كثيرة. يرجى المحاولة لاحقاً" : "Too many attempts. Please try again later";
        } else if (apiError.includes("deactivated")) {
          displayError = locale === "ar" ? "الحساب معطل. يرجى التواصل مع الدعم" : "Account is deactivated";
        } else {
          displayError = apiError || t("auth.loginFailed");
        }
        toast.error(displayError, { duration: 5000 });
        return;
      }

      const result = await res.json();

      if (!result.success) {
        toast.error(result.error || t("auth.loginFailed"));
        return;
      }

      setUser({
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        avatar: result.user.avatar,
        phone: result.user.phone,
      });
      toast.success(t("common.success"));
      navigate("home");
    } catch {
      toast.error(t("common.serverError"));
    } finally {
      setIsLoading(false);
    }
  };

  const onAdminSubmit = async (data: AdminFormValues) => {
    setIsLoading(true);
    setAdminCodeError("");
    try {
      const res = await fetch("/api/auth/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: data.code }),
      });
      const result = await res.json().catch(() => ({ valid: false }));

      if (result.valid) {
        setStoredAdminCode(data.code);
        setUser({
          id: "admin-1",
          name: t("siteOwner.name"),
          email: "admin@healingspace.com",
          role: "admin",
          avatar: undefined,
        });
        toast.success(t("common.success"));
        navigate("admin");
      } else {
        setAdminCodeError(t("adminAccess.wrongCode"));
      }
    } catch {
      setAdminCodeError(t("common.serverError"));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Helper: Send Firebase ID token to backend ──
  const sendTokenToBackend = async (idToken: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      // Handle non-JSON responses (e.g., Vercel HTML error pages)
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text().catch(() => "");
        console.error("[Google Auth] Backend returned non-JSON:", res.status, text.substring(0, 200));
        toast.error(
          locale === "ar"
            ? "خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً"
            : "Server error. Please try again later",
          { duration: 8000 }
        );
        return false;
      }

      const data = await res.json();

      if (res.ok && data.success) {
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          avatar: data.user.avatar,
          phone: data.user.phone,
        });
        toast.success(
          data.isNewUser
            ? (locale === "ar" ? "تم إنشاء الحساب بنجاح! مرحباً بك" : "Account created successfully! Welcome")
            : (locale === "ar" ? "تم تسجيل الدخول بنجاح!" : "Login successful!")
        );
        navigate("home");
        return true;
      } else {
        const errorMsg = data.error || "Google login failed";
        console.error("[Google Auth] Backend error:", errorMsg);
        toast.error(
          locale === "ar"
            ? "فشل التحقق من حساب غوغل. يرجى المحاولة مرة أخرى"
            : "Google account verification failed. Please try again",
          { duration: 8000 }
        );
        return false;
      }
    } catch (fetchErr) {
      console.error("[Google Auth] Fetch to backend failed:", fetchErr);
      toast.error(
        locale === "ar"
          ? "خطأ في الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت"
          : "Server connection error. Please check your internet connection",
        { duration: 8000 }
      );
      return false;
    }
  };

  // ── Google Login ──
  // Primary: signInWithPopup — works when popup is not blocked.
  // Fallback: signInWithRedirect — used when popup fails due to network/popup issues.
  // The redirect result is handled by the useEffect above AND AppShell's
  // onAuthStateChanged safety net.
  const onGoogleLogin = async () => {
    // Mutex: prevent concurrent sign-in attempts
    if (isGoogleSignInInProgress()) {
      console.log("[Google Auth] Sign-in already in progress, ignoring click");
      return;
    }
    setGoogleSignInInProgress(true);
    setIsLoading(true);

    try {
      console.log("[Google Auth] Starting popup sign-in...");
      const result = await signInWithPopup(auth, googleProvider);

      // Popup succeeded — we have the credential and user immediately
      const email = result.user.email;
      console.log("[Google Auth] Popup sign-in successful for:", email);

      // Get the Firebase ID token and send to backend
      const idToken = await result.user.getIdToken();
      console.log("[Google Auth] Got ID token, sending to backend...");
      await sendTokenToBackend(idToken);
    } catch (error: any) {
      const code = error?.code || "";
      const msg = error?.message || "";
      console.error("[Google Auth] signInWithPopup error:", code, msg);

      // User closed the popup — not an error, just cancelled
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        console.log("[Google Auth] User closed the popup");
      } else if (code === "auth/unauthorized-domain") {
        const currentDomain = window.location.hostname;
        toast.error(
          locale === "ar"
            ? `النطاق (${currentDomain}) غير مصرح به في Firebase. يرجى إضافته في: Firebase Console → Authentication → Settings → Authorized domains`
            : `Domain (${currentDomain}) not authorized. Add it in: Firebase Console → Authentication → Settings → Authorized domains`,
          { duration: 15000 }
        );
      } else if (code === "auth/operation-not-allowed") {
        toast.error(
          locale === "ar"
            ? "تسجيل الدخول بغوغل غير مفعّل. يرجى تفعيله في: Firebase Console → Authentication → Sign-in method"
            : "Google sign-in is not enabled. Enable it in: Firebase Console → Authentication → Sign-in method",
          { duration: 15000 }
        );
      } else if (code === "auth/popup-blocked") {
        // Popup blocked — fall back to redirect
        console.log("[Google Auth] Popup blocked, falling back to redirect...");
        toast.info(
          locale === "ar"
            ? "جاري التحويل إلى صفحة غوغل لتسجيل الدخول..."
            : "Redirecting to Google sign-in...",
          { duration: 3000 }
        );
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: any) {
          console.error("[Google Auth] signInWithRedirect also failed:", redirectErr);
          toast.error(
            locale === "ar"
              ? "فشل تسجيل الدخول. يرجى السماح بالنوافذ المنبثقة أو المحاولة مرة أخرى"
              : "Sign-in failed. Please allow popups or try again",
            { duration: 8000 }
          );
        }
        return; // Don't reset loading — redirect is in progress
      } else if (code === "auth/network-request-failed") {
        // Network error — fall back to redirect method
        console.log("[Google Auth] Network error with popup, falling back to redirect...");
        toast.info(
          locale === "ar"
            ? "جاري التحويل إلى صفحة غوغل لتسجيل الدخول..."
            : "Redirecting to Google sign-in...",
          { duration: 3000 }
        );
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: any) {
          console.error("[Google Auth] signInWithRedirect also failed:", redirectErr);
          toast.error(
            locale === "ar"
              ? "فشل الاتصال بغوغل. يرجى التحقق من اتصالك بالإنترنت والمحاولة لاحقاً"
              : "Failed to connect to Google. Please check your internet connection and try later",
            { duration: 8000 }
          );
        }
        return; // Don't reset loading — redirect is in progress
      } else {
        // Any other error — show the actual error code for debugging
        console.error("[Google Auth] Unhandled error code:", code);
        toast.error(
          locale === "ar"
            ? `فشل تسجيل الدخول بغوغل (${code}). يرجى المحاولة مرة أخرى`
            : `Google sign-in failed (${code}). Please try again`,
          { duration: 10000 }
        );
      }
    } finally {
      setGoogleSignInInProgress(false);
      setIsLoading(false);
    }
  };

  const ownerName = t("siteOwner.name");

  return (
    <div className="flex min-h-screen" dir={dir}>
      {/* LEFT PANEL – Decorative (desktop only) */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-teal-700 via-emerald-600 to-cyan-600 lg:flex lg:items-center lg:justify-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-1/4 -left-1/4 h-[50%] w-[50%] rounded-full bg-white/4 blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 h-[45%] w-[45%] rounded-full bg-cyan-400/5 blur-3xl" />
        </div>

        <motion.div
          className="relative z-10 max-w-md px-8 text-center text-white"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.2 } } }}
        >
          <motion.div variants={fadeUp} custom={0} className="mb-6">
            <Heart className="mx-auto size-16 drop-shadow-lg" />
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={1}
            className="mb-2 text-3xl font-bold leading-tight"
          >
            {t("home.heroTitle")}
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1.5}
            className="mb-4 text-lg font-medium text-white/90"
          >
            {ownerName}
          </motion.p>
          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg leading-relaxed text-white/85"
          >
            {t("home.heroDescription")}
          </motion.p>
          <motion.div
            variants={fadeUp}
            custom={3}
            className="mt-8 flex items-center justify-center gap-6 text-white/70"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-5" />
              <span className="text-sm">1000+ طالب</span>
            </div>
            <div className="flex items-center gap-2">
              <Leaf className="size-5" />
              <span className="text-sm">50+ دورة</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* RIGHT PANEL – Form */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <motion.div
          className="w-full max-w-md"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {/* Logo */}
          <motion.div variants={fadeUp} custom={0} className="mb-8 text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-400 shadow-lg shadow-teal-500/25">
              <Heart className="size-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">
              {isAdminMode ? t("adminAccess.title") : t("auth.login")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdminMode ? t("adminAccess.description") : (
                <>
                  {t("home.heroSubtitle")} — {ownerName}
                </>
              )}
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div variants={fadeUp} custom={1}>
            <Card className="border-0 shadow-xl">
              <CardHeader className="pb-2" />
              <CardContent className="pt-0">
                <AnimatePresence mode="wait">
                  {/* ADMIN LOGIN MODE */}
                  {isAdminMode ? (
                    <motion.div
                      key="admin"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <div className="mb-6 flex justify-center">
                        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
                          <Shield className="size-8 text-white" />
                        </div>
                      </div>

                      <Form {...adminForm}>
                        <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-5">
                          <FormField
                            control={adminForm.control}
                            name="code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <KeyRound className="size-4 text-amber-500" />
                                  {t("adminAccess.code")}
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                      type="text"
                                      placeholder={t("adminAccess.codePlaceholder")}
                                      className="ps-10 text-center text-lg tracking-widest font-mono"
                                      maxLength={10}
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                {adminCodeError && (
                                  <p className="mt-1 text-sm text-destructive">{adminCodeError}</p>
                                )}
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button
                            type="submit"
                            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-5 text-base font-semibold shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <span className="flex items-center gap-2">
                                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                {t("common.loading")}
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Shield className="size-4" />
                                {t("adminAccess.submit")}
                              </span>
                            )}
                          </Button>
                        </form>
                      </Form>
                    </motion.div>
                  ) : (
                    /* MEMBER LOGIN MODE */
                    <motion.div
                      key="member"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t("auth.email")}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                      type="email"
                                      placeholder="example@email.com"
                                      className="ps-10"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between">
                                  <FormLabel>{t("auth.password")}</FormLabel>
                                  <button
                                    type="button"
                                    className="text-xs font-medium text-teal-600 hover:text-teal-700 hover:underline"
                                    onClick={() => {
                                    toast.info(
                                      locale === "ar" ? "لإعادة تعيين كلمة المرور، يرجى التواصل معنا عبر البريد الإلكتروني أو وسائل التواصل الاجتماعي"
                                      : "To reset your password, please contact us via email or social media",
                                      { duration: 8000 }
                                    );
                                  }}
                                  >
                                    {t("auth.forgotPassword")}
                                  </button>
                                </div>
                                <FormControl>
                                  <div className="relative">
                                    <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                      type={showPassword ? "text" : "password"}
                                      placeholder="••••••••"
                                      className="pe-10 ps-10"
                                      {...field}
                                    />
                                    <button
                                      type="button"
                                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                      onClick={() => setShowPassword(!showPassword)}
                                    >
                                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button
                            type="submit"
                            className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-5 text-base font-semibold shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30"
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <span className="flex items-center gap-2">
                                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                {t("common.loading")}
                              </span>
                            ) : (
                              t("auth.login")
                            )}
                          </Button>
                        </form>
                      </Form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>

              <CardFooter className="flex-col gap-4">
                <div className="flex w-full items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">
                    {isAdminMode ? t("adminAccess.orLogin") : "أو تابع باستخدام"}
                  </span>
                  <Separator className="flex-1" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 rounded-xl py-4"
                  onClick={() => {
                    setIsAdminMode(!isAdminMode);
                    setAdminCodeError("");
                  }}
                >
                  {isAdminMode ? (
                    <>
                      <ArrowRight className="size-4" />
                      {t("adminAccess.backToLogin")}
                    </>
                  ) : (
                    <>
                      <Shield className="size-4 text-amber-500" />
                      {t("adminAccess.enterAdminCode")}
                    </>
                  )}
                </Button>

                {/* Google Button (member mode only) */}
                {!isAdminMode && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 rounded-xl py-4"
                    onClick={onGoogleLogin}
                  >
                    <svg className="size-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t("auth.loginWithGoogle")}
                  </Button>
                )}

                {!isAdminMode && (
                  <p className="text-sm text-muted-foreground">
                    {t("auth.noAccount")}{" "}
                    <button
                      type="button"
                      className="font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                      onClick={() => navigate("register")}
                    >
                      {t("auth.register")}
                    </button>
                  </p>
                )}
              </CardFooter>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
