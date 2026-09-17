"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CreditCard,
  Upload,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  Image as ImageIcon,
  FileCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { shouldUseDirectUpload, directCloudinaryUpload } from "@/lib/cloudinary-client";

interface PaymentRecord {
  id: string;
  subscriptionType?: string;
  contentId?: string;
  contentType?: string;
  contentTitle?: string;
  contentTitleAr?: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  ccpNumber: string | null;
  receiptImage: string;
  adminNote: string | null;
}

const planNames: Record<string, { ar: string; en: string; fr: string }> = {
  full: { ar: "الوصول الكامل", en: "Full Access", fr: "Accès complet" },
  courses: { ar: "الدورات فقط", en: "Courses Only", fr: "Cours uniquement" },
  articles: { ar: "المقالات فقط", en: "Articles Only", fr: "Articles uniquement" },
  podcasts: { ar: "البودكاست فقط", en: "Podcasts Only", fr: "Podcasts uniquement" },
  videos: { ar: "الفيديوهات فقط", en: "Videos Only", fr: "Vidéos uniquement" },
  pdfs: { ar: "الكتب الإلكترونية فقط", en: "E-books Only", fr: "E-books uniquement" },
  live: { ar: "البث المباشر فقط", en: "Live Only", fr: "En direct uniquement" },
  coaching: { ar: "الكوتشنغ فقط", en: "Coaching Only", fr: "Coaching uniquement" },
};

const DEFAULT_PLAN_PRICES: Record<string, number> = {
  full: 2000,
  courses: 500,
  articles: 500,
  podcasts: 500,
  videos: 500,
  pdfs: 500,
  live: 500,
  coaching: 500,
};

const DEFAULT_CCP = "12345 67890 12";

const localizedText = (obj: { ar: string; en: string; fr: string }, locale: string) =>
  obj[locale as keyof typeof obj] || obj.ar;

export default function PaymentPage() {
  const { t, locale } = useTranslation();
  const { user, navigate, pageParams } = useAppStore();

  // Detect if this is an individual content purchase
  const isIndividualPurchase = !!(pageParams?.contentId);
  const contentId = (pageParams?.contentId as string) || "";
  const contentType = (pageParams?.contentType as string) || "";
  const contentTitle = (pageParams?.contentTitle as string) || "";
  const contentTitleAr = (pageParams?.contentTitleAr as string) || contentTitle;
  const contentPrice = (pageParams?.contentPrice as number) || 0;

  const selectedPlanId = (pageParams?.plan as string) || "full";
  const selectedPlanName = planNames[selectedPlanId] || planNames.full;
  const [apiPrice, setApiPrice] = useState<number>(() => {
    // Initialize from localStorage cache to prevent flash of default prices
    if (typeof window === 'undefined') return DEFAULT_PLAN_PRICES[selectedPlanId] ?? 2000;
    try {
      const cached = localStorage.getItem('hs_subPrices');
      if (cached) {
        const prices = JSON.parse(cached);
        if (prices[selectedPlanId]) return prices[selectedPlanId];
      }
    } catch { /* use default */ }
    return DEFAULT_PLAN_PRICES[selectedPlanId] ?? 2000;
  });

  // Fetch subscription price from API (only for subscription mode)
  useEffect(() => {
    if (isIndividualPurchase) return;
    (async () => {
      try {
        const res = await fetch("/api/subscription-prices?_t=" + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data.prices?.[selectedPlanId]) {
            setApiPrice(data.prices[selectedPlanId]);
            // Cache all prices for instant load on refresh
            localStorage.setItem('hs_subPrices', JSON.stringify(data.prices));
          }
        }
      } catch { /* use default */ }
    })();
  }, [selectedPlanId, isIndividualPurchase]);
  const selectedPrice = isIndividualPurchase ? contentPrice : apiPrice;

  const [ccpInput, setCcpInput] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedCCP, setCopiedCCP] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [ccpAccount, setCcpAccount] = useState(DEFAULT_CCP);
  const [ccpHolderName, setCcpHolderName] = useState("");
  const [ccpWilaya, setCcpWilaya] = useState("");

  // Fetch CCP info from public settings
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public-settings?_t=" + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.ccpNumber) {
            setCcpAccount(data.settings.ccpNumber);
          }
          if (data.settings?.ccpHolderName) {
            setCcpHolderName(data.settings.ccpHolderName);
          }
          if (data.settings?.ccpWilaya) {
            setCcpWilaya(data.settings.ccpWilaya);
          }
        }
      } catch { /* use default */ }
    })();
  }, []);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("login");
    }
  }, [user, navigate]);

  // Load real payment history on mount (subscriptions + individual purchases)
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoadingPayments(true);
      try {
        const [payRes, purRes] = await Promise.all([
          fetch(`/api/payments?_t=${Date.now()}`),
          fetch(`/api/purchases?_t=${Date.now()}`),
        ]);
        const allPayments: PaymentRecord[] = [];
        if (payRes.ok) {
          const payData = await payRes.json();
          allPayments.push(...(payData.payments || []));
        }
        if (purRes.ok) {
          const purData = await purRes.json();
          allPayments.push(...(purData.purchases || []).map((p: any) => ({
            ...p,
            contentId: p.contentId,
            contentType: p.contentType,
            contentTitle: p.contentTitle,
            contentTitleAr: p.contentTitleAr,
          })));
        }
        // Sort by date descending
        allPayments.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        setPayments(allPayments);
      } catch (err) {
        console.error("Failed to load payments:", err);
      } finally {
        setIsLoadingPayments(false);
      }
    };

    fetchData();
  }, [user]);

  /**
   * Helper: safely parse a response that might be HTML (e.g., Vercel body limit error).
   * Returns the parsed JSON, or throws a localized error if the response is HTML.
   */
  const safeJsonParse = useCallback(async (res: Response): Promise<Record<string, unknown>> => {
    const text = await res.text();
    // Detect HTML error pages (Vercel returns HTML when body limit is exceeded)
    const trimmed = text.trim();
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML")) {
      const htmlError = locale === "ar"
        ? "الملف كبير جداً للرفع المباشر. يرجى استخدام ملف أصغر أو الاتصال بالدعم."
        : locale === "fr"
          ? "Fichier trop volumineux pour un téléchargement direct. Veuillez utiliser un fichier plus petit ou contacter le support."
          : "File too large for direct upload. Please use a smaller file or contact support.";
      throw new Error(htmlError);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        locale === "ar"
          ? "حدث خطأ غير متوقع أثناء معالجة الاستجابة"
          : locale === "fr"
            ? "Erreur inattendue lors du traitement de la réponse"
            : "Unexpected error while processing the response"
      );
    }
  }, [locale]);

  const handleFileSelect = useCallback(async (file: File) => {
    // Allow images and PDFs for receipts
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error(locale === "ar" ? "يرجى رفع صورة أو ملف PDF" : locale === "fr" ? "Veuillez télécharger une image ou un fichier PDF" : "Please upload an image or PDF file");
      return;
    }

    // Check size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      toast.error(locale === "ar" ? "حجم الملف كبير جداً (الحد الأقصى 20MB)" : locale === "fr" ? "Fichier trop volumineux (max 20 Mo)" : "File too large (max 20MB)");
      return;
    }

    setReceiptFile(file);
    setIsUploadingReceipt(true);

    // Determine resource type for Cloudinary: "image" for images, "raw" for PDFs
    const resourceType = file.type === "application/pdf" ? "raw" : "image";

    try {
      // ── For large files (>= 3MB): use direct Cloudinary upload ──
      // This bypasses Vercel's serverless function body size limit (~4.5MB on Hobby plan).
      // The file goes directly from the browser to Cloudinary's servers.
      if (shouldUseDirectUpload(file.size)) {
        const result = await directCloudinaryUpload(
          file,
          {
            folder: "healing-space/receipts",
            resourceType,
            authMode: "user", // Use session-based user auth (not admin)
          },
        );
        setReceiptPreview(result.url);
      } else {
        // ── For small files (< 3MB): use server-mediated upload ──
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "receipt");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await safeJsonParse(res);
          throw new Error((err.error as string) || "Upload failed");
        }

        const data = await safeJsonParse(res);
        setReceiptPreview(data.url as string);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : (
        locale === "ar" ? "فشل رفع الملف" : locale === "fr" ? "Échec du téléchargement" : "Upload failed"
      );
      toast.error(message);
      setReceiptPreview(null);
      setReceiptFile(null);
    } finally {
      setIsUploadingReceipt(false);
    }
  }, [locale, safeJsonParse]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleCopyCCP = useCallback(() => {
    navigator.clipboard.writeText(ccpAccount.replace(/\s/g, ""));
    setCopiedCCP(true);
    setTimeout(() => setCopiedCCP(false), 2000);
  }, [ccpAccount]);

  const handleSubmit = useCallback(async () => {
    if (!user || !receiptPreview) return;

    setIsSubmitting(true);
    try {
      let endpoint: string;
      let bodyData: Record<string, any>;

      if (isIndividualPurchase) {
        endpoint = "/api/purchases";
        bodyData = {
          contentId,
          contentType,
          amount: selectedPrice,
          receiptImage: receiptPreview,
          ccpNumber: ccpInput,
          contentTitle,
          contentTitleAr: contentTitleAr,
        };
      } else {
        endpoint = "/api/payments";
        bodyData = {
          subscriptionType: selectedPlanId,
          amount: selectedPrice,
          receiptImage: receiptPreview,
          ccpNumber: ccpInput,
        };
      }

      const paymentRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      let paymentData: any;
      try {
        paymentData = await safeJsonParse(paymentRes);
      } catch (parseErr) {
        throw new Error(parseErr instanceof Error ? parseErr.message : "Failed to process payment response");
      }
      if (!paymentRes.ok) {
        throw new Error(paymentData.error || "Failed to create payment");
      }
      setPayments((prev) => [paymentData.payment, ...prev]);
      setSubmitted(true);

      toast.success(
        locale === "ar"
          ? "تم إرسال الدفع بنجاح"
          : locale === "fr"
            ? "Paiement envoyé avec succès"
            : "Payment submitted successfully"
      );
    } catch (error) {
      console.error("Payment submission error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : locale === "ar"
            ? "حدث خطأ أثناء إرسال الدفع"
            : locale === "fr"
              ? "Erreur lors de l'envoi du paiement"
              : "Failed to submit payment"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [user, receiptPreview, selectedPlanId, selectedPrice, ccpInput, locale, isIndividualPurchase, contentId, contentType, contentTitle]);

  const statusConfig = {
    pending: {
      label: t("payment.pending"),
      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      icon: Clock,
    },
    approved: {
      label: t("payment.approved"),
      color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      icon: ShieldCheck,
    },
    rejected: {
      label: t("payment.rejected"),
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      icon: AlertCircle,
    },
  };

  const instructions = {
    ar: "قم بنسخ رقم الحساب البريدي CCP أدناه، ثم قم بتحويل المبلغ المطلوب عبر وكالة البريد أو عبر التطبيق. بعد التحويل، التقط صورة واضحة لإيصال الدفع وارفعها هنا مع إدخال رقم CCP الخاص بك.",
    en: "Copy the CCP postal account number below, then transfer the required amount via the post office or the CCP app. After the transfer, take a clear photo of the payment receipt and upload it here along with your CCP number.",
    fr: "Copiez le numéro CCP ci-dessous, puis effectuez le virement du montant requis via la poste ou l'application CCP. Après le virement, prenez une photo claire du reçu et téléchargez-la ici avec votre numéro CCP.",
  };

  const ArrowIcon = locale === "ar" ? ArrowRight : ArrowLeft;

  // Don't render until we confirm user is logged in
  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-4xl mx-auto"
    >
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(isIndividualPurchase ? (contentType || "home") as any : "subscriptions")}
        className="gap-2"
      >
        <ArrowIcon className="h-4 w-4" />
        {isIndividualPurchase
          ? (locale === "ar" ? contentTitle || "رجوع" : locale === "fr" ? contentTitle || "Retour" : contentTitle || "Back")
          : t("subscriptions.title")}
      </Button>

      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">{t("payment.title")}</h1>
        <p className="text-muted-foreground">{t("payment.description")}</p>
      </div>

      {/* Selected Plan Summary */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-amber-400 to-orange-500 p-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6" />
              <div>
                <p className="font-bold text-lg">{isIndividualPurchase ? contentTitle : localizedText(selectedPlanName, locale)}</p>
                <p className="text-white/80 text-sm">
                  {isIndividualPurchase
                    ? (locale === "ar" ? "شراء محتوى فردي" : locale === "fr" ? "Achat de contenu individuel" : "Individual Content Purchase")
                    : t("subscriptions.perMonth")}
                </p>
              </div>
            </div>
            <div className="text-start">
              <p className="text-2xl font-bold">{selectedPrice.toLocaleString()} DA</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!submitted ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CCP Transfer Instructions */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                {t("payment.ccpTransfer")}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* CCP Holder Name */}
              {ccpHolderName && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar" ? "اسم صاحب الحساب" : locale === "fr" ? "Titulaire du compte" : "Account Holder"}
                  </p>
                  <p className="font-semibold text-base">{ccpHolderName}</p>
                </div>
              )}

              {/* CCP Account Number */}
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("payment.ccpNumber")}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-lg p-3 font-mono text-lg tracking-wider text-center font-bold">
                    {ccpAccount}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCCP}
                    className="shrink-0"
                  >
                    {copiedCCP ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* CCP Wilaya */}
              {ccpWilaya && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {locale === "ar" ? "الولاية" : locale === "fr" ? "Wilaya" : "State"}
                  </p>
                  <p className="font-medium text-sm">{ccpWilaya}</p>
                </div>
              )}

              <Separator />

              {/* Amount */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("payment.amount")}</span>
                <span className="text-xl font-bold text-primary">
                  {selectedPrice.toLocaleString()} DA
                </span>
              </div>

              <Separator />

              {/* Instructions */}
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {locale === "ar" ? "خطوات الدفع" : locale === "fr" ? "Étapes de paiement" : "Payment Steps"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {localizedText(instructions, locale)}
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  {locale === "ar"
                    ? "عادةً ما يتم مراجعة المدفوعات خلال 24 ساعة عمل"
                    : locale === "fr"
                      ? "Les paiements sont généralement traités sous 24 heures ouvrées"
                      : "Payments are typically reviewed within 24 business hours"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Upload Receipt */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                {t("payment.uploadReceipt")}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => {
                  if (isUploadingReceipt) return; // Don't open file picker during upload
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*,.pdf";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileSelect(file);
                  };
                  input.click();
                }}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  isDragOver
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : isUploadingReceipt
                      ? "border-primary bg-primary/5"
                      : receiptPreview
                        ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                {isUploadingReceipt ? (
                  <div className="space-y-3 py-4">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Loader2 className="h-7 w-7 text-primary animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {locale === "ar" ? "جارٍ رفع الإيصال..." : locale === "fr" ? "Téléchargement du reçu..." : "Uploading receipt..."}
                      </p>
                    </div>
                  </div>
                ) : receiptPreview ? (
                  <div className="space-y-3">
                    <div className="relative inline-block">
                      {receiptFile && receiptFile.type === "application/pdf" ? (
                        <div className="flex items-center justify-center h-32 gap-2">
                          <FileCheck className="h-8 w-8 text-rose-500" />
                          <span className="text-sm font-medium text-rose-600 dark:text-rose-400">PDF</span>
                        </div>
                      ) : (
                        <img
                          src={receiptPreview}
                          alt="Receipt preview"
                          className="h-32 w-auto rounded-lg object-contain mx-auto shadow-sm"
                        />
                      )}
                    </div>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                      {locale === "ar" ? "تم رفع الإيصال بنجاح ✅" : locale === "fr" ? "Reçu téléchargé avec succès ✅" : "Receipt uploaded successfully ✅"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {locale === "ar" ? "انقر لتغيير الصورة" : locale === "fr" ? "Cliquez pour changer l'image" : "Click to change image"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 py-4">
                    <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <ImageIcon className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {locale === "ar"
                          ? "اسحب وأفلت إيصال الدفع هنا"
                          : locale === "fr"
                            ? "Glissez et déposez le reçu ici"
                            : "Drag and drop receipt here"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {locale === "ar"
                          ? "أو انقر لاختيار صورة أو ملف PDF (الحد الأقصى 20MB)"
                          : locale === "fr"
                            ? "Ou cliquez pour sélectionner une image ou PDF (max 20 Mo)"
                            : "Or click to select an image or PDF (max 20MB)"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* CCP Number Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {locale === "ar"
                    ? "رقم CCP الخاص بك"
                    : locale === "fr"
                      ? "Votre numéro CCP"
                      : "Your CCP Number"}
                </label>
                <Input
                  placeholder="00000 00000 00"
                  value={ccpInput}
                  onChange={(e) => setCcpInput(e.target.value)}
                  dir="ltr"
                  className="font-mono tracking-wider text-center"
                />
              </div>

              {/* Amount Display */}
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <span className="text-sm font-medium">{t("payment.amount")}</span>
                <span className="font-bold text-lg">{selectedPrice.toLocaleString()} DA</span>
              </div>

              {/* Submit Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={!receiptPreview || !ccpInput || isSubmitting || isUploadingReceipt}
              >
                {isSubmitting || isUploadingReceipt ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="h-5 w-5 border-2 border-white border-t-transparent rounded-full me-2"
                  />
                ) : (
                  <FileCheck className={`h-5 w-5 ${locale === "ar" ? "me-2" : "ms-2"}`} />
                )}
                {isUploadingReceipt
                  ? (locale === "ar" ? "جارٍ رفع الإيصال..." : locale === "fr" ? "Téléchargement du reçu..." : "Uploading receipt...")
                  : isSubmitting
                    ? t("common.loading")
                    : t("payment.submit")}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Waiting for Approval State */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-8 text-center space-y-4">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  className="inline-flex"
                >
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30">
                    <Clock className="h-10 w-10 text-white" />
                  </div>
                </motion.div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-amber-700 dark:text-amber-400">
                    {locale === "ar"
                      ? "جاري مراجعة الدفع"
                      : locale === "fr"
                        ? "Paiement en cours de vérification"
                        : "Payment Under Review"}
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                    {t("payment.waitingApproval")}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-4 pt-2">
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-sm px-3 py-1">
                    <Clock className={`h-3.5 w-3.5 ${locale === "ar" ? "me-1.5" : "ms-1.5"}`} />
                    {t("payment.pending")}
                  </Badge>
                </div>
                {receiptPreview && (
                  <div className="pt-2">
                    {receiptFile && receiptFile.type === "application/pdf" ? (
                      <div className="flex items-center justify-center gap-2 opacity-80">
                        <FileCheck className="h-6 w-6 text-rose-500" />
                        <span className="text-sm text-muted-foreground">PDF Receipt</span>
                      </div>
                    ) : (
                      <img
                        src={receiptPreview}
                        alt="Receipt"
                        className="h-24 mx-auto rounded-lg shadow-sm object-contain opacity-80"
                      />
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {locale === "ar" ? "سجل المدفوعات" : locale === "fr" ? "Historique des paiements" : "Payment History"}
          </h2>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {locale === "ar"
                ? "لا توجد مدفوعات سابقة"
                : locale === "fr"
                  ? "Aucun paiement précédent"
                  : "No previous payments"}
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const config = statusConfig[payment.status as keyof typeof statusConfig] || statusConfig.pending;
                const StatusIcon = config.icon;
                const isPurchase = !!payment.contentId;
                const paymentPlanName = !isPurchase ? (planNames[payment.subscriptionType || "full"] || planNames.full) : null;
                const formattedDate = new Date(payment.createdAt).toISOString().split("T")[0];

                return (
                  <motion.div
                    key={payment.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    {/* Receipt thumbnail */}
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-sm truncate">
                        {isPurchase
                          ? (locale === "ar" ? payment.contentTitleAr : payment.contentTitle) || payment.contentTitleAr || "محتوى"
                          : localizedText(paymentPlanName!, locale)}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formattedDate}</span>
                        <span>•</span>
                        <span>{payment.amount.toLocaleString()} DA</span>
                        {payment.status === "rejected" && payment.adminNote && (
                          <>
                            <span>•</span>
                            <span className="text-red-500 truncate">
                              {payment.adminNote}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <Badge className={`${config.color} border-0 shrink-0`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${locale === "ar" ? "me-1" : "ms-1"}`} />
                      {config.label}
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
