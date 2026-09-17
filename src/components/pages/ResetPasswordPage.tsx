"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Lock,
  Eye,
  EyeOff,
  Heart,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
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
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const resetSchema = z
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

type ResetFormValues = z.infer<typeof resetSchema>;

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
/*  ResetPasswordPage                                                  */
/* ================================================================== */

export default function ResetPasswordPage() {
  const { t, locale } = useTranslation();
  const navigate = useAppStore((s) => s.navigate);
  const setUser = useAppStore((s) => s.setUser);
  const dir = useAppStore((s) => (s.locale === "ar" ? "rtl" : "ltr"));
  const [isLoading, setIsLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  // Verify the OOB code on mount
  useEffect(() => {
    async function verify() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("oobCode");
        const mode = params.get("mode");

        if (!code || mode !== "resetPassword") {
          setVerifyError(
            locale === "ar"
              ? "رابط إعادة التعيين غير صالح أو منتهي الصلاحية"
              : "Invalid or expired reset link"
          );
          setVerifying(false);
          return;
        }

        setOobCode(code);

        // Verify the code and get the user's email
        const email = await verifyPasswordResetCode(auth, code);
        setUserEmail(email);
        setVerifying(false);
      } catch (error: any) {
        console.error("Verify reset code error:", error);
        const code = error?.code || "";
        let message: string;
        if (code === "auth/expired-action-code") {
          message =
            locale === "ar"
              ? "رابط إعادة التعيين منتهي الصلاحية. يرجى طلب رابط جديد."
              : "The reset link has expired. Please request a new one.";
        } else if (code === "auth/invalid-action-code") {
          message =
            locale === "ar"
              ? "رابط إعادة التعيين غير صالح. ربما تم استخدامه بالفعل."
              : "Invalid reset link. It may have already been used.";
        } else if (code === "auth/user-not-found") {
          message =
            locale === "ar"
              ? "لم يتم العثور على حساب مرتبط بهذا البريد الإلكتروني في نظام المصادقة."
              : "No account found associated with this email in the auth system.";
        } else {
          message =
            locale === "ar"
              ? "حدث خطأ أثناء التحقق من الرابط. يرجى طلب رابط جديد."
              : "An error occurred while verifying the link. Please request a new one.";
        }
        setVerifyError(message);
        setVerifying(false);
      }
    }

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (data: ResetFormValues) => {
    if (!oobCode || !userEmail) return;
    setIsLoading(true);
    try {
      // Step 1: Confirm the password reset in Firebase Auth
      await confirmPasswordReset(auth, oobCode, data.newPassword);

      // Step 2: Sign in with the new password to get an ID token
      // This is needed to sync the new password to our Firestore database
      const credential = await signInWithEmailAndPassword(
        auth,
        userEmail,
        data.newPassword
      );
      const idToken = await credential.user.getIdToken();

      // Step 3: Sync the new password to our Firestore database (bcrypt hash)
      const syncRes = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          newPassword: data.newPassword,
        }),
      });

      if (!syncRes.ok) {
        const result = await syncRes.json().catch(() => ({}));
        console.error("Password sync error:", result);
        // Don't block the user — the Firebase Auth password was already reset
        // They can still use the "forgot password" flow again if Firestore sync failed
      }

      // Step 4: Show success
      setResetSuccess(true);
      toast.success(
        locale === "ar"
          ? "تم تغيير كلمة المرور بنجاح!"
          : "Password changed successfully!"
      );

      // Sign out from Firebase Auth client (we use our own session system)
      try {
        await auth.signOut();
      } catch {
        // Ignore
      }
    } catch (error: any) {
      console.error("Reset password error:", error);
      const code = error?.code || "";
      let message: string;
      if (code === "auth/expired-action-code") {
        message =
          locale === "ar"
            ? "انتهت صلاحية الرابط. يرجى طلب رابط جديد."
            : "The link has expired. Please request a new one.";
      } else if (code === "auth/invalid-action-code") {
        message =
          locale === "ar"
            ? "الرابط غير صالح. ربما تم استخدامه بالفعل."
            : "Invalid link. It may have already been used.";
      } else if (code === "auth/weak-password") {
        message =
          locale === "ar"
            ? "كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى."
            : "Password is too weak. Please choose a stronger password.";
      } else if (code === "auth/user-not-found") {
        message =
          locale === "ar"
            ? "لم يتم العثور على الحساب في نظام المصادقة. يرجى التواصل مع الدعم."
            : "Account not found in auth system. Please contact support.";
      } else {
        message =
          locale === "ar"
            ? "حدث خطأ أثناء إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى."
            : "An error occurred while resetting your password. Please try again.";
      }
      toast.error(message, { duration: 6000 });
    } finally {
      setIsLoading(false);
    }
  };

  const BackArrow = locale === "ar" ? ArrowRight : ArrowLeft;

  // ── Loading state (verifying OOB code) ──
  if (verifying) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        dir={dir}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
          <p className="text-muted-foreground">
            {locale === "ar"
              ? "جارٍ التحقق من الرابط..."
              : "Verifying link..."}
          </p>
        </div>
      </div>
    );
  }

  // ── Error state (invalid/expired OOB code) ──
  if (verifyError) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        dir={dir}
      >
        <motion.div
          className="w-full max-w-md"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <Card className="border-0 shadow-xl">
            <CardContent className="pt-8">
              <div className="flex flex-col items-center text-center gap-4 py-6">
                <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">
                    {locale === "ar"
                      ? "الرابط غير صالح"
                      : "Invalid Link"}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {verifyError}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 py-5 text-base font-semibold"
                onClick={() => navigate("forgot-password")}
              >
                {locale === "ar"
                  ? "طلب رابط جديد"
                  : "Request New Link"}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Success state ──
  if (resetSuccess) {
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
              <CheckCircle className="mx-auto size-16 drop-shadow-lg" />
            </motion.div>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mb-4 text-3xl font-bold leading-tight"
            >
              {locale === "ar"
                ? "تم بنجاح!"
                : "Success!"}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg leading-relaxed text-white/85"
            >
              {locale === "ar"
                ? "تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة."
                : "Your password has been changed successfully. You can now log in with your new password."}
            </motion.p>
          </motion.div>
        </div>

        {/* RIGHT PANEL */}
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
                {locale === "ar"
                  ? "تم تغيير كلمة المرور"
                  : "Password Changed"}
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
                    {locale === "ar"
                      ? "الذهاب لتسجيل الدخول"
                      : "Go to Login"}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Main form state ──
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
            <Lock className="mx-auto size-16 drop-shadow-lg" />
          </motion.div>
          <motion.h2
            variants={fadeUp}
            custom={1}
            className="mb-4 text-3xl font-bold leading-tight"
          >
            {locale === "ar"
              ? "إعادة تعيين كلمة المرور"
              : "Reset Your Password"}
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg leading-relaxed text-white/85"
          >
            {locale === "ar"
              ? "أدخل كلمة المرور الجديدة لحسابك. تأكد من اختيار كلمة مرور قوية يصعب تخمينها."
              : "Enter your new password. Make sure to choose a strong password that's hard to guess."}
          </motion.p>
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
              <Lock className="size-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold">
              {locale === "ar"
                ? "كلمة المرور الجديدة"
                : "New Password"}
            </h1>
            {userEmail && (
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "ar" ? "للحساب: " : "For account: "}
                <span className="font-medium text-foreground">{userEmail}</span>
              </p>
            )}
          </motion.div>

          {/* Password Requirements */}
          <motion.div variants={fadeUp} custom={0.5}>
            <div className="mb-4 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium mb-2">
                {locale === "ar"
                  ? "متطلبات كلمة المرور:"
                  : "Password requirements:"}
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>
                  {locale === "ar"
                    ? "- 8 أحرف على الأقل"
                    : "- At least 8 characters"}
                </li>
                <li>
                  {locale === "ar"
                    ? "- حرف كبير واحد على الأقل (A-Z)"
                    : "- At least one uppercase letter (A-Z)"}
                </li>
                <li>
                  {locale === "ar"
                    ? "- حرف صغير واحد على الأقل (a-z)"
                    : "- At least one lowercase letter (a-z)"}
                </li>
                <li>
                  {locale === "ar"
                    ? "- رقم واحد على الأقل (0-9)"
                    : "- At least one number (0-9)"}
                </li>
              </ul>
            </div>
          </motion.div>

          {/* Form Card */}
          <motion.div variants={fadeUp} custom={1}>
            <Card className="border-0 shadow-xl">
              <CardHeader className="pb-2" />
              <CardContent className="pt-0">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-5"
                  >
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {locale === "ar"
                              ? "كلمة المرور الجديدة"
                              : "New Password"}
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
                                onClick={() =>
                                  setShowNewPassword(!showNewPassword)
                                }
                              >
                                {showNewPassword ? (
                                  <EyeOff className="size-4" />
                                ) : (
                                  <Eye className="size-4" />
                                )}
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
                          <FormLabel>
                            {locale === "ar"
                              ? "تأكيد كلمة المرور"
                              : "Confirm Password"}
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type={
                                  showConfirmPassword ? "text" : "password"
                                }
                                placeholder="••••••••"
                                className="pe-10 ps-10"
                                {...field}
                              />
                              <button
                                type="button"
                                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setShowConfirmPassword(!showConfirmPassword)
                                }
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="size-4" />
                                ) : (
                                  <Eye className="size-4" />
                                )}
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
                          {locale === "ar"
                            ? "جارٍ التحديث..."
                            : "Updating..."}
                        </span>
                      ) : (
                        locale === "ar"
                          ? "تغيير كلمة المرور"
                          : "Change Password"
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>

              <CardFooter>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                  onClick={() => navigate("login")}
                >
                  <BackArrow className="size-4" />
                  {locale === "ar"
                    ? "العودة لتسجيل الدخول"
                    : "Back to Login"}
                </button>
              </CardFooter>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
