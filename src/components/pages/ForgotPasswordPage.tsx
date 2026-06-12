"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Mail,
  Heart,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
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
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const emailSchema = z.object({
  email: z.string().email("يرجى إدخال بريد إلكتروني صحيح"),
});

const birthdaySchema = z.object({
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "يرجى إدخال تاريخ ميلاد صحيح"),
});

const passwordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
      .regex(/[A-Z]/, "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل")
      .regex(/[a-z]/, "كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل")
      .regex(/[0-9]/, "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل"),
    confirmPassword: z.string().min(1, "يرجى تأكيد كلمة المرور"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "كلمات المرور غير متطابقة",
    path: ["confirmPassword"],
  });

type EmailFormValues = z.infer<typeof emailSchema>;
type BirthdayFormValues = z.infer<typeof birthdaySchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

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
/*  Step type                                                          */
/* ------------------------------------------------------------------ */

type Step = "email" | "birthday" | "password" | "success";

/* ================================================================== */
/*  ForgotPasswordPage                                                 */
/* ================================================================== */

export default function ForgotPasswordPage() {
  const { t, locale } = useTranslation();
  const navigate = useAppStore((s) => s.navigate);
  const dir = useAppStore((s) => (s.locale === "ar" ? "rtl" : "ltr"));

  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email form
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  // Birthday form
  const birthdayForm = useForm<BirthdayFormValues>({
    resolver: zodResolver(birthdaySchema),
    defaultValues: { birthday: "" },
  });

  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  /* ---- Step handlers ---- */

  const onEmailSubmit = async (data: EmailFormValues) => {
    setIsLoading(true);
    try {
      // Check if user exists in the system
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await res.json();

      // We always move to the next step to avoid email enumeration
      // The birthday check will fail if email doesn't exist
      setUserEmail(data.email);
      setStep("birthday");
    } catch {
      toast.error(t("common.serverError"));
    } finally {
      setIsLoading(false);
    }
  };

  const onBirthdaySubmit = async (data: BirthdayFormValues) => {
    setIsLoading(true);
    try {
      // We don't verify birthday here — we verify everything together at the final step
      // This avoids revealing whether the email exists
      setStep("password");
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          birthday: birthdayForm.getValues("birthday"),
          newPassword: data.newPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        // Map error messages to locale
        const apiError = result.error || "";
        if (apiError.includes("Invalid email or birthday")) {
          toast.error(
            locale === "ar"
              ? "البريد الإلكتروني أو تاريخ الميلاد غير صحيح. يرجى التحقق والمحاولة مرة أخرى."
              : "Invalid email or birthday. Please check your information and try again."
          );
          // Go back to birthday step to let them retry
          setStep("birthday");
        } else if (apiError.includes("Password must") || apiError.includes("Password is")) {
          toast.error(
            locale === "ar"
              ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وحرف صغير ورقم"
              : "Password must be at least 8 characters with uppercase, lowercase, and a number"
          );
        } else if (apiError.includes("Too many")) {
          toast.error(
            locale === "ar"
              ? "طلبات كثيرة. يرجى المحاولة لاحقاً"
              : "Too many requests. Please try again later"
          );
        } else {
          toast.error(apiError || t("common.serverError"));
        }
        return;
      }

      // Success
      setStep("success");
      toast.success(
        locale === "ar"
          ? "تم تغيير كلمة المرور بنجاح!"
          : "Password changed successfully!"
      );
    } catch {
      toast.error(t("common.serverError"));
    } finally {
      setIsLoading(false);
    }
  };

  const BackArrow = locale === "ar" ? ArrowRight : ArrowLeft;

  /* ---- Decorative Left Panel (reused) ---- */
  const LeftPanel = ({
    icon: Icon,
    title,
    description,
  }: {
    icon: React.ElementType;
    title: string;
    description: string;
  }) => (
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
          <Icon className="mx-auto size-16 drop-shadow-lg" />
        </motion.div>
        <motion.h2
          variants={fadeUp}
          custom={1}
          className="mb-4 text-3xl font-bold leading-tight"
        >
          {title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          custom={2}
          className="text-lg leading-relaxed text-white/85"
        >
          {description}
        </motion.p>
      </motion.div>
    </div>
  );

  /* ---- Step indicators ---- */
  const stepLabels: Record<Step, { ar: string; en: string }> = {
    email: { ar: "البريد الإلكتروني", en: "Email" },
    birthday: { ar: "تاريخ الميلاد", en: "Birthday" },
    password: { ar: "كلمة المرور الجديدة", en: "New Password" },
    success: { ar: "تم بنجاح", en: "Success" },
  };

  const stepOrder: Step[] = ["email", "birthday", "password", "success"];
  const currentStepIndex = stepOrder.indexOf(step);

  /* ---- Render ---- */

  // Success state — full screen
  if (step === "success") {
    return (
      <div className="flex min-h-screen" dir={dir}>
        <LeftPanel
          icon={CheckCircle}
          title={locale === "ar" ? "تم بنجاح!" : "Success!"}
          description={
            locale === "ar"
              ? "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة."
              : "Your password has been changed successfully. You can now log in with your new password."
          }
        />
        <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
          <motion.div
            className="w-full max-w-md"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          >
            <motion.div variants={fadeUp} custom={0} className="mb-8 text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 shadow-lg">
                <CheckCircle className="size-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold">
                {locale === "ar" ? "تم تغيير كلمة المرور" : "Password Changed"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "ar"
                  ? "يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة"
                  : "You can now log in with your new password"}
              </p>
            </motion.div>
            <motion.div variants={fadeUp} custom={1}>
              <Card className="border-0 shadow-xl">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center gap-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      {locale === "ar"
                        ? "تم تحديث كلمة المرور بنجاح في النظام. اضغط على الزر أدناه لتسجيل الدخول."
                        : "Your password has been updated in the system. Click the button below to log in."}
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-5 text-base font-semibold shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30"
                    onClick={() => navigate("login")}
                  >
                    {locale === "ar" ? "الذهاب لتسجيل الدخول" : "Go to Login"}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" dir={dir}>
      {/* Left Panel */}
      <LeftPanel
        icon={step === "email" ? Mail : step === "birthday" ? Calendar : Lock}
        title={
          step === "email"
            ? locale === "ar"
              ? "استعادة كلمة المرور"
              : "Recover Your Password"
            : step === "birthday"
            ? locale === "ar"
              ? "التحقق من الهوية"
              : "Verify Your Identity"
            : locale === "ar"
            ? "كلمة المرور الجديدة"
            : "New Password"
        }
        description={
          step === "email"
            ? locale === "ar"
              ? "أدخل بريدك الإلكتروني وسنتحقق من حسابك باستخدام تاريخ ميلادك لإعادة تعيين كلمة المرور."
              : "Enter your email and we'll verify your identity using your birthday to reset your password."
            : step === "birthday"
            ? locale === "ar"
              ? "أدخل تاريخ ميلادك للتأكد من هويتك. هذه الخطوة ضرورية لحماية حسابك."
              : "Enter your birthday to confirm your identity. This step is necessary to protect your account."
            : locale === "ar"
            ? "أدخل كلمة المرور الجديدة لحسابك. تأكد من اختيار كلمة مرور قوية يصعب تخمينها."
            : "Enter your new password. Make sure to choose a strong password that's hard to guess."
        }
      />

      {/* Right Panel */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <motion.div
          className="w-full max-w-md"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {/* Step Indicator */}
          <motion.div variants={fadeUp} custom={0} className="mb-6">
            <div className="flex items-center justify-center gap-2">
              {stepOrder.slice(0, 3).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      i <= currentStepIndex
                        ? "bg-teal-600 text-white shadow-md"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  {i < 2 && (
                    <div
                      className={`h-0.5 w-8 transition-all ${
                        i < currentStepIndex ? "bg-teal-600" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {stepLabels[step][locale === "ar" ? "ar" : "en"]}
            </p>
          </motion.div>

          {/* Logo */}
          <motion.div variants={fadeUp} custom={0} className="mb-6 text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-400 shadow-lg shadow-teal-500/25">
              {step === "email" ? (
                <Mail className="size-7 text-white" />
              ) : step === "birthday" ? (
                <Calendar className="size-7 text-white" />
              ) : (
                <Lock className="size-7 text-white" />
              )}
            </div>
            <h1 className="text-2xl font-bold">
              {step === "email"
                ? locale === "ar"
                  ? "نسيت كلمة المرور؟"
                  : "Forgot Password?"
                : step === "birthday"
                ? locale === "ar"
                  ? "تأكيد الهوية"
                  : "Confirm Identity"
                : locale === "ar"
                ? "كلمة المرور الجديدة"
                : "New Password"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === "email"
                ? locale === "ar"
                  ? "أدخل بريدك الإلكتروني المسجل لدينا"
                  : "Enter your registered email"
                : step === "birthday"
                ? locale === "ar"
                  ? "أدخل تاريخ ميلادك للتحقق"
                  : "Enter your birthday to verify"
                : locale === "ar"
                ? "أدخل كلمة المرور الجديدة"
                : "Enter your new password"}
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div variants={fadeUp} custom={1}>
            <Card className="border-0 shadow-xl">
              <CardHeader className="pb-2" />

              {/* ---- EMAIL STEP ---- */}
              {step === "email" && (
                <CardContent className="pt-0">
                  <Form {...emailForm}>
                    <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-5">
                      <FormField
                        control={emailForm.control}
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
                      <Button
                        type="submit"
                        className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-5 text-base font-semibold shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            {locale === "ar" ? "جارٍ التحقق..." : "Verifying..."}
                          </span>
                        ) : (
                          locale === "ar" ? "التالي" : "Next"
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              )}

              {/* ---- BIRTHDAY STEP ---- */}
              {step === "birthday" && (
                <CardContent className="pt-0">
                  <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm text-muted-foreground">
                      {locale === "ar"
                        ? `سيتم التحقق من حساب البريد: ${userEmail}`
                        : `Verifying account for: ${userEmail}`}
                    </p>
                  </div>
                  <Form {...birthdayForm}>
                    <form onSubmit={birthdayForm.handleSubmit(onBirthdaySubmit)} className="space-y-5">
                      <FormField
                        control={birthdayForm.control}
                        name="birthday"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("auth.birthday")}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Calendar className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  type="date"
                                  className="ps-10"
                                  max={new Date().toISOString().split("T")[0]}
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 rounded-xl py-5"
                          onClick={() => setStep("email")}
                        >
                          <BackArrow className="size-4 me-2" />
                          {locale === "ar" ? "رجوع" : "Back"}
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-5 text-base font-semibold shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <span className="flex items-center gap-2">
                              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              {locale === "ar" ? "جارٍ التحقق..." : "Verifying..."}
                            </span>
                          ) : (
                            locale === "ar" ? "التالي" : "Next"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              )}

              {/* ---- PASSWORD STEP ---- */}
              {step === "password" && (
                <CardContent className="pt-0">
                  {/* Password Requirements */}
                  <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium mb-2">
                      {locale === "ar"
                        ? "متطلبات كلمة المرور:"
                        : "Password requirements:"}
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>{locale === "ar" ? "- 8 أحرف على الأقل" : "- At least 8 characters"}</li>
                      <li>{locale === "ar" ? "- حرف كبير واحد على الأقل (A-Z)" : "- At least one uppercase letter (A-Z)"}</li>
                      <li>{locale === "ar" ? "- حرف صغير واحد على الأقل (a-z)" : "- At least one lowercase letter (a-z)"}</li>
                      <li>{locale === "ar" ? "- رقم واحد على الأقل (0-9)" : "- At least one number (0-9)"}</li>
                    </ul>
                  </div>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-5">
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {locale === "ar" ? "كلمة المرور الجديدة" : "New Password"}
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  type={showNewPassword ? "text" : "password"}
                                  placeholder="••••••••"
                                  className="pe-10 ps-10"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                  {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {locale === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
                            </FormLabel>
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
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 rounded-xl py-5"
                          onClick={() => setStep("birthday")}
                        >
                          <BackArrow className="size-4 me-2" />
                          {locale === "ar" ? "رجوع" : "Back"}
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-5 text-base font-semibold shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <span className="flex items-center gap-2">
                              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              {locale === "ar" ? "جارٍ التحديث..." : "Updating..."}
                            </span>
                          ) : (
                            locale === "ar" ? "تغيير كلمة المرور" : "Change Password"
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              )}

              <CardFooter>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                  onClick={() => navigate("login")}
                >
                  <BackArrow className="size-4" />
                  {locale === "ar" ? "العودة لتسجيل الدخول" : "Back to Login"}
                </button>
              </CardFooter>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
