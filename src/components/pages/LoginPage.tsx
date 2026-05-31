"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Lock, Eye, EyeOff, Heart, Sparkles, Leaf } from "lucide-react";
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
import { signInWithGoogleGIS } from "@/lib/google-gis";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Schemas                                                             */
/* ------------------------------------------------------------------ */

const loginSchema = z.object({
  email: z.string().email("يرجى إدخال بريد إلكتروني صحيح"),
  password: z.string().min(1, "يرجى إدخال كلمة المرور"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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

/* ================================================================== */
/*  LoginPage                                                          */
/*  Admin logs in via email: Admine@gmail.com with password = admin code */
/* ================================================================== */

export default function LoginPage() {
  const { t, locale } = useTranslation();
  const navigate = useAppStore((s) => s.navigate);
  const setUser = useAppStore((s) => s.setUser);
  const dir = useAppStore((s) => (s.locale === "ar" ? "rtl" : "ltr"));
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // ── OAuth callback handling is now done in AppShell.tsx ──
  // AppShell handles both ?login=success and ?error=xxx parameters
  // from Google OAuth callbacks, since the redirect goes to / (homepage),
  // not to /login. This useEffect is kept as a fallback for /login URLs.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const loginSuccess = params.get("login");
    if (error || loginSuccess === "success") {
      // AppShell will handle this, but clean URL here too as fallback
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [locale]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
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
      // If admin login, store the password as admin code in localStorage
      // so that adminHeaders() sends it via X-Admin-Code for API calls
      if (result.user.role === "admin") {
        setStoredAdminCode(data.password);
      }
      toast.success(t("common.success"));
      // Use SPA navigation for smooth transition
      if (result.user.role === "admin") {
        navigate("admin");
      } else {
        navigate("home");
      }
    } catch {
      toast.error(t("common.serverError"));
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    useAppStore.getState().clearUserBeforeLogin();
    try {
      // Step 1: Get credential from Google Identity Services (GIS)
      // GIS uses postMessage — no redirect_uri needed!
      const credential = await signInWithGoogleGIS();

      // Step 2: Determine if it's a JWT credential or access token
      const isAccessToken = credential.startsWith("access_token:");
      const body = isAccessToken
        ? { accessToken: credential }
        : { credential };

      // Step 3: Send to our server for verification and session creation
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(data.error || "Google sign-in failed");
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Google sign-in failed");
      }

      // Step 4: Set user in store and navigate
      setUser({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        avatar: data.user.avatar,
        phone: data.user.phone,
      });

      toast.success(locale === "ar" ? "تم تسجيل الدخول بنجاح!" : "Logged in successfully!");

      if (data.user.role === "admin") {
        navigate("admin");
      } else {
        navigate("home");
      }
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      const msg = error?.message || "";
      if (msg.includes("popup-closed-by-user") || msg.includes("cancelled")) {
        // User closed the popup — no error needed
      } else if (msg.includes("popup-blocked") || msg.includes("not available")) {
        toast.error(
          locale === "ar"
            ? "تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة في المتصفح"
            : "Popup was blocked. Please allow popups in your browser",
          { duration: 8000 }
        );
      } else if (msg.includes("Failed to load Google")) {
        toast.error(
          locale === "ar"
            ? "فشل تحميل خدمة Google. تحقق من اتصالك بالإنترنت"
            : "Failed to load Google service. Check your internet connection",
          { duration: 8000 }
        );
      } else {
        toast.error(
          locale === "ar"
            ? `فشل تسجيل الدخول بغوغل: ${msg}`
            : `Google sign-in failed: ${msg}`,
          { duration: 5000 }
        );
      }
    } finally {
      setIsGoogleLoading(false);
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
              {t("auth.login")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <>
                {t("home.heroSubtitle")} — {ownerName}
              </>
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div variants={fadeUp} custom={1}>
            <Card className="border-0 shadow-xl">
              <CardHeader className="pb-2" />
              <CardContent className="pt-0">
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
              </CardContent>

              <CardFooter className="flex-col gap-4">
                {/* Google Sign-In Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-3 rounded-xl py-5 text-base font-medium"
                  onClick={onGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                      {locale === "ar" ? "جارٍ تسجيل الدخول..." : "Signing in..."}
                    </span>
                  ) : (
                    <>
                      <svg className="size-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      {locale === "ar" ? "تسجيل الدخول بغوغل" : "Sign in with Google"}
                    </>
                  )}
                </Button>

                <div className="flex w-full items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">
                    {"أو"}
                  </span>
                  <Separator className="flex-1" />
                </div>

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
              </CardFooter>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
