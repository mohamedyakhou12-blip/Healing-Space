"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Heart,
  User,
  Phone,
  Sparkles,
  Leaf,
  ShieldCheck,
} from "lucide-react";
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
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, getIdToken } from "firebase/auth";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const registerSchema = z
  .object({
    name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
    email: z.string().email("يرجى إدخال بريد إلكتروني صحيح"),
    phone: z.string().optional(),
    password: z.string()
      .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
      .regex(/[A-Z]/, "يجب أن تحتوي على حرف كبير")
      .regex(/[a-z]/, "يجب أن تحتوي على حرف صغير")
      .regex(/[0-9]/, "يجب أن تحتوي على رقم"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

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
/*  RegisterPage                                                       */
/* ================================================================== */

export default function RegisterPage() {
  const { t, locale } = useTranslation();
  const navigate = useAppStore((s) => s.navigate);
  const setUser = useAppStore((s) => s.setUser);
  const dir = useAppStore((s) => (s.locale === "ar" ? "rtl" : "ltr"));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    useAppStore.getState().clearUserBeforeLogin();
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          phone: data.phone || undefined,
        }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({ error: "حدث خطأ أثناء التسجيل" }));
        let displayError: string;
        const apiError = result.error || "";
        if (apiError.includes("Registration failed") || apiError.includes("different details") || res.status === 409) {
          displayError = locale === "ar" ? "البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول بدلاً من ذلك" : "This email is already registered. Please login instead";
        } else if (apiError.includes("Password must")) {
          displayError = locale === "ar" ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وحرف صغير ورقم" : "Password must be at least 8 characters with uppercase, lowercase, and a number";
        } else if (apiError.includes("Too many")) {
          displayError = locale === "ar" ? "محاولات كثيرة. يرجى المحاولة لاحقاً" : "Too many attempts. Please try again later";
        } else {
          displayError = apiError || (locale === "ar" ? "حدث خطأ أثناء التسجيل" : "Registration failed");
        }
        toast.error(displayError, { duration: 5000 });
        return;
      }

      const result = await res.json();

      setUser({
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        avatar: result.user.avatar,
        phone: result.user.phone,
      });
      toast.success("تم إنشاء الحساب بنجاح! مرحباً بك");
      // Use full page navigation
      window.location.href = "/";
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    useAppStore.getState().clearUserBeforeLogin();
    try {
      // Step 1: Open Google sign-in popup via Firebase Client SDK
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Step 2: Get the Firebase ID token to verify on the server
      const idToken = await getIdToken(user);

      // Step 3: Send ID token to our server to create a session
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
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
      const errorCode = error?.code || "";
      if (errorCode === "auth/unauthorized-domain") {
        toast.error(
          locale === "ar"
            ? "هذا النطاق غير مصرح به. يرجى إضافة نطاق الموقع في إعدادات Firebase"
            : "This domain is not authorized. Please add it in Firebase Console settings",
          { duration: 8000 }
        );
      } else if (errorCode === "auth/popup-closed-by-user" || errorCode === "auth/cancelled-popup-request") {
        // User closed the popup — no error needed
      } else if (errorCode === "auth/popup-blocked") {
        toast.error(
          locale === "ar"
            ? "تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة في المتصفح"
            : "Popup was blocked. Please allow popups in your browser",
          { duration: 8000 }
        );
      } else {
        const msg = error?.message || "";
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

  return (
    <div className="flex min-h-screen" dir={dir}>
      {/* LEFT PANEL – Decorative (desktop only) */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-600 lg:flex lg:items-center lg:justify-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-1/4 -right-1/4 h-[50%] w-[50%] rounded-full bg-white/4 blur-3xl" />
          <div className="absolute -bottom-1/4 -left-1/4 h-[45%] w-[45%] rounded-full bg-teal-400/5 blur-3xl" />
        </div>

        <motion.div
          className="relative z-10 max-w-md px-8 text-center text-white"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.2 } } }}
        >
          <motion.div variants={fadeUp} custom={0} className="mb-6">
            <ShieldCheck className="mx-auto size-16 drop-shadow-lg" />
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={1}
            className="mb-4 text-3xl font-bold leading-tight"
          >
            انضم إلى مجتمع الشفاء
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg leading-relaxed text-white/85"
          >
            أنشئ حسابك الآن واحصل على وصول فوري إلى مكتبة واسعة من المحتوى التعليمي والعلاجي المتميز.
          </motion.p>
          <motion.div
            variants={fadeUp}
            custom={3}
            className="mt-8 flex items-center justify-center gap-6 text-white/70"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-5" />
              <span className="text-sm">محتوى حصري</span>
            </div>
            <div className="flex items-center gap-2">
              <Leaf className="size-5" />
              <span className="text-sm">دعم متواصل</span>
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
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/25">
              <Heart className="size-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">{t("auth.register")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ابدأ رحلة التعافي والتغيير
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div variants={fadeUp} custom={1}>
            <Card className="border-0 shadow-xl">
              <CardHeader className="pb-2" />
              <CardContent className="pt-0">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.name")}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type="text"
                                placeholder={t("auth.name")}
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
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("auth.phone")}{" "}
                            <span className="text-xs text-muted-foreground">
                              (اختياري)
                            </span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type="tel"
                                placeholder="+213 xxx xxx xxx"
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
                          <FormLabel>{t("auth.password")}</FormLabel>
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

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("auth.confirmPassword")}</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="pe-10 ps-10"
                                {...field}
                              />
                              <button
                                type="button"
                                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 py-5 text-base font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          {t("common.loading")}
                        </span>
                      ) : (
                        t("auth.register")
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>

              <CardFooter className="flex-col gap-5">
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
                      {locale === "ar" ? "التسجيل بغوغل" : "Sign up with Google"}
                    </>
                  )}
                </Button>

                <p className="text-sm text-muted-foreground">
                  {t("auth.hasAccount")}{" "}
                  <button
                    type="button"
                    className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                    onClick={() => navigate("login")}
                  >
                    {t("auth.login")}
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
