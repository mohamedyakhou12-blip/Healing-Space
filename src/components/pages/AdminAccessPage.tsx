"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Shield, KeyRound, Heart } from "lucide-react";
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

/* ================================================================== */
/*  AdminAccessPage — Hidden admin login page                          */
/*  This page is NOT linked anywhere in the UI. Access it directly     */
/*  via the URL: /admin-access                                         */
/* ================================================================== */

export default function AdminAccessPage() {
  const { t } = useTranslation();
  const navigate = useAppStore((s) => s.navigate);
  const setUser = useAppStore((s) => s.setUser);
  const dir = useAppStore((s) => (s.locale === "ar" ? "rtl" : "ltr"));
  const [isLoading, setIsLoading] = useState(false);
  const [adminCodeError, setAdminCodeError] = useState("");

  const form = useForm<AdminFormValues>({
    resolver: zodResolver(adminSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (data: AdminFormValues) => {
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
        // Admin session is created server-side by verifyAdminAccess()
        // No need to store admin code in localStorage — session cookie is sufficient
        setUser({
          id: result.userId || "admin-session",
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

  return (
    <div className="flex min-h-screen items-center justify-center" dir={dir}>
      <motion.div
        className="w-full max-w-md px-4"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        <motion.div variants={fadeUp} custom={0} className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25">
            <Shield className="size-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">{t("adminAccess.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("adminAccess.description")}
          </p>
        </motion.div>

        <motion.div variants={fadeUp} custom={1}>
          <Card className="border-0 shadow-xl">
            <CardHeader className="pb-2" />
            <CardContent className="pt-0">
              <div className="mb-6 flex justify-center">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                  <KeyRound className="size-8 text-amber-500" />
                </div>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Lock className="size-4 text-amber-500" />
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
            </CardContent>

            <CardFooter className="justify-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => navigate("login")}
              >
                {t("adminAccess.backToLogin")}
              </button>
            </CardFooter>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} custom={2} className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
            <Heart className="size-3" />
            <span>فضاء الشفاء</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
