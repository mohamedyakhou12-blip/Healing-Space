"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, BookOpen, Video, ImageIcon, Shield, Check, X, Loader2,
  Upload, Link2, Plus, Pencil, Trash2, Settings, Eye, EyeOff, GripVertical,
  ChevronLeft, Monitor, Save, RotateCcw, PlayCircle, LayoutDashboard
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { directCloudinaryUpload } from "@/lib/cloudinary-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

/* ─── Types ─── */
type Trilingual = { ar: string; fr: string; en: string };
type CustomizerTab = "hero" | "video" | "sliders" | "sections" | "firebase";
type SectionKey = "hero" | "video" | "services" | "courses" | "articles" | "podcasts" | "stats" | "testimonials";

interface Slider {
  id: string;
  imageUrl: string;
  title: string;
  titleAr?: string;
  titleFr?: string;
  titleEn?: string;
  order: number;
  link?: string;
}

/* ─── Helper: Admin headers ─── */
function adminHeaders(): Record<string, string> {
  const code = typeof window !== "undefined" ? localStorage.getItem("healing_space_admin_code") || "" : "";
  return { "Content-Type": "application/json", "x-admin-code": code };
}

function adminFormDataHeaders(): Record<string, string> {
  const code = typeof window !== "undefined" ? localStorage.getItem("healing_space_admin_code") || "" : "";
  return { "x-admin-code": code };
}

const emptyTrilingual = (): Trilingual => ({ ar: "", fr: "", en: "" });

const parseTrilingual = (raw: string | undefined): Trilingual => {
  if (!raw) return emptyTrilingual();
  try {
    const parsed = JSON.parse(raw);
    return { ar: parsed.ar || "", fr: parsed.fr || "", en: parsed.en || "" };
  } catch {
    return emptyTrilingual();
  }
};

/* ─── Default Section Config ─── */
const DEFAULT_SECTIONS: { key: SectionKey; labelAr: string; labelEn: string; defaultVisible: boolean }[] = [
  { key: "hero", labelAr: "البانر الرئيسي", labelEn: "Hero Banner", defaultVisible: true },
  { key: "video", labelAr: "الفيديو التعريفي", labelEn: "Intro Video", defaultVisible: true },
  { key: "services", labelAr: "الخدمات", labelEn: "Services", defaultVisible: true },
  { key: "courses", labelAr: "الدورات المميزة", labelEn: "Featured Courses", defaultVisible: true },
  { key: "articles", labelAr: "أحدث المقالات", labelEn: "Latest Articles", defaultVisible: true },
  { key: "podcasts", labelAr: "البودكاست", labelEn: "Podcasts", defaultVisible: true },
  { key: "stats", labelAr: "الإحصائيات", labelEn: "Statistics", defaultVisible: true },
  { key: "testimonials", labelAr: "آراء المستخدمين", labelEn: "Testimonials", defaultVisible: true },
];

/* ═══════════════════════════════════════════════════════════════════ */
/*  HomepageCustomizerPage                                           */
/* ═══════════════════════════════════════════════════════════════════ */
export default function HomepageCustomizerPage() {
  const { t, locale } = useTranslation();
  const navigate = useAppStore((s) => s.navigate);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const user = useAppStore((s) => s.user);
  const dir = useAppStore((s) => (s.locale === "ar" ? "rtl" : "ltr"));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CustomizerTab>("hero");

  // ─── Hero settings ───
  const [heroTitle, setHeroTitle] = useState<Trilingual>(emptyTrilingual());
  const [heroSubtitle, setHeroSubtitle] = useState<Trilingual>(emptyTrilingual());
  const [heroDescription, setHeroDescription] = useState<Trilingual>(emptyTrilingual());
  const [siteOwnerNameSetting, setSiteOwnerNameSetting] = useState<Trilingual>(emptyTrilingual());
  const [ctaButton1, setCtaButton1] = useState<Trilingual>(emptyTrilingual());
  const [ctaButton2, setCtaButton2] = useState<Trilingual>(emptyTrilingual());

  // ─── Video ───
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);

  // ─── Sliders ───
  const [sliders, setSliders] = useState<Slider[]>([]);
  const [sliderDialog, setSliderDialog] = useState<{ open: boolean; slider: Slider | null; isNew: boolean }>({
    open: false, slider: null, isNew: false,
  });
  const [sliderForm, setSliderForm] = useState({
    imageUrl: "", title: "", titleAr: "", titleFr: "", titleEn: "", order: 0, link: "",
  });
  const [uploadingSliderImage, setUploadingSliderImage] = useState(false);

  // ─── Sections visibility ───
  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionKey, boolean>>(() => {
    const vis: Record<string, boolean> = {};
    DEFAULT_SECTIONS.forEach((s) => { vis[s.key] = s.defaultVisible; });
    return vis as Record<SectionKey, boolean>;
  });

  // ─── Firebase status ───
  const [firebaseStatus, setFirebaseStatus] = useState<Record<string, unknown> | null>(null);
  const [checkingFirebase, setCheckingFirebase] = useState(false);

  // ─── Fetch all settings ───
  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, slidersRes] = await Promise.all([
          fetch("/api/admin/settings", { headers: adminHeaders() }),
          fetch("/api/sliders"),
        ]);

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          const settings = data.settings || {};
          setHeroTitle(parseTrilingual(settings.heroTitle));
          setHeroSubtitle(parseTrilingual(settings.heroSubtitle));
          setHeroDescription(parseTrilingual(settings.heroDescription));
          setSiteOwnerNameSetting(parseTrilingual(settings.siteOwnerNameSetting));
          setCtaButton1(parseTrilingual(settings.ctaButton1));
          setCtaButton2(parseTrilingual(settings.ctaButton2));
          if (settings.introVideoUrl) setIntroVideoUrl(settings.introVideoUrl);

          // Parse section visibility
          if (settings.sectionVisibility) {
            try {
              const parsed = JSON.parse(settings.sectionVisibility);
              setSectionVisibility((prev) => ({ ...prev, ...parsed }));
            } catch { /* keep defaults */ }
          }
        }

        if (slidersRes.ok) {
          const data = await slidersRes.json();
          setSliders(
            (data.sliders || []).map((s: Record<string, unknown>) => ({
              id: s.id as string,
              imageUrl: (s.imageUrl || s.image) as string,
              title: (s.titleAr || s.title) as string,
              titleAr: s.titleAr as string,
              titleFr: s.titleFr as string,
              titleEn: s.titleEn as string,
              order: (s.order as number) || 0,
              link: s.link as string,
            }))
          );
        }
      } catch (e) {
        console.error(e);
        toast.error(locale === "ar" ? "فشل تحميل الإعدادات" : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [locale]);

  // ─── Save handler ───
  const handleSave = async (section: string) => {
    setSaving(section);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          settings: {
            heroTitle: JSON.stringify(heroTitle),
            heroSubtitle: JSON.stringify(heroSubtitle),
            heroDescription: JSON.stringify(heroDescription),
            siteOwnerNameSetting: JSON.stringify(siteOwnerNameSetting),
            ctaButton1: JSON.stringify(ctaButton1),
            ctaButton2: JSON.stringify(ctaButton2),
            introVideoUrl,
            sectionVisibility: JSON.stringify(sectionVisibility),
          },
        }),
      });
      if (res.ok) {
        toast.success(locale === "ar" ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully");
        // Clear localStorage cache so homepage re-fetches
        if (typeof window !== "undefined") {
          localStorage.removeItem("hs_public_settings");
          localStorage.removeItem("hs_introVideoUrl");
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error((err as Record<string, string>).error || (locale === "ar" ? "حدث خطأ" : "Error saving"));
      }
    } catch {
      toast.error(locale === "ar" ? "فشل الحفظ" : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  // ─── Video upload (direct to Cloudinary from browser — bypasses Vercel body size limit) ───
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024 * 1024) {
      toast.error(locale === "ar" ? "الملف كبير جداً (الحد 1 جيجابايت)" : "File too large (max 1GB)");
      return;
    }
    setUploadingVideo(true);
    setVideoUploadProgress(0);

    try {
      const result = await directCloudinaryUpload(
        file,
        { folder: "healing-space/videos", resourceType: "video" },
        (percent) => setVideoUploadProgress(percent)
      );

      setIntroVideoUrl(result.url);
      setVideoUploadProgress(100);
      toast.success(locale === "ar" ? "تم رفع الفيديو بنجاح" : "Video uploaded successfully");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("cancelled")) {
        toast.info(locale === "ar" ? "تم إلغاء الرفع" : "Upload cancelled");
      } else {
        console.error("[Video Upload] Error:", error);
        toast.error(locale === "ar" ? `فشل رفع الفيديو: ${message}` : `Video upload failed: ${message}`);
      }
    } finally {
      setUploadingVideo(false);
      setVideoUploadProgress(0);
      e.target.value = "";
    }
  };

  // ─── Slider management ───
  const fetchSliders = useCallback(async () => {
    try {
      const res = await fetch("/api/sliders");
      if (res.ok) {
        const data = await res.json();
        setSliders(
          (data.sliders || []).map((s: Record<string, unknown>) => ({
            id: s.id as string,
            imageUrl: (s.imageUrl || s.image) as string,
            title: (s.titleAr || s.title) as string,
            titleAr: s.titleAr as string,
            titleFr: s.titleFr as string,
            titleEn: s.titleEn as string,
            order: (s.order as number) || 0,
            link: s.link as string,
          }))
        );
      }
    } catch (e) { console.error(e); }
  }, []);

  const handleSliderSave = async () => {
    if (!sliderForm.titleAr && !sliderForm.titleFr && !sliderForm.titleEn && !sliderForm.title) {
      toast.error(locale === "ar" ? "يرجى إدخال عنوان" : "Please enter a title");
      return;
    }
    try {
      if (sliderDialog.isNew) {
        const res = await fetch("/api/sliders", {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(sliderForm),
        });
        if (!res.ok) { toast.error(locale === "ar" ? "فشل الإضافة" : "Failed to add"); return; }
      } else if (sliderDialog.slider) {
        const res = await fetch("/api/sliders", {
          method: "PUT",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ id: sliderDialog.slider.id, ...sliderForm }),
        });
        if (!res.ok) { toast.error(locale === "ar" ? "فشل التحديث" : "Failed to update"); return; }
      }
      toast.success(locale === "ar" ? "تم الحفظ" : "Saved");
      fetchSliders();
    } catch { toast.error(locale === "ar" ? "حدث خطأ" : "Error"); }
    setSliderDialog({ open: false, slider: null, isNew: false });
  };

  const handleSliderDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/sliders/${encodeURIComponent(id)}`, { method: "DELETE", headers: adminHeaders() });
      if (res.ok) { toast.success(locale === "ar" ? "تم الحذف" : "Deleted"); fetchSliders(); }
      else { toast.error(locale === "ar" ? "فشل الحذف" : "Delete failed"); }
    } catch { toast.error(locale === "ar" ? "حدث خطأ" : "Error"); }
  };

  // ─── Firebase status check ───
  const checkFirebaseStatus = async () => {
    setCheckingFirebase(true);
    try {
      const res = await fetch("/api/auth/firebase-check");
      if (res.ok) {
        const data = await res.json();
        setFirebaseStatus(data);
      } else {
        setFirebaseStatus({ error: "Failed to check Firebase status" });
      }
    } catch {
      setFirebaseStatus({ error: "Network error" });
    } finally {
      setCheckingFirebase(false);
    }
  };

  // ─── Trilingual input helper ───
  const TrilingualInput = ({ label, value, onChange, placeholder, isTextarea = false }: {
    label: string; value: Trilingual; onChange: (v: Trilingual) => void;
    placeholder?: Trilingual; isTextarea?: boolean;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-teal-700 dark:text-teal-400">{label}</Label>
      {(["ar", "fr", "en"] as const).map((lang) => (
        <div key={lang} className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {lang === "ar" ? "العربية" : lang === "fr" ? "Français" : "English"}
          </Label>
          {isTextarea ? (
            <Textarea
              value={value[lang]}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
              placeholder={placeholder?.[lang] || ""}
              dir={lang === "ar" ? "rtl" : "ltr"}
              rows={3}
            />
          ) : (
            <Input
              value={value[lang]}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
              placeholder={placeholder?.[lang] || ""}
              dir={lang === "ar" ? "rtl" : "ltr"}
            />
          )}
        </div>
      ))}
    </div>
  );

  /* ─── Tab config ─── */
  const tabs: { key: CustomizerTab; labelAr: string; labelEn: string; icon: React.ElementType; color: string }[] = [
    { key: "hero", labelAr: "البانر الرئيسي", labelEn: "Hero Banner", icon: BookOpen, color: "text-teal-600" },
    { key: "video", labelAr: "الفيديو التعريفي", labelEn: "Intro Video", icon: Video, color: "text-rose-600" },
    { key: "sliders", labelAr: "الشرائح", labelEn: "Sliders", icon: ImageIcon, color: "text-violet-600" },
    { key: "sections", labelAr: "أقسام الصفحة", labelEn: "Page Sections", icon: LayoutDashboard, color: "text-cyan-600" },
    { key: "firebase", labelAr: "حالة غوغل", labelEn: "Google Status", icon: Shield, color: "text-amber-600" },
  ];

  /* ─── Loading state ─── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" dir={dir}>
        <div className="text-center space-y-4">
          <Loader2 className="size-10 animate-spin text-teal-600 mx-auto" />
          <p className="text-muted-foreground">{locale === "ar" ? "جارٍ تحميل الإعدادات..." : "Loading settings..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-background dark:via-background dark:to-teal-950/10" dir={dir}>
      {/* ─── Top Bar ─── */}
      <div className="sticky top-0 z-50 glass-card border-b border-border/50 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("home")}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            >
              <ArrowRight className="size-4" />
              {locale === "ar" ? "العودة للرئيسية" : "Back to Homepage"}
            </button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Settings className="size-5 text-teal-600" />
              <h1 className="text-lg font-bold">
                {locale === "ar" ? "تخصيص الصفحة الرئيسية" : locale === "fr" ? "Personnaliser la page d'accueil" : "Customize Homepage"}
              </h1>
            </div>
          </div>
          <Button
            onClick={() => handleSave("all")}
            disabled={saving !== null}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {locale === "ar" ? "حفظ الكل" : "Save All"}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* ─── Tab Navigation ─── */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-500/25"
                    : "bg-white dark:bg-card border text-muted-foreground hover:border-teal-300 hover:text-foreground"
                }`}
              >
                <Icon className={`size-4 ${isActive ? "text-white" : tab.color}`} />
                {locale === "ar" ? tab.labelAr : tab.labelEn}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {/* ═══════════════════════════════════════════════════════════ */}
            {/*  HERO SECTION TAB                                         */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeTab === "hero" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="size-5 text-teal-600" />
                    {locale === "ar" ? "تعديل البانر الرئيسي" : "Edit Hero Banner"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <TrilingualInput
                    label={locale === "ar" ? "العنوان الرئيسي" : "Hero Title"}
                    value={heroTitle}
                    onChange={setHeroTitle}
                    placeholder={{ ar: "فضاء الشفاء", fr: "Espace de Guérison", en: "Healing Space" }}
                  />
                  <Separator />
                  <TrilingualInput
                    label={locale === "ar" ? "العنوان الفرعي" : "Hero Subtitle"}
                    value={heroSubtitle}
                    onChange={setHeroSubtitle}
                    placeholder={{ ar: "منصتك الشاملة للعلاج والتعليم", fr: "Votre plateforme complète", en: "Your comprehensive healing platform" }}
                  />
                  <Separator />
                  <TrilingualInput
                    label={locale === "ar" ? "الوصف" : "Description"}
                    value={heroDescription}
                    onChange={setHeroDescription}
                    placeholder={{ ar: "منصة الدكتورة نسرين التعليمية...", fr: "Plateforme éducative...", en: "Dr. Ness's educational platform..." }}
                    isTextarea
                  />
                  <Separator />
                  <TrilingualInput
                    label={locale === "ar" ? "اسم صاحبة الموقع" : "Site Owner Name"}
                    value={siteOwnerNameSetting}
                    onChange={setSiteOwnerNameSetting}
                    placeholder={{ ar: "الدكتورة نسرين", fr: "Dr. Ness", en: "Dr. Ness" }}
                  />
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <TrilingualInput
                      label={locale === "ar" ? "زر الإجراء 1" : "CTA Button 1"}
                      value={ctaButton1}
                      onChange={setCtaButton1}
                      placeholder={{ ar: "ابدأ رحلة الشفاء", fr: "Commencer", en: "Start Healing" }}
                    />
                    <TrilingualInput
                      label={locale === "ar" ? "زر الإجراء 2" : "CTA Button 2"}
                      value={ctaButton2}
                      onChange={setCtaButton2}
                      placeholder={{ ar: "تصفح المحتوى", fr: "Parcourir", en: "Browse Content" }}
                    />
                  </div>
                  <div className="pt-2">
                    <Button onClick={() => handleSave("hero")} disabled={saving !== null} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      {locale === "ar" ? "حفظ التغييرات" : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/*  VIDEO SECTION TAB                                        */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeTab === "video" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Video className="size-5 text-rose-600" />
                    {locale === "ar" ? "الفيديو التعريفي" : "Intro Video"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    {locale === "ar"
                      ? "أضف فيديو تعريفي يظهر في الصفحة الرئيسية. يمكنك رفع ملف فيديو أو إضافة رابط يوتيوب."
                      : "Add an introductory video that appears on the homepage. Upload a video file or add a YouTube link."}
                  </p>

                  {/* ─── Video Upload Area ─── */}
                  <div className="rounded-xl border-2 border-dashed border-rose-300 bg-rose-50/50 dark:border-rose-700 dark:bg-rose-950/20 p-6">
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/25">
                        <Video className="size-8 text-white" />
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-bold">
                          {locale === "ar" ? "رفع فيديو تعريفي" : "Upload Intro Video"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {locale === "ar" ? "MP4, WebM, MOV — الحد الأقصى 1 جيجابايت" : "MP4, WebM, MOV — Max 1GB"}
                        </p>
                      </div>

                      {uploadingVideo ? (
                        <div className="w-full max-w-sm space-y-2">
                          <div className="flex items-center justify-center gap-2 text-sm text-rose-600">
                            <Loader2 className="size-5 animate-spin" />
                            {locale === "ar" ? "جارٍ رفع الفيديو..." : "Uploading video..."}
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5">
                            <div className="bg-rose-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${Math.min(videoUploadProgress, 100)}%` }} />
                          </div>
                          <p className="text-xs text-center text-muted-foreground">{Math.round(videoUploadProgress)}%</p>
                        </div>
                      ) : (
                        <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30 transition-all">
                          <Upload className="size-5" />
                          {locale === "ar" ? "اختر فيديو" : "Choose Video"}
                          <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" className="hidden" onChange={handleVideoUpload} />
                        </label>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* ─── URL Input ─── */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Link2 className="size-4" />
                      {locale === "ar" ? "أو أدخل رابط الفيديو" : "Or enter video URL"}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={introVideoUrl}
                        onChange={(e) => setIntroVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/embed/xxxxxxx أو https://res.cloudinary.com/.../video.mp4"
                        dir="ltr"
                        className="flex-1"
                      />
                      {introVideoUrl && (
                        <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setIntroVideoUrl("")}>
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {locale === "ar"
                        ? "يدعم: روابط يوتيوب (youtube.com/watch أو youtu.be) أو روابط فيديو مباشرة (mp4, webm)"
                        : "Supports: YouTube links (youtube.com/watch or youtu.be) or direct video URLs (mp4, webm)"}
                    </p>
                  </div>

                  {/* ─── Video Preview ─── */}
                  {introVideoUrl && (
                    <div className="mt-3 rounded-xl overflow-hidden border shadow-lg">
                      <div className="relative aspect-video bg-black">
                        {introVideoUrl.includes("youtube.com") || introVideoUrl.includes("youtu.be") ? (
                          <iframe
                            src={introVideoUrl.includes("embed")
                              ? introVideoUrl
                              : `https://www.youtube.com/embed/${introVideoUrl.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1] || ""}`}
                            title="Video preview"
                            className="absolute inset-0 h-full w-full"
                            allowFullScreen
                          />
                        ) : (
                          <video className="absolute inset-0 h-full w-full object-contain" controls playsInline preload="metadata">
                            <source src={introVideoUrl} />
                          </video>
                        )}
                      </div>
                      <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground truncate me-2">
                          {introVideoUrl.includes("youtube.com") || introVideoUrl.includes("youtu.be")
                            ? (locale === "ar" ? "فيديو يوتيوب" : "YouTube video")
                            : (locale === "ar" ? "فيديو مباشر" : "Direct video")}
                        </span>
                        <Check className="size-4 text-green-500 shrink-0" />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex gap-3">
                    <Button onClick={() => handleSave("video")} disabled={saving !== null} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      {locale === "ar" ? "حفظ الفيديو" : "Save Video"}
                    </Button>
                    {introVideoUrl && (
                      <Button variant="outline" onClick={() => { setIntroVideoUrl(""); }} className="gap-2 text-destructive hover:text-destructive">
                        <Trash2 className="size-4" />
                        {locale === "ar" ? "إزالة الفيديو" : "Remove Video"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/*  SLIDERS SECTION TAB                                      */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeTab === "sliders" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="size-5 text-violet-600" />
                    {locale === "ar" ? "شرائح البانر" : "Banner Sliders"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => {
                      setSliderForm({ imageUrl: "", title: "", titleAr: "", titleFr: "", titleEn: "", order: sliders.length + 1, link: "" });
                      setSliderDialog({ open: true, slider: null, isNew: true });
                    }}
                    className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Plus className="size-4" />
                    {locale === "ar" ? "إضافة شريحة" : "Add Slider"}
                  </Button>

                  {sliders.length === 0 ? (
                    <div className="py-12 text-center">
                      <ImageIcon className="size-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        {locale === "ar" ? "لا توجد شرائح بعد. أضف شريحة لعرضها في البانر." : "No sliders yet. Add one to display in the banner."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sliders.sort((a, b) => a.order - b.order).map((slider) => (
                        <div key={slider.id} className="flex items-center gap-3 rounded-lg border p-3 hover:border-violet-300 transition-colors">
                          <GripVertical className="size-4 text-muted-foreground/40 shrink-0 cursor-grab" />
                          {slider.imageUrl ? (
                            <img src={slider.imageUrl} alt={slider.title} className="size-16 rounded-lg object-cover" />
                          ) : (
                            <div className="size-16 rounded-lg bg-muted flex items-center justify-center">
                              <ImageIcon className="size-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{slider.titleAr || slider.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {locale === "ar" ? "الترتيب" : "Order"}: {slider.order}
                              {slider.link && <span className="ms-2">→ {slider.link}</span>}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost" size="icon" className="size-8"
                              onClick={() => {
                                setSliderForm({
                                  imageUrl: slider.imageUrl,
                                  title: slider.title,
                                  titleAr: slider.titleAr || "",
                                  titleFr: slider.titleFr || "",
                                  titleEn: slider.titleEn || "",
                                  order: slider.order,
                                  link: slider.link || "",
                                });
                                setSliderDialog({ open: true, slider, isNew: false });
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleSliderDelete(slider.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Slider Dialog */}
                  <Dialog open={sliderDialog.open} onOpenChange={(open) => setSliderDialog({ open, slider: null, isNew: false })}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {sliderDialog.isNew ? (locale === "ar" ? "إضافة شريحة" : "Add Slider") : (locale === "ar" ? "تعديل شريحة" : "Edit Slider")}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>{locale === "ar" ? "صورة الشريحة" : "Slider Image"}</Label>
                          {sliderForm.imageUrl ? (
                            <div className="relative rounded-lg overflow-hidden border">
                              <img src={sliderForm.imageUrl} alt="Slider preview" className="w-full h-32 object-cover" />
                              <Button
                                variant="ghost" size="sm"
                                className="absolute top-1 end-1 h-7 w-7 p-0 bg-black/50 text-white hover:bg-black/70 rounded-full"
                                onClick={() => setSliderForm((p) => ({ ...p, imageUrl: "" }))}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ) : null}
                          <div className="flex gap-2">
                            <label className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border hover:bg-accent transition-colors ${uploadingSliderImage ? "pointer-events-none opacity-60" : ""}`}>
                              {uploadingSliderImage ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                              {locale === "ar" ? "رفع صورة" : "Upload Image"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (file.size > 10 * 1024 * 1024) {
                                    toast.error(locale === "ar" ? "الصورة كبيرة جداً (الحد 10MB)" : "Image too large (max 10MB)");
                                    return;
                                  }
                                  setUploadingSliderImage(true);
                                  try {
                                    const result = await directCloudinaryUpload(
                                      file,
                                      { folder: "healing-space/sliders", resourceType: "image" }
                                    );
                                    setSliderForm((p) => ({ ...p, imageUrl: result.url }));
                                    toast.success(locale === "ar" ? "تم رفع الصورة بنجاح" : "Image uploaded successfully");
                                  } catch (err) {
                                    const msg = err instanceof Error ? err.message : "";
                                    toast.error(locale === "ar" ? `فشل رفع الصورة: ${msg}` : `Image upload failed: ${msg}`);
                                  } finally {
                                    setUploadingSliderImage(false);
                                    e.target.value = "";
                                  }
                                }}
                              />
                            </label>
                            <span className="text-xs text-muted-foreground self-center">{locale === "ar" ? "أو أدخل رابط" : "or enter URL"}</span>
                          </div>
                          <Input
                            value={sliderForm.imageUrl}
                            onChange={(e) => setSliderForm((p) => ({ ...p, imageUrl: e.target.value }))}
                            placeholder="https://..."
                            dir="ltr"
                          />
                        </div>
                        <TrilingualInput
                          label={locale === "ar" ? "العنوان" : "Title"}
                          value={{ ar: sliderForm.titleAr, fr: sliderForm.titleFr, en: sliderForm.titleEn }}
                          onChange={(v) => setSliderForm((p) => ({ ...p, titleAr: v.ar, titleFr: v.fr, titleEn: v.en }))}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>{locale === "ar" ? "الترتيب" : "Order"}</Label>
                            <Input
                              type="number"
                              value={sliderForm.order}
                              onChange={(e) => setSliderForm((p) => ({ ...p, order: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{locale === "ar" ? "الرابط" : "Link"}</Label>
                            <Input
                              value={sliderForm.link}
                              onChange={(e) => setSliderForm((p) => ({ ...p, link: e.target.value }))}
                              placeholder="https://..."
                              dir="ltr"
                            />
                          </div>
                        </div>
                        <Button onClick={handleSliderSave} className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2">
                          <Check className="size-4" />
                          {locale === "ar" ? "حفظ" : "Save"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/*  SECTIONS VISIBILITY TAB                                  */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeTab === "sections" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <LayoutDashboard className="size-5 text-cyan-600" />
                    {locale === "ar" ? "إدارة أقسام الصفحة" : "Manage Page Sections"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {locale === "ar"
                      ? "تحكم في أي الأقسام تظهر على الصفحة الرئيسية. يمكنك إخفاء أو إظهار أي قسم."
                      : "Control which sections appear on the homepage. You can hide or show any section."}
                  </p>

                  <div className="space-y-2">
                    {DEFAULT_SECTIONS.map((section) => (
                      <div
                        key={section.key}
                        className="flex items-center justify-between rounded-xl border p-4 hover:border-cyan-300 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="size-4 text-muted-foreground/40 cursor-grab" />
                          <div>
                            <p className="font-medium">{locale === "ar" ? section.labelAr : section.labelEn}</p>
                            <p className="text-xs text-muted-foreground">
                              {section.key === "video"
                                ? (locale === "ar" ? "يظهر فقط إذا تم إضافة فيديو" : "Only shows if a video is added")
                                : section.key === "hero"
                                  ? (locale === "ar" ? "القسم الرئيسي - لا يمكن إخفاؤه" : "Main section - cannot be hidden")
                                  : ""}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={sectionVisibility[section.key]}
                          disabled={section.key === "hero"}
                          onCheckedChange={(checked) =>
                            setSectionVisibility((prev) => ({ ...prev, [section.key]: checked }))
                          }
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex gap-3">
                    <Button onClick={() => handleSave("sections")} disabled={saving !== null} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      {locale === "ar" ? "حفظ إعدادات الأقسام" : "Save Section Settings"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const defaults: Record<string, boolean> = {};
                        DEFAULT_SECTIONS.forEach((s) => { defaults[s.key] = s.defaultVisible; });
                        setSectionVisibility(defaults as Record<SectionKey, boolean>);
                      }}
                      className="gap-2"
                    >
                      <RotateCcw className="size-4" />
                      {locale === "ar" ? "إعادة تعيين" : "Reset"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/*  FIREBASE STATUS TAB                                      */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeTab === "firebase" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="size-5 text-amber-600" />
                    {locale === "ar" ? "حالة تسجيل الدخول بغوغل" : "Google Sign-In Status"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {locale === "ar"
                      ? "تحقق من حالة اتصال Firebase وتسجيل الدخول بغوغل. هذه الأداة تساعد في تشخيص مشاكل المصادقة."
                      : "Check Firebase connectivity and Google sign-in status. This tool helps diagnose authentication issues."}
                  </p>

                  <Button
                    onClick={checkFirebaseStatus}
                    disabled={checkingFirebase}
                    className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {checkingFirebase ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
                    {locale === "ar" ? "فحص الحالة" : "Check Status"}
                  </Button>

                  {firebaseStatus && (
                    <div className="space-y-3">
                      <div className={`rounded-xl p-4 ${firebaseStatus.overall === "ALL_CHECKS_PASSED" ? "bg-green-50 dark:bg-green-950/20 border border-green-200" : "bg-red-50 dark:bg-red-950/20 border border-red-200"}`}>
                        <p className="font-semibold flex items-center gap-2">
                          {firebaseStatus.overall === "ALL_CHECKS_PASSED" ? (
                            <><Check className="size-5 text-green-600" /> {locale === "ar" ? "كل الفحوصات ناجحة" : "All checks passed"}</>
                          ) : (
                            <><X className="size-5 text-red-600" /> {locale === "ar" ? "بعض الفحوصات فشلت" : "Some checks failed"}</>
                          )}
                        </p>
                      </div>

                      {(firebaseStatus.checks as Record<string, Record<string, unknown>> | undefined) && Object.entries(firebaseStatus.checks as Record<string, Record<string, unknown>>).map(([key, check]) => (
                        <div key={key} className="flex items-center gap-3 rounded-lg border p-3">
                          {check.ok ? (
                            <Check className="size-4 text-green-500 shrink-0" />
                          ) : (
                            <X className="size-4 text-red-500 shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{key}</p>
                            {typeof check.error === 'string' && check.error && <p className="text-xs text-destructive">{check.error}</p>}
                            {typeof check.latency === 'number' && <p className="text-xs text-muted-foreground">{check.latency}ms</p>}
                          </div>
                        </div>
                      ))}

                      {firebaseStatus.troubleshooting !== undefined && firebaseStatus.troubleshooting !== null && (
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 p-4">
                          <h4 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">
                            {locale === "ar" ? "نصائح لحل المشاكل" : "Troubleshooting Tips"}
                          </h4>
                          <pre className="text-xs whitespace-pre-wrap text-amber-800 dark:text-amber-300">
                            {JSON.stringify(firebaseStatus.troubleshooting, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ─── Bottom Action Bar ─── */}
        <div className="mt-8 flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm">
          <button
            onClick={() => navigate("home")}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="size-4" />
            {locale === "ar" ? "معاينة الصفحة الرئيسية" : "Preview Homepage"}
          </button>
          <Button
            onClick={() => handleSave("all")}
            disabled={saving !== null}
            className="bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white gap-2 shadow-lg shadow-teal-500/25"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {locale === "ar" ? "حفظ جميع التغييرات" : "Save All Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
