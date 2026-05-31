"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Settings,
  Search,
  Eye,
  UserX,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  GripVertical,
  X,
  BookOpen,
  Star,
  Clock,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Send,
  ExternalLink,
  Banknote,
  Shield,
  Upload,
  FileUp,
  Loader2,
  Paperclip,
  Ban,
  Crown,
  Headphones,
  Video,
  FileDown,
  Radio,
  ShoppingBag,
  Copy,
  Calendar,
  Filter,
  ArrowUpDown,
  Tag,
  Folder,
  ChevronDown,
  Link2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { adminHeaders, adminFormDataHeaders, setStoredAdminCode } from "@/lib/api-helpers";
import { cachedFetch } from "@/lib/client-cache";
// ─── HTML Sanitization ──────────────────────────────────────────────────────────

function sanitizeDisplayHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/(href|src)\s*=\s*["']?\s*(javascript\s*:|data\s*:\s*text\/html)[^"'>]*/gi, '$1=""');
}


import { directCloudinaryUpload, shouldUseDirectUpload } from "@/lib/cloudinary-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTab = "dashboard" | "members" | "payments" | "purchases" | "content" | "prices" | "homepage" | "settings";
type ContentSubTab =
  | "courses"
  | "articles"
  | "podcasts"
  | "videos"
  | "pdfs"
  | "live"
  | "coaching";

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  subscription: string;
  status: "active" | "inactive";
  joined: string;
}

interface Payment {
  id: string;
  userName: string;
  userEmail: string;
  planType: string;
  amount: string;
  ccpNumber: string;
  receiptUrl: string;
  status: "pending" | "approved" | "rejected";
  timestamp: string;
  isPurchase?: boolean; // true = individual content purchase, false/undefined = subscription payment
  purchaseEndpoint?: string; // API endpoint for approve/reject
}

interface ContentItem {
  id: string;
  title: string;
  titleAr?: string;
  titleFr?: string;
  titleEn?: string;
  description: string;
  descriptionAr?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  imageUrl: string;
  isFree: boolean;
  price: number | null;
  status: "published" | "draft";
  date: string;
  category?: string;
  tags?: string;
  viewCount?: number;
  scheduledAt?: string;
  chapters?: Array<{
    id: string;
    title: string;
    titleAr?: string;
    titleFr?: string;
    titleEn?: string;
    order: number;
    lessons?: Array<{
      id: string;
      title: string;
      titleAr?: string;
      titleFr?: string;
      titleEn?: string;
      videoUrl?: string;
      duration?: string;
      order: number;
      isFree?: boolean;
    }>;
  }>;
  // SEO fields
  metaTitleAr?: string;
  metaTitleFr?: string;
  metaTitleEn?: string;
  metaDescAr?: string;
  metaDescFr?: string;
  metaDescEn?: string;
  ogImage?: string;
}

interface Slider {
  id: string;
  imageUrl: string;
  title: string;
  order: number;
}

// ─── PLAN TYPE LABELS ─────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  full: "الوصول الكامل",
  courses: "الدورات",
  articles: "المقالات",
  podcasts: "البودكاست",
  videos: "الفيديوهات",
  pdfs: "الكتب PDF",
  live: "البث المباشر",
  coaching: "الكوتشنغ",
};

// ─── Content API Config ────────────────────────────────────────────────────

const CONTENT_API_CONFIG: Record<ContentSubTab, { endpoint: string; responseKey: string; contentType: string }> = {
  courses: { endpoint: "/api/courses", responseKey: "courses", contentType: "course" },
  articles: { endpoint: "/api/articles", responseKey: "articles", contentType: "article" },
  podcasts: { endpoint: "/api/podcasts", responseKey: "podcasts", contentType: "podcast" },
  videos: { endpoint: "/api/videos", responseKey: "videos", contentType: "video" },
  pdfs: { endpoint: "/api/pdfs", responseKey: "pdfs", contentType: "pdf" },
  live: { endpoint: "/api/live", responseKey: "liveSessions", contentType: "live" },
  coaching: { endpoint: "/api/coachings", responseKey: "coachings", contentType: "coaching" },
};

// ─── Section Labels Config ─────────────────────────────────────────────────

const SECTION_LABELS: Record<ContentSubTab, {
  addNew: string; edit: string; noData: string;
  imageLabel: string; descriptionLabel: string;
  acceptTypes?: string[];
}> = {
  courses: { addNew: "إضافة دورة", edit: "تعديل الدورة", noData: "لا توجد دورات بعد", imageLabel: "صورة الغلاف", descriptionLabel: "وصف الدورة" },
  articles: { addNew: "إضافة مقالة", edit: "تعديل المقالة", noData: "لا توجد مقالات بعد", imageLabel: "صورة المقالة", descriptionLabel: "وصف المقالة" },
  podcasts: { addNew: "إضافة بودكاست", edit: "تعديل البودكاست", noData: "لا توجد بودكاست بعد", imageLabel: "صورة البودكاست", descriptionLabel: "وصف البودكاست" },
  videos: { addNew: "إضافة فيديو", edit: "تعديل الفيديو", noData: "لا توجد فيديوهات بعد", imageLabel: "صورة الفيديو", descriptionLabel: "وصف الفيديو" },
  pdfs: { addNew: "إضافة كتاب PDF", edit: "تعديل الكتاب", noData: "لا توجد كتب PDF بعد", imageLabel: "رفع ملف PDF", descriptionLabel: "وصف الكتاب", acceptTypes: ["application/pdf"] },
  live: { addNew: "إضافة جلسة مباشرة", edit: "تعديل الجلسة", noData: "لا توجد جلسات مباشرة بعد", imageLabel: "صورة الجلسة", descriptionLabel: "وصف الجلسة" },
  coaching: { addNew: "إضافة كوتشنغ", edit: "تعديل الكوتشنغ", noData: "لا توجد عناصر كوتشنغ بعد", imageLabel: "صورة الكوتشنغ", descriptionLabel: "وصف الكوتشنغ" },
};

// Helper to normalize raw API item to ContentItem
function normalizeContentItem(raw: Record<string, unknown>): ContentItem {
  // Normalize chapters with lessons
  const chapters = raw.chapters as ContentItem["chapters"];
  const normalizedChapters = chapters?.map((ch) => ({
    ...ch,
    lessons: (ch as any).lessons || [],
  }));

  return {
    id: raw.id as string,
    title: (raw.titleAr as string) || (raw.title as string) || "",
    titleAr: raw.titleAr as string | undefined,
    titleFr: raw.titleFr as string | undefined,
    titleEn: raw.titleEn as string | undefined,
    description: (raw.descriptionAr as string) || (raw.description as string) || "",
    descriptionAr: raw.descriptionAr as string | undefined,
    descriptionFr: raw.descriptionFr as string | undefined,
    descriptionEn: raw.descriptionEn as string | undefined,
    imageUrl: (raw.image as string) || (raw.thumbnail as string) || "",
    isFree: (raw.isFree as boolean) ?? false,
    price: (raw.price as number) ?? null,
    status: ((raw.status as string) === "published" ? "published" : "draft") as "published" | "draft",
    date: raw.createdAt ? new Date(raw.createdAt as string).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    category: raw.category as string | undefined,
    tags: raw.tags as string | undefined,
    viewCount: (raw.viewCount as number) ?? 0,
    scheduledAt: raw.scheduledAt as string | undefined,
    chapters: normalizedChapters,
    metaTitleAr: raw.metaTitleAr as string | undefined,
    metaTitleFr: raw.metaTitleFr as string | undefined,
    metaTitleEn: raw.metaTitleEn as string | undefined,
    metaDescAr: raw.metaDescAr as string | undefined,
    metaDescFr: raw.metaDescFr as string | undefined,
    metaDescEn: raw.metaDescEn as string | undefined,
    ogImage: raw.ogImage as string | undefined,
  };
}

// ─── Sidebar nav items config ────────────────────────────────────────────────

const sidebarItems: { key: AdminTab; icon: typeof LayoutDashboard; labelKey: string }[] = [
  { key: "dashboard", icon: LayoutDashboard, labelKey: "admin.dashboard" },
  { key: "members", icon: Users, labelKey: "admin.members" },
  { key: "payments", icon: CreditCard, labelKey: "admin.payments" },
  { key: "purchases", icon: ShoppingBag, labelKey: "admin.individualPurchases" },
  { key: "content", icon: FileText, labelKey: "admin.content" },
  { key: "homepage", icon: BookOpen, labelKey: "admin.homepageEditor" },
  { key: "prices", icon: Banknote, labelKey: "admin.prices" },
  { key: "settings", icon: Settings, labelKey: "admin.settings" },
];

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FILE UPLOAD COMPONENT ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// NOTE: We no longer restrict file types — all file types are now allowed.
// Only dangerous extensions (exe, bat, sh, etc.) are blocked server-side.
// These constants are kept for backward compatibility where needed.
const ACCEPTED_IMAGE_TYPES = ["image/*"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeInfo(file: File): { label: string; color: string } {
  if (file.type.startsWith("image/")) {
    return { label: "Image", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400" };
  }
  if (file.type.startsWith("audio/")) {
    return { label: "Audio", color: "text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400" };
  }
  if (file.type.startsWith("video/")) {
    return { label: "Video", color: "text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400" };
  }
  if (file.type === "application/pdf") {
    return { label: "PDF", color: "text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-400" };
  }
  if (file.type.startsWith("text/")) {
    return { label: "Text", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950 dark:text-cyan-400" };
  }
  if (file.type.includes("zip") || file.type.includes("rar") || file.type.includes("compress")) {
    return { label: "Archive", color: "text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400" };
  }
  if (file.type.includes("word") || file.type.includes("document")) {
    return { label: "Document", color: "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400" };
  }
  if (file.type.includes("spreadsheet") || file.type.includes("excel")) {
    return { label: "Spreadsheet", color: "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400" };
  }
  if (file.type.includes("presentation")) {
    return { label: "Presentation", color: "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400" };
  }
  return { label: "File", color: "text-muted-foreground bg-muted" };
}

interface FileUploadComponentProps {
  value: string;
  onChange: (value: string) => void;
  acceptTypes?: string[]; // Kept for backward compat, but no longer restricts
  label?: string;
  placeholder?: string;
  maxSizeMB?: number; // Max file size in MB (default 100)
  uploadType?: string; // "content" or "receipt" — sent to /api/upload
  contentType?: string; // "courses", "articles", etc. — Cloudinary folder organization
}

function FileUploadComponent({
  value,
  onChange,
  acceptTypes,
  label,
  placeholder,
  maxSizeMB = 100,
  uploadType = "content",
  contentType,
}: FileUploadComponentProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [fileType, setFileType] = useState<{ label: string; color: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("upload");

  // Derive effective tab from value: if value is an external URL (not base64) and no file was uploaded, show URL tab
  const effectiveTab = (value && !value.startsWith("data:") && !fileName) ? "url" : activeTab;

  // Helper: check if value looks like an image URL
  const isImageUrl = (url: string): boolean => {
    if (url.startsWith("data:image")) return true;
    const lower = url.toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(lower) ||
      lower.includes("firebasestorage.googleapis.com") ||
      lower.includes("storage.googleapis.com") ||
      lower.includes("res.cloudinary.com");
  };

  // Helper: check if value is a video URL
  const isVideoUrl = (url: string): boolean => {
    if (!url || url.startsWith("data:")) return false;
    const lower = url.toLowerCase();
    return /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(lower) ||
      (lower.includes("res.cloudinary.com") && lower.includes("/video/"));
  };

  // Helper: check if value is an audio URL
  const isAudioUrl = (url: string): boolean => {
    if (!url || url.startsWith("data:")) return false;
    const lower = url.toLowerCase();
    return /\.(mp3|wav|ogg|m4a|aac|flac)(\?.*)?$/i.test(lower) ||
      (lower.includes("res.cloudinary.com") && lower.includes("/video/") && /\.(mp3|wav|ogg|m4a|aac|flac)/i.test(lower));
  };

  // Upload file — uses direct Cloudinary upload for large files (>3MB)
  // to bypass Vercel's serverless body size limit (~4.5MB on Hobby plan).
  // Small files still go through /api/upload for server-side processing.
  const processFile = useCallback(async (file: File) => {
    const typeInfo = getFileTypeInfo(file);
    setFileName(file.name);
    setFileSize(formatFileSize(file.size));
    setFileType(typeInfo);
    setUploading(true);
    setUploadProgress(0);

    // Client-side file size check
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${maxSizeMB}MB`);
      setUploading(false);
      setUploadProgress(0);
      return;
    }

    try {
      // ── For receipt uploads, always use server-mediated upload ──
      if (uploadType === "receipt") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "receipt");

        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) { clearInterval(progressInterval); return 90; }
            return prev + Math.random() * 15;
          });
        }, 300);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload failed");
        }

        const data = await res.json();
        onChange(data.url);
        setUploadProgress(100);
        setUploading(false);
        toast.success(t("admin.uploadSuccess") || "تم رفع الملف بنجاح");
        return;
      }

      // ── For content uploads: use direct Cloudinary upload for large files ──
      // Bypasses Vercel's 4.5MB body size limit on Hobby plan
      if (shouldUseDirectUpload(file.size)) {
        const result = await directCloudinaryUpload(
          file,
          { contentType: contentType || undefined },
          (percent) => setUploadProgress(percent)
        );
        onChange(result.url);
        setUploadProgress(100);
        setUploading(false);
        toast.success(t("admin.uploadSuccess") || "تم رفع الملف بنجاح");
        return;
      }

      // ── For small content uploads: use server-mediated upload ──
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", uploadType);
      if (contentType) {
        formData.append("contentType", contentType);
      }

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) { clearInterval(progressInterval); return 90; }
          return prev + Math.random() * 15;
        });
      }, 300);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: adminFormDataHeaders(),
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      onChange(data.url);
      setUploadProgress(100);
      setUploading(false);
      toast.success(t("admin.uploadSuccess") || "تم رفع الملف بنجاح");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
      setUploading(false);
      setUploadProgress(0);
    }
  }, [onChange, t, maxSizeMB, uploadType, contentType]);

  // Handle file input change — all file types accepted
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // No type restriction — accept all files (server validates dangerous extensions)
    processFile(file);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    // No type restriction — accept all files
    processFile(file);
  };

  // Clear upload
  const handleClear = () => {
    onChange("");
    setFileName(null);
    setFileSize(null);
    setFileType(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm">{label}</Label>
      )}

      {/* Tab switch: Upload File | External URL */}
      <Tabs value={effectiveTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-9 grid grid-cols-2">
          <TabsTrigger value="upload" className="text-xs gap-1.5 data-[state=active]:bg-teal-600 data-[state=active]:text-white">
            <Upload className="size-3.5" />
            {t("admin.uploadFile") || "رفع ملف"}
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs gap-1.5 data-[state=active]:bg-teal-600 data-[state=active]:text-white">
            <Paperclip className="size-3.5" />
            {t("admin.externalUrl") || "رابط خارجي"}
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-2">
          {/* Hidden file input — no accept restriction, all file types allowed */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload file"
          />

          {/* Preview area */}
          {value && (value.startsWith("data:image") || (value.startsWith("http") && isImageUrl(value))) && !uploading ? (
            <div className="relative rounded-lg overflow-hidden border bg-muted">
              <div className="aspect-video relative">
                <img
                  src={value}
                  alt="Preview"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              {(fileName || value) && (
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white px-3 py-1.5 flex items-center justify-between">
                  <span className="text-xs truncate me-2">{fileName || "Uploaded image"}{fileSize ? ` (${fileSize})` : ""}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-white hover:bg-white/20 shrink-0"
                    onClick={handleClear}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ) : value && isVideoUrl(value) && !uploading ? (
            /* Video preview */
            <div className="relative rounded-lg overflow-hidden border bg-muted">
              <div className="aspect-video relative">
                <video
                  src={value}
                  controls
                  className="w-full h-full object-contain"
                  preload="metadata"
                />
              </div>
              {(fileName || value) && (
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white px-3 py-1.5 flex items-center justify-between">
                  <span className="text-xs truncate me-2">{fileName || "Uploaded video"}{fileSize ? ` (${fileSize})` : ""}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-white hover:bg-white/20 shrink-0"
                    onClick={handleClear}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ) : value && isAudioUrl(value) && !uploading ? (
            /* Audio preview */
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0 flex items-center justify-center size-10 rounded-lg bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
                  <Headphones className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName || "Uploaded audio"}</p>
                  {fileSize && <p className="text-xs text-muted-foreground">{fileSize}</p>}
                  <audio src={value} controls className="mt-2 w-full h-8" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 shrink-0"
                  onClick={handleClear}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ) : value && !uploading ? (
            /* Non-image file preview (URL or base64) */
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <div className={`shrink-0 flex items-center justify-center size-10 rounded-lg ${fileType?.color || "bg-muted"}`}>
                  <FileUp className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{fileName || "Uploaded file"}</p>
                  {fileSize && <p className="text-xs text-muted-foreground">{fileSize}</p>}
                  {fileType && (
                    <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-1 ${fileType.color}`}>
                      {fileType.label}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                  onClick={handleClear}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          ) : (uploading ? (
            /* Upload in progress */
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 p-8"
            >
              <Loader2 className="size-8 text-teal-500 animate-spin" />
              <p className="text-sm text-muted-foreground">{t("admin.uploading") || "جارٍ الرفع..."}</p>
              <div className="w-full max-w-xs bg-muted rounded-full h-2">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{Math.round(uploadProgress)}%</p>
            </div>
          ) : (
            /* Drop zone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-all duration-200 ${
                isDragOver
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30"
                  : "border-muted-foreground/25 hover:border-teal-400 hover:bg-muted/50"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <>
                <div className={`p-3 rounded-full transition-colors ${isDragOver ? "bg-teal-100 dark:bg-teal-900" : "bg-muted"}`}>
                  <Upload className={`size-6 ${isDragOver ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {t("admin.dragDropOrClick") || "اسحب وأسقط الملف هنا أو انقر للاختيار"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("admin.allFileTypes") || "جميع أنواع الملفات مدعومة (الحد الأقصى " + maxSizeMB + "MB)"}
                  </p>
                </div>
              </>
            </div>
          ))}
        </TabsContent>

        {/* URL Tab */}
        <TabsContent value="url" className="mt-2">
          <div className="space-y-2">
            <Input
              placeholder={placeholder || "https://example.com/image.jpg"}
              value={value.startsWith("data:") ? "" : value}
              onChange={(e) => {
                onChange(e.target.value);
                setFileName(null);
                setFileSize(null);
                setFileType(null);
              }}
              dir="ltr"
            />
            {/* Show URL preview for images */}
            {value && !value.startsWith("data:") && (
              <div className="relative rounded-lg overflow-hidden border bg-muted">
                <div className="aspect-video relative">
                  <img
                    src={value}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 end-2 h-7 w-7 p-0 bg-black/50 text-white hover:bg-black/70 rounded-full"
                  onClick={handleClear}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  "علاج نفسي",
  "تطوير ذاتي",
  "صحة نفسية",
  "علاقات",
  "تأمل",
  "أخرى",
];

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RICH TEXT EDITOR COMPONENT ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  dir?: string;
}

function ToolbarButton({ onClick, active, children, title }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`p-1.5 rounded hover:bg-muted transition-colors ${active ? "bg-muted text-teal-600" : "text-muted-foreground"}`}
      title={title}
    >
      {children}
    </button>
  );
}

function RichTextEditor({ value, onChange, placeholder, dir }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  // Sync initial value
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const execCommand = (command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    onChange(editorRef.current?.innerHTML || "");
  };

  const handleInput = () => {
    onChange(editorRef.current?.innerHTML || "");
  };

  const insertLink = () => {
    if (linkUrl.trim()) {
      execCommand("createLink", linkUrl.trim());
    }
    setShowLinkInput(false);
    setLinkUrl("");
  };

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 border-b bg-muted/30 flex-wrap">
        <ToolbarButton onClick={() => execCommand("bold")} title="Bold">
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand("italic")} title="Italic">
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand("underline")} title="Underline">
          <Underline className="size-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => execCommand("formatBlock", "h2")} title="Heading 2">
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand("formatBlock", "h3")} title="Heading 3">
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => execCommand("insertUnorderedList")} title="Unordered List">
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand("insertOrderedList")} title="Ordered List">
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => execCommand("justifyLeft")} title="Align Left">
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand("justifyCenter")} title="Align Center">
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand("justifyRight")} title="Align Right">
          <AlignRight className="size-4" />
        </ToolbarButton>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarButton onClick={() => setShowLinkInput(!showLinkInput)} title="Insert Link">
          <Link2 className="size-4" />
        </ToolbarButton>
      </div>

      {/* Link input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 p-2 border-b bg-muted/20">
          <Input
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="h-8 text-sm"
            dir="ltr"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } }}
          />
          <Button type="button" size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white" onClick={insertLink}>
            <Check className="size-3" />
          </Button>
        </div>
      )}

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        dir={dir}
        className="min-h-[150px] p-3 text-sm focus:outline-none prose prose-sm max-w-none dark:prose-invert"
        data-placeholder={placeholder}
        style={{ wordBreak: "break-word" }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const { t } = useTranslation();
  const { pageParams, navigate, locale, isAdmin, user, isLoadingAuth } = useAppStore();
  const isRtl = locale === "ar";
  const activeTab = (pageParams.tab as AdminTab) || "dashboard";

  // Show loading state while session is being restored
  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600" />
      </div>
    );
  }

  // Client-side admin auth gate: redirect non-admins
  if (!isAdmin || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
        <Shield className="h-16 w-16 text-muted-foreground/30" />
        <h2 className="text-2xl font-bold text-foreground">{t("common.accessDenied") || "Access Denied"}</h2>
        <p className="text-muted-foreground text-center max-w-md">
          {locale === "ar" ? "هذه الصفحة متاحة فقط للمسؤولين" : locale === "fr" ? "Cette page est réservée aux administrateurs" : "This page is only available to administrators"}
        </p>
        <Button onClick={() => navigate("home")} className="gap-2">
          {locale === "ar" ? "العودة للرئيسية" : locale === "fr" ? "Retour à l'accueil" : "Back to Home"}
        </Button>
      </div>
    );
  }

  const setTab = (tab: AdminTab) => {
    navigate("admin", { tab });
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-8rem)] gap-0">
      {/* ─── Sidebar (desktop) ─── */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 rounded-xl border bg-card p-4 gap-1 sticky top-24 self-start max-h-[calc(100vh-8rem)]">
        <div className="mb-4 ps-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Settings className="size-5 text-teal-600" />
            {t("nav.admin")}
          </h2>
        </div>
        <Separator className="mb-2" />
        <nav className="flex flex-col gap-1 flex-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ─── Mobile Tabs ─── */}
      <div className="lg:hidden flex gap-1 overflow-x-auto pb-2 scrollbar-none mb-4">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-teal-600 text-white shadow-md"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>

      {/* ─── Main Content ─── */}
      <main className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={fadeInUp}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {activeTab === "dashboard" && <DashboardView />}
            {activeTab === "members" && <MembersView />}
            {activeTab === "payments" && <PaymentsView />}
            {activeTab === "purchases" && <PurchasesView />}
            {activeTab === "content" && <ContentView />}
            {activeTab === "homepage" && <HomepageCustomizer />}
            {activeTab === "prices" && <PricesView />}
            {activeTab === "settings" && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TAB 1: DASHBOARD ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardView() {
  const { t } = useTranslation();
  const [statsData, setStatsData] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats", { headers: adminHeaders() });
        if (res.ok) {
          const data = await res.json();
          setStatsData(data.stats);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const stats = [
    { labelKey: "admin.totalMembers", value: statsData ? String(statsData.totalMembers || 0) : "—", change: "", up: true, icon: Users, color: "teal" },
    { labelKey: "admin.totalCourses", value: statsData ? String(statsData.totalCourses || 0) : "—", change: "", up: true, icon: BookOpen, color: "emerald" },
    { labelKey: "admin.totalSubscriptions", value: statsData ? String(statsData.activeSubscriptions || 0) : "—", change: "", up: true, icon: CreditCard, color: "violet" },
    { labelKey: "admin.avgRating", value: statsData ? String(statsData.avgRating || 0) : "—", change: "", up: true, icon: Star, color: "amber" },
    { labelKey: "admin.pendingPayments", value: statsData ? String(statsData.pendingPayments || 0) : "—", change: "", up: false, icon: Clock, color: "rose" },
  ];

  const colorMap: Record<string, { bg: string; icon: string; ring: string }> = {
    teal: { bg: "bg-teal-50 dark:bg-teal-950/50", icon: "text-teal-600 dark:text-teal-400", ring: "ring-teal-100 dark:ring-teal-900" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/50", icon: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-100 dark:ring-emerald-900" },
    violet: { bg: "bg-violet-50 dark:bg-violet-950/50", icon: "text-violet-600 dark:text-violet-400", ring: "ring-violet-100 dark:ring-violet-900" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/50", icon: "text-amber-600 dark:text-amber-400", ring: "ring-amber-100 dark:ring-amber-900" },
    rose: { bg: "bg-rose-50 dark:bg-rose-950/50", icon: "text-rose-600 dark:text-rose-400", ring: "ring-rose-100 dark:ring-rose-900" },
  };

  const activities = loading
    ? []
    : [
        ...(statsData?.totalMembers ? [{ id: "s1", type: "member" as const, text: `${t("admin.totalMembers")}: ${statsData.totalMembers}`, time: t("admin.dashboard") }] : []),
        ...(statsData?.pendingPayments ? [{ id: "s2", type: "payment" as const, text: `${t("admin.pendingPayments")}: ${statsData.pendingPayments}`, time: t("admin.dashboard") }] : []),
      ];

  const activityIcons: Record<string, typeof Users> = {
    member: Users,
    payment: CreditCard,
    content: FileText,
  };

  const activityColors: Record<string, string> = {
    member: "text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-950",
    payment: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950",
    content: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.dashboard")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.statistics")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const colors = colorMap[stat.color];
          return (
            <motion.div
              key={stat.labelKey}
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-lg ring-1 ${colors.ring} ${colors.bg}`}>
                      <Icon className={`size-5 ${colors.icon}`} />
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${stat.up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {stat.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {stat.change}
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(stat.labelKey)}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("admin.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {activities.map((activity) => {
              const AIcon = activityIcons[activity.type];
              const aColor = activityColors[activity.type];
              return (
                <div key={activity.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/50 transition-colors">
                  <div className={`p-2 rounded-full ${aColor}`}>
                    <AIcon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{activity.text}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TAB 2: MEMBERS ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function MembersView() {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);
  const isRtl = locale === "ar";
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch("/api/admin/members", { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMembers(
          (data.users || []).map((u: Record<string, unknown>) => ({
            id: u.id as string,
            name: (u.name as string) || "—",
            email: (u.email as string) || "—",
            phone: (u.phone as string) || "—",
            subscription: Array.isArray(u.subscriptions) && u.subscriptions.length > 0
              ? PLAN_LABELS[(u.subscriptions as Array<Record<string, string>>)[0].type] || (u.subscriptions as Array<Record<string, string>>)[0].type
              : t("admin.noSubscription"),
            status: u.isActive !== false ? "active" as const : "inactive" as const,
            joined: u.createdAt ? new Date(u.createdAt as string).toISOString().split("T")[0] : "—",
          }))
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || t("common.error"));
      }
    } catch (e) { console.error(e); toast.error(t("common.error")); }
    finally { setLoadingMembers(false); }
  }, [t]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ type: "activate" | "deactivate" | "cancelSub" | "delete"; member: Member | null }>({ type: "activate", member: null });
  const perPage = 5;

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === "all" || m.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [members, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handleToggleStatus = async () => {
    if (!confirmAction.member) return;
    try {
      const res = await fetch("/api/admin/members", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          userId: confirmAction.member.id,
          isActive: confirmAction.type === "activate",
        }),
      });
      if (res.ok) {
        toast.success(
          confirmAction.type === "activate"
            ? t("admin.memberActivated")
            : t("admin.memberDeactivated")
        );
        fetchMembers();
      } else {
        toast.error(t("common.error"));
      }
    } catch { toast.error(t("common.error")); }
    setConfirmAction({ type: "activate", member: null });
  };

  const handleCancelSubscription = async () => {
    if (!confirmAction.member) return;
    try {
      // Fetch user's active subscriptions and delete them all
      const subRes = await fetch(`/api/subscriptions?userId=${confirmAction.member.id}`);
      if (subRes.ok) {
        const subData = await subRes.json();
        const subs = (subData.subscriptions || []).filter(
          (s: { status: string }) => s.status === "active"
        );
        for (const sub of subs) {
          await fetch(`/api/subscriptions?id=${sub.id}`, {
            method: "DELETE",
            headers: adminHeaders(),
          });
        }
      }
      toast.success(t("admin.subscriptionCancelled") || "تم إلغاء الاشتراك بنجاح");
      fetchMembers();
    } catch {
      toast.error(t("common.error"));
    }
    setConfirmAction({ type: "activate", member: null });
  };

  const handleDeleteMember = async () => {
    if (!confirmAction.member) return;
    try {
      const res = await fetch(`/api/admin/members/${confirmAction.member.id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) {
        toast.success(locale === "ar" ? "تم حذف العضو بنجاح" : locale === "fr" ? "Membre supprimé avec succès" : "Member deleted successfully");
        fetchMembers();
      } else {
        const data = await res.json();
        toast.error(data.error || t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    }
    setConfirmAction({ type: "activate", member: null });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.members")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.manageMembers")}</p>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.searchMembers")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="ps-9"
          />
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(f === "all" ? "admin.all" : f === "active" ? "admin.active" : "admin.inactive")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("admin.email")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("admin.phone")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("admin.subscription")}</TableHead>
                <TableHead>{t("admin.status")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("admin.joined")}</TableHead>
                <TableHead>{t("admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingMembers ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Skeleton className="h-4 w-32 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {t("admin.noMembersFound")}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs font-medium">
                            {member.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{member.email}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{member.phone}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={member.subscription === t("admin.fullAccess") ? "default" : "secondary"} className="text-xs">
                        {member.subscription}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.status === "active" ? "default" : "secondary"}
                        className={
                          member.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300 border-0"
                        }
                      >
                        {t(member.status === "active" ? "admin.active" : "admin.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{member.joined}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <span className="sr-only">{t("admin.actions")}</span>
                            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRtl ? "start" : "end"}>
                          <DropdownMenuItem className="cursor-pointer">
                            <Eye className="size-4 me-2" />
                            {t("admin.viewDetails")}
                          </DropdownMenuItem>
                          {member.status === "active" ? (
                            <DropdownMenuItem
                              className="cursor-pointer text-rose-600 focus:text-rose-600"
                              onClick={() => setConfirmAction({ type: "deactivate", member })}
                            >
                              <UserX className="size-4 me-2" />
                              {t("admin.deactivate")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="cursor-pointer text-emerald-600 focus:text-emerald-600"
                              onClick={() => setConfirmAction({ type: "activate", member })}
                            >
                              <UserCheck className="size-4 me-2" />
                              {t("admin.activate")}
                            </DropdownMenuItem>
                          )}
                          {member.subscription !== t("admin.noSubscription") && (
                            <DropdownMenuItem
                              className="cursor-pointer text-amber-600 focus:text-amber-600"
                              onClick={() => setConfirmAction({ type: "cancelSub", member })}
                            >
                              <Ban className="size-4 me-2" />
                              {t("admin.cancelSubscription")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="cursor-pointer text-red-600 focus:text-red-600"
                            onClick={() => setConfirmAction({ type: "delete", member })}
                          >
                            <Trash2 className="size-4 me-2" />
                            {locale === "ar" ? "حذف العضو" : locale === "fr" ? "Supprimer le membre" : "Delete Member"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {t("admin.showing")} {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filtered.length)} {t("admin.of")} {filtered.length} {t("admin.entries")}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              {isRtl ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              {isRtl ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction.member} onOpenChange={(open) => { if (!open) setConfirmAction({ type: "activate", member: null }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction.type === "activate"
                ? t("admin.activate")
                : confirmAction.type === "cancelSub"
                  ? (t("admin.cancelSubscription") || "إلغاء الاشتراك")
                  : confirmAction.type === "delete"
                    ? (locale === "ar" ? "حذف العضو" : locale === "fr" ? "Supprimer le membre" : "Delete Member")
                    : t("admin.deactivate")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.type === "activate"
                ? t("admin.confirmActivate")
                : confirmAction.type === "cancelSub"
                  ? (t("admin.confirmCancelSub") || `هل أنت متأكد من إلغاء اشتراك "${confirmAction.member?.name}"؟ سيتم حذف جميع اشتراكاته النشطة.`)
                  : confirmAction.type === "delete"
                    ? (locale === "ar" ? `هل أنت متأكد من حذف العضو "${confirmAction.member?.name}"؟ سيتم حذف جميع بياناته نهائياً ولا يمكن التراجع عن هذا الإجراء.` : locale === "fr" ? `Êtes-vous sûr de vouloir supprimer le membre "${confirmAction.member?.name}" ? Toutes ses données seront définitivement supprimées et cette action est irréversible.` : `Are you sure you want to delete member "${confirmAction.member?.name}"? All their data will be permanently deleted and this action cannot be undone.`)
                    : t("admin.confirmDeactivate")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={
                confirmAction.type === "cancelSub"
                  ? handleCancelSubscription
                  : confirmAction.type === "delete"
                    ? handleDeleteMember
                    : handleToggleStatus
              }
              className={confirmAction.type === "cancelSub" ? "bg-amber-600 hover:bg-amber-700" : confirmAction.type === "delete" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {confirmAction.type === "activate"
                ? t("admin.activate")
                : confirmAction.type === "cancelSub"
                  ? (t("admin.cancelSubscription") || "إلغاء الاشتراك")
                  : confirmAction.type === "delete"
                    ? (locale === "ar" ? "حذف نهائي" : locale === "fr" ? "Supprimer définitivement" : "Delete Permanently")
                    : t("admin.deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TAB 3: PAYMENTS ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function PaymentsView() {
  const { t, locale } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      // Fetch subscription payments
      const payRes = await fetch("/api/payments", { headers: adminHeaders() });
      const subscriptionPayments: Payment[] = [];
      if (payRes.ok) {
        const payData = await payRes.json();
        subscriptionPayments.push(
          ...(payData.payments || []).map((p: Record<string, unknown>) => ({
            id: p.id as string,
            userName: (p.user as Record<string, string>)?.name || "—",
            userEmail: (p.user as Record<string, string>)?.email || "—",
            planType: PLAN_LABELS[p.subscriptionType as string] || (p.subscriptionType as string),
            amount: `${Number(p.amount).toLocaleString()} DA`,
            ccpNumber: (p.ccpNumber as string) || "—",
            receiptUrl: (p.receiptImage as string) || "",
            status: p.status as "pending" | "approved" | "rejected",
            timestamp: new Date(p.createdAt as string).toLocaleString(),
            isPurchase: false,
            purchaseEndpoint: "/api/payments",
          }))
        );
      }

      // Fetch individual purchases
      const purRes = await fetch("/api/purchases", { headers: adminHeaders() });
      const purchasePayments: Payment[] = [];
      if (purRes.ok) {
        const purData = await purRes.json();
        const contentTypeNames: Record<string, string> = {
          courses: "دورة",
          articles: "مقال",
          podcasts: "بودكاست",
          videos: "فيديو",
          pdfs: "كتاب إلكتروني",
          live: "جلسة مباشرة",
        };

        // Collect unique userIds and fetch their info
        const purchases = purData.purchases || [];
        const userIds = [...new Set(purchases.map((p: any) => p.userId).filter(Boolean))];
        const userMap: Record<string, { name: string; email: string }> = {};

        // Fetch all members to build a lookup map
        const membersRes = await fetch("/api/admin/members", { headers: adminHeaders() });
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          for (const m of (membersData.users || [])) {
            userMap[m.id] = { name: m.name || "—", email: m.email || "—" };
          }
        }

        purchasePayments.push(
          ...purchases.map((p: Record<string, unknown>) => {
            const userInfo = userMap[p.userId as string] || { name: "—", email: "—" };
            return {
              id: p.id as string,
              userName: userInfo.name,
              userEmail: userInfo.email,
              planType: `${contentTypeNames[p.contentType as string] || p.contentType}: ${(p.contentTitleAr as string) || (p.contentTitle as string) || "—"}`,
              amount: `${Number(p.amount).toLocaleString()} DA`,
              ccpNumber: (p.ccpNumber as string) || "—",
              receiptUrl: (p.receiptImage as string) || "",
              status: p.status as "pending" | "approved" | "rejected",
              timestamp: new Date(p.createdAt as string).toLocaleString(),
              isPurchase: true,
              purchaseEndpoint: `/api/purchases/${p.id as string}`,
            };
          })
        );
      }

      // Combine both and sort by date descending
      const allPayments = [...subscriptionPayments, ...purchasePayments];
      allPayments.sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });
      setPayments(allPayments);
    } catch (e) { console.error(e); }
    finally { setLoadingPayments(false); }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  const [subTab, setSubTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [receiptDialog, setReceiptDialog] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "reject" | "delete"; payment: Payment | null }>({ type: "approve", payment: null });

  const filtered = useMemo(() => payments.filter((p) => p.status === subTab), [payments, subTab]);

  const handleAction = async () => {
    if (!confirmAction.payment) return;

    // Handle delete separately
    if (confirmAction.type === "delete") {
      try {
        const endpoint = confirmAction.payment.isPurchase ? `/api/purchases/${confirmAction.payment.id}` : `/api/payments/${confirmAction.payment.id}`;
        const res = await fetch(endpoint, {
          method: "DELETE",
          headers: adminHeaders(),
        });
        if (res.ok) {
          toast.success(locale === "ar" ? "تم حذف الدفع بنجاح. الاشتراك محفوظ." : locale === "fr" ? "Paiement supprimé avec succès. L'abonnement est préservé." : "Payment deleted successfully. Subscription is preserved.");
          fetchPayments();
        } else {
          toast.error(t("common.error"));
        }
      } catch {
        toast.error(t("common.error"));
      }
      setConfirmAction({ type: "approve", payment: null });
      return;
    }

    try {
      let endpoint: string;
      let body: Record<string, unknown>;

      if (confirmAction.payment.isPurchase) {
        // Individual purchase: PUT /api/purchases/[id] with { status }
        endpoint = `/api/purchases/${confirmAction.payment.id}`;
        body = { status: confirmAction.type === "approve" ? "approved" : "rejected" };
      } else {
        // Subscription payment: PUT /api/payments with { id, status }
        endpoint = "/api/payments";
        body = {
          id: confirmAction.payment.id,
          status: confirmAction.type === "approve" ? "approved" : "rejected",
        };
      }

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(
          confirmAction.type === "approve"
            ? t("admin.paymentApproved")
            : t("admin.paymentRejected")
        );
        fetchPayments();
      } else {
        toast.error(t("common.error"));
      }
    } catch { toast.error(t("common.error")); }
    setConfirmAction({ type: "approve", payment: null });
  };

  const subTabs: { key: "pending" | "approved" | "rejected"; labelKey: string; count: number }[] = [
    { key: "pending", labelKey: "admin.pending", count: payments.filter((p) => p.status === "pending").length },
    { key: "approved", labelKey: "admin.approved", count: payments.filter((p) => p.status === "approved").length },
    { key: "rejected", labelKey: "admin.rejected", count: payments.filter((p) => p.status === "rejected").length },
  ];

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.payments")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.managePayments")}</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {subTabs.map((st) => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              subTab === st.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(st.labelKey)}
            <Badge variant="secondary" className="text-xs h-5 min-w-5 flex items-center justify-center">
              {st.count}
            </Badge>
          </button>
        ))}
      </div>

      {/* Payment Cards */}
      {loadingPayments ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Skeleton className="h-4 w-48 mx-auto mb-3" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CreditCard className="size-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">{t("admin.noPaymentsFound")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((payment) => (
            <Card key={payment.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-sm font-medium">
                        {payment.userName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{payment.userName}</p>
                      <p className="text-xs text-muted-foreground">{payment.userEmail}</p>
                    </div>
                  </div>
                  <Badge className={`border-0 ${statusColors[payment.status]}`}>
                    {t(`admin.${payment.status}`)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("admin.planType")}</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {payment.planType}
                      {payment.isPurchase && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                          {t("common.buyNow") || "شراء فردي"}
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("payment.amount")}</p>
                    <p className="text-sm font-bold text-teal-600 dark:text-teal-400">{payment.amount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("admin.ccpNumber")}</p>
                    <p className="text-sm font-mono">{payment.ccpNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("admin.timestamp")}</p>
                    <p className="text-sm">{payment.timestamp}</p>
                  </div>
                </div>

                {/* Receipt */}
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">{t("admin.receipt")}</p>
                  <button
                    onClick={() => setReceiptDialog(payment.receiptUrl)}
                    className="block w-full rounded-lg overflow-hidden border hover:ring-2 hover:ring-teal-300 transition-all group"
                  >
                    <div className="aspect-video bg-muted relative">
                      <img
                        src={payment.receiptUrl}
                        alt={t("admin.receipt")}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Eye className="size-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                </div>

                {/* Actions (only for pending) */}
                {payment.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setConfirmAction({ type: "approve", payment })}
                    >
                      <Check className="size-4 me-1.5" />
                      {t("admin.approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setConfirmAction({ type: "reject", payment })}
                    >
                      <X className="size-4 me-1.5" />
                      {t("admin.reject")}
                    </Button>
                  </div>
                )}
                {/* Delete button for approved/rejected */}
                {(payment.status === "approved" || payment.status === "rejected") && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => setConfirmAction({ type: "delete", payment })}
                    >
                      <Trash2 className="size-4 me-1.5" />
                      {locale === "ar" ? "حذف" : locale === "fr" ? "Supprimer" : "Delete"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Receipt Viewer Dialog */}
      <Dialog open={!!receiptDialog} onOpenChange={(open) => { if (!open) setReceiptDialog(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("admin.viewReceipt")}</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden border">
            <img
              src={receiptDialog || ""}
              alt={t("admin.receipt")}
              className="w-full h-auto"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve/Reject/Delete Confirmation */}
      <AlertDialog open={!!confirmAction.payment} onOpenChange={(open) => { if (!open) setConfirmAction({ type: "approve", payment: null }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction.type === "delete"
                ? (locale === "ar" ? "حذف الدفع" : locale === "fr" ? "Supprimer le paiement" : "Delete Payment")
                : confirmAction.type === "approve" ? t("admin.approve") : t("admin.reject")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.type === "delete"
                ? (locale === "ar"
                    ? `هل أنت متأكد من حذف هذا الدفع؟ سيتم حذف سجل الدفع فقط وسيبقى اشتراك المستخدم محفوظاً.`
                    : locale === "fr"
                    ? `Êtes-vous sûr de vouloir supprimer ce paiement ? Seul l'enregistrement du paiement sera supprimé, l'abonnement de l'utilisateur sera préservé.`
                    : `Are you sure you want to delete this payment? Only the payment record will be deleted, the user's subscription will be preserved.`)
                : confirmAction.type === "approve"
                  ? t("admin.confirmApprove")
                  : t("admin.confirmReject")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={confirmAction.type === "delete" ? "bg-red-600 hover:bg-red-700" : confirmAction.type === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {confirmAction.type === "delete"
                ? (locale === "ar" ? "حذف نهائي" : locale === "fr" ? "Supprimer définitivement" : "Delete Permanently")
                : confirmAction.type === "approve" ? t("admin.approve") : t("admin.reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TAB 4: CONTENT MANAGEMENT ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function ContentView() {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);
  const isRtl = locale === "ar";
  const [contentSubTab, setContentSubTab] = useState<ContentSubTab>("courses");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editDialog, setEditDialog] = useState<{ open: boolean; item: ContentItem | null; isNew: boolean }>({ open: false, item: null, isNew: false });
  const [deleteDialog, setDeleteDialog] = useState<ContentItem | null>(null);
  const [courseChapterDialog, setCourseChapterDialog] = useState<{ open: boolean; course: ContentItem | null; chapters: ContentItem["chapters"] }>({ open: false, course: null, chapters: [] });

  // Local form state - trilingual
  const [formTitleAr, setFormTitleAr] = useState("");
  const [formTitleFr, setFormTitleFr] = useState("");
  const [formTitleEn, setFormTitleEn] = useState("");
  const [formDescAr, setFormDescAr] = useState("");
  const [formDescFr, setFormDescFr] = useState("");
  const [formDescEn, setFormDescEn] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formIsFree, setFormIsFree] = useState(false);
  const [formStatus, setFormStatus] = useState<"published" | "draft">("draft");
  const [formPrice, setFormPrice] = useState<number | null>(null);
  // Type-specific fields
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formAudioUrl, setFormAudioUrl] = useState("");
  const [formFileUrl, setFormFileUrl] = useState("");
  const [formStreamUrl, setFormStreamUrl] = useState("");
  const [formZoomUrl, setFormZoomUrl] = useState("");
  const [formContentAr, setFormContentAr] = useState("");
  const [formContentFr, setFormContentFr] = useState("");
  const [formContentEn, setFormContentEn] = useState("");
  const [formDuration, setFormDuration] = useState("");
  // Store raw API data for editing descriptions
  const rawItemsRef = useRef<Record<string, Record<string, unknown>>>({});

  // ─── New feature state ───
  // Search and Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [priceFilter, setPriceFilter] = useState<"all" | "free" | "paid">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  // Sort
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "titleAZ" | "titleZA">("newest");
  // Bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Category & Tags
  const [formCategory, setFormCategory] = useState("");
  const [formTags, setFormTags] = useState("");
  // Scheduled publishing
  const [formScheduledAt, setFormScheduledAt] = useState("");
  // Order (for coaching items)
  const [formOrder, setFormOrder] = useState(0);
  // SEO fields
  const [formMetaTitleAr, setFormMetaTitleAr] = useState("");
  const [formMetaTitleFr, setFormMetaTitleFr] = useState("");
  const [formMetaTitleEn, setFormMetaTitleEn] = useState("");
  const [formMetaDescAr, setFormMetaDescAr] = useState("");
  const [formMetaDescFr, setFormMetaDescFr] = useState("");
  const [formMetaDescEn, setFormMetaDescEn] = useState("");
  const [formOgImage, setFormOgImage] = useState("");
  const [showSeo, setShowSeo] = useState(false);
  // Preview
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; item: ContentItem | null }>({ open: false, item: null });
  // Chapter/Lesson inline editing
  const [addingChapter, setAddingChapter] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [addingLessonChapterId, setAddingLessonChapterId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [chapterForm, setChapterForm] = useState({ titleAr: "", titleFr: "", titleEn: "", order: 0 });
  const [lessonForm, setLessonForm] = useState({ titleAr: "", titleFr: "", titleEn: "", videoUrl: "", duration: "", order: 0, isFree: false });
  const [chapterSaving, setChapterSaving] = useState(false);
  const [confirmChapterDelete, setConfirmChapterDelete] = useState<{ type: "chapter" | "lesson"; id: string; parentId?: string } | null>(null);

  const subTabs: { key: ContentSubTab; labelKey: string }[] = [
    { key: "courses", labelKey: "nav.courses" },
    { key: "articles", labelKey: "nav.articles" },
    { key: "podcasts", labelKey: "nav.podcasts" },
    { key: "videos", labelKey: "nav.videos" },
    { key: "pdfs", labelKey: "nav.pdfs" },
    { key: "live", labelKey: "nav.live" },
    { key: "coaching", labelKey: "nav.coaching" },
  ];

  // ── Fetch content from API ──
  const fetchContent = useCallback(async (subTab?: ContentSubTab) => {
    const tab = subTab || contentSubTab;
    setLoading(true);
    try {
      const config = CONTENT_API_CONFIG[tab];
      const res = await fetch(config.endpoint);
      if (res.ok) {
        const data = await res.json();
        const rawItems = data[config.responseKey] || [];
        // Store raw data for editing
        const rawMap: Record<string, Record<string, unknown>> = {};
        rawItems.forEach((r: Record<string, unknown>) => {
          rawMap[r.id as string] = r;
        });
        rawItemsRef.current = rawMap;
        setItems(rawItems.map((r: Record<string, unknown>) => normalizeContentItem(r)));
      }
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [contentSubTab, t]);

  useEffect(() => {
    fetchContent();
  }, [contentSubTab, fetchContent]);

  // ── Filtered and sorted items ──
  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || item.titleAr?.toLowerCase().includes(q) || item.titleFr?.toLowerCase().includes(q) || item.titleEn?.toLowerCase().includes(q) || item.title.toLowerCase().includes(q);
      // Status filter
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      // Price filter
      const matchesPrice = priceFilter === "all" || (priceFilter === "free" && item.isFree) || (priceFilter === "paid" && !item.isFree);
      // Category filter
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesPrice && matchesCategory;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest": return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "titleAZ": return (a.titleAr || a.title).localeCompare(b.titleAr || b.title, "ar");
        case "titleZA": return (b.titleAr || b.title).localeCompare(a.titleAr || a.title, "ar");
        case "newest":
        default: return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

    return result;
  }, [items, searchQuery, statusFilter, priceFilter, categoryFilter, sortBy]);

  // ── Open edit dialog ──
  const openEdit = (item: ContentItem | null, isNew: boolean) => {
    const raw = item ? rawItemsRef.current[item.id] || {} : {};
    setFormTitleAr(item?.titleAr || item?.title || "");
    setFormTitleFr(item?.titleFr || "");
    setFormTitleEn(item?.titleEn || "");
    setFormDescAr((raw.descriptionAr as string) || (item as any)?.descriptionAr || item?.description || "");
    setFormDescFr((raw.descriptionFr as string) || (item as any)?.descriptionFr || "");
    setFormDescEn((raw.descriptionEn as string) || (item as any)?.descriptionEn || "");
    setFormImageUrl(item?.imageUrl || "");
    setFormIsFree(item?.isFree || false);
    setFormStatus(item?.status || "draft");
    setFormPrice(item?.price ?? null);
    setFormVideoUrl((raw.videoUrl as string) || (item as any)?.videoUrl || "");
    setFormAudioUrl((raw.audioUrl as string) || (item as any)?.audioUrl || "");
    setFormFileUrl((raw.fileUrl as string) || (item as any)?.fileUrl || "");
    setFormContentAr((raw.contentAr as string) || (item as any)?.contentAr || "");
    setFormContentFr((raw.contentFr as string) || (item as any)?.contentFr || "");
    setFormContentEn((raw.contentEn as string) || (item as any)?.contentEn || "");
    setFormDuration((raw.duration as string) || (item as any)?.duration || "");
    setFormOrder((raw.order as number) || (item as any)?.order || 0);
    setFormCategory(item?.category || "");
    setFormTags(item?.tags || "");
    setFormScheduledAt(item?.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : "");
    setFormMetaTitleAr(item?.metaTitleAr || (raw.metaTitleAr as string) || "");
    setFormMetaTitleFr(item?.metaTitleFr || (raw.metaTitleFr as string) || "");
    setFormMetaTitleEn(item?.metaTitleEn || (raw.metaTitleEn as string) || "");
    setFormMetaDescAr(item?.metaDescAr || (raw.metaDescAr as string) || "");
    setFormMetaDescFr(item?.metaDescFr || (raw.metaDescFr as string) || "");
    setFormMetaDescEn(item?.metaDescEn || (raw.metaDescEn as string) || "");
    setFormOgImage(item?.ogImage || (raw.ogImage as string) || "");
    setShowSeo(false);
    setEditDialog({ open: true, item, isNew });
  };

  // ── Save (create or update) ──
  const handleSave = async () => {
    if (!formTitleAr.trim()) {
      toast.error(t("admin.titleRequired") || "العنوان مطلوب");
      return;
    }
    if (contentSubTab === "videos" && !formVideoUrl.trim()) {
      toast.error(t("admin.videoUrlRequired") || "رابط الفيديو مطلوب");
      return;
    }
    if (contentSubTab === "podcasts" && !formAudioUrl.trim()) {
      toast.error(t("admin.audioUrlRequired") || "رابط الصوت مطلوب");
      return;
    }
    if (contentSubTab === "pdfs" && !formFileUrl.trim()) {
      toast.error(t("admin.fileUrlRequired") || "رابط الملف مطلوب");
      return;
    }
    setSaving(true);
    try {
      const config = CONTENT_API_CONFIG[contentSubTab];
      const payload: Record<string, unknown> = {
        title: formTitleAr,
        titleAr: formTitleAr,
        titleFr: formTitleFr || formTitleAr,
        titleEn: formTitleEn || formTitleAr,
        description: formDescAr || formTitleAr,
        descriptionAr: formDescAr || formTitleAr,
        descriptionFr: formDescFr || formDescAr || formTitleAr,
        descriptionEn: formDescEn || formDescAr || formTitleAr,
        image: formImageUrl,
        thumbnail: formImageUrl,
        isFree: formIsFree,
        price: formIsFree ? 0 : (formPrice || 0),
        status: formStatus,
        category: formCategory || undefined,
        tags: formTags || undefined,
        scheduledAt: formScheduledAt || undefined,
        metaTitleAr: formMetaTitleAr || undefined,
        metaTitleFr: formMetaTitleFr || undefined,
        metaTitleEn: formMetaTitleEn || undefined,
        metaDescAr: formMetaDescAr || undefined,
        metaDescFr: formMetaDescFr || undefined,
        metaDescEn: formMetaDescEn || undefined,
        ogImage: formOgImage || undefined,
      };

      if (contentSubTab === "videos" && formVideoUrl) {
        payload.videoUrl = formVideoUrl;
        payload.duration = formDuration;
      }
      if (contentSubTab === "podcasts" && formAudioUrl) {
        payload.audioUrl = formAudioUrl;
        payload.duration = formDuration;
      }
      if (contentSubTab === "pdfs" && formFileUrl) {
        payload.fileUrl = formFileUrl;
      }
      if (contentSubTab === "live") {
        if (formStreamUrl) payload.streamUrl = formStreamUrl;
        if (formZoomUrl) payload.zoomUrl = formZoomUrl;
      }
      if (contentSubTab === "coaching") {
        payload.duration = formDuration;
        payload.order = formOrder;
        if (formVideoUrl) payload.videoUrl = formVideoUrl;
        payload.content = formContentAr || formTitleAr;
        payload.contentAr = formContentAr || formTitleAr;
        payload.contentFr = formContentFr || formContentAr || formTitleAr;
        payload.contentEn = formContentEn || formContentAr || formTitleAr;
      }
      if (contentSubTab === "articles") {
        payload.content = formContentAr || formTitleAr;
        payload.contentAr = formContentAr || formTitleAr;
        payload.contentFr = formContentFr || formContentAr || formTitleAr;
        payload.contentEn = formContentEn || formContentAr || formTitleAr;
      }

      let res: Response;
      if (editDialog.isNew) {
        res = await fetch(config.endpoint, {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (editDialog.item) {
        const idRoute = `${config.endpoint}/${editDialog.item.id}`;
        res = await fetch(idRoute, {
          method: "PUT",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        setSaving(false);
        return;
      }

      if (res.ok) {
        toast.success(t("admin.changesSaved"));
        fetchContent();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.debug || errData.error || t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
      setEditDialog({ open: false, item: null, isNew: false });
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteDialog) return;
    setSaving(true);
    try {
      const config = CONTENT_API_CONFIG[contentSubTab];
      const res = await fetch(`${config.endpoint}/${deleteDialog.id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) {
        toast.success(t("admin.itemDeleted"));
        fetchContent();
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
      setDeleteDialog(null);
    }
  };

  // ── Duplicate ──
  const handleDuplicate = async (item: ContentItem) => {
    const raw = rawItemsRef.current[item.id] || {};
    setSaving(true);
    try {
      const config = CONTENT_API_CONFIG[contentSubTab];
      const payload: Record<string, unknown> = {
        title: (item.titleAr || item.title) + " (نسخة)",
        titleAr: (item.titleAr || item.title) + " (نسخة)",
        titleFr: item.titleFr || "",
        titleEn: item.titleEn || "",
        description: raw.descriptionAr || item.description || "",
        descriptionAr: raw.descriptionAr || item.description || "",
        descriptionFr: raw.descriptionFr || "",
        descriptionEn: raw.descriptionEn || "",
        image: item.imageUrl,
        thumbnail: item.imageUrl,
        isFree: item.isFree,
        price: item.price,
        status: "draft",
        category: item.category || undefined,
        tags: item.tags || undefined,
      };
      if (contentSubTab === "videos" && (raw.videoUrl || (item as any).videoUrl)) {
        payload.videoUrl = (raw.videoUrl as string) || (item as any).videoUrl;
        payload.duration = (raw.duration as string) || (item as any).duration;
      }
      if (contentSubTab === "podcasts" && (raw.audioUrl || (item as any).audioUrl)) {
        payload.audioUrl = (raw.audioUrl as string) || (item as any).audioUrl;
        payload.duration = (raw.duration as string) || (item as any).duration;
      }
      if (contentSubTab === "pdfs" && (raw.fileUrl || (item as any).fileUrl)) {
        payload.fileUrl = (raw.fileUrl as string) || (item as any).fileUrl;
      }
      if (contentSubTab === "articles") {
        payload.content = (raw.contentAr as string) || (item as any).contentAr || "";
        payload.contentAr = (raw.contentAr as string) || (item as any).contentAr || "";
        payload.contentFr = (raw.contentFr as string) || (item as any).contentFr || "";
        payload.contentEn = (raw.contentEn as string) || (item as any).contentEn || "";
      }

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(t("admin.duplicateSuccess") || "تم نسخ العنصر بنجاح");
        fetchContent();
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Bulk operations ──
  const handleBulkAction = async (action: "publish" | "draft" | "delete") => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    const config = CONTENT_API_CONFIG[contentSubTab];
    let successCount = 0;
    for (const id of selectedIds) {
      try {
        if (action === "delete") {
          const res = await fetch(`${config.endpoint}/${id}`, { method: "DELETE", headers: adminHeaders() });
          if (res.ok) successCount++;
        } else {
          const res = await fetch(`${config.endpoint}/${id}`, {
            method: "PUT",
            headers: { ...adminHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ status: action === "publish" ? "published" : "draft" }),
          });
          if (res.ok) successCount++;
        }
      } catch { /* skip */ }
    }
    toast.success(`${successCount} ${t("admin.changesSaved")}`);
    setSelectedIds(new Set());
    fetchContent();
    setSaving(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Chapter dialog: fetch real course data ──
  const openChapterDialog = async (course: ContentItem) => {
    setCourseChapterDialog({ open: true, course, chapters: [] });
    setAddingChapter(false);
    setEditingChapterId(null);
    setAddingLessonChapterId(null);
    setEditingLessonId(null);
    try {
      const res = await fetch(`/api/courses/${course.id}`);
      if (res.ok) {
        const data = await res.json();
        const courseData = data.course as Record<string, unknown>;
        const chapters = (courseData.chapters || []) as ContentItem["chapters"];
        setCourseChapterDialog((prev) => ({ ...prev, chapters }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Chapter CRUD ──
  const handleSaveChapter = async () => {
    if (!courseChapterDialog.course || !chapterForm.titleAr.trim()) return;
    setChapterSaving(true);
    try {
      if (editingChapterId) {
        const res = await fetch(`/api/courses/${courseChapterDialog.course.id}/chapters/${editingChapterId}`, {
          method: "PUT",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ ...chapterForm, title: chapterForm.titleAr }),
        });
        if (res.ok) toast.success(t("admin.chapterUpdated"));
      } else {
        const res = await fetch(`/api/courses/${courseChapterDialog.course.id}/chapters`, {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ ...chapterForm, title: chapterForm.titleAr }),
        });
        if (res.ok) toast.success(t("admin.chapterAdded"));
      }
      setAddingChapter(false);
      setEditingChapterId(null);
      setChapterForm({ titleAr: "", titleFr: "", titleEn: "", order: 0 });
      openChapterDialog(courseChapterDialog.course);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setChapterSaving(false);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!courseChapterDialog.course) return;
    setChapterSaving(true);
    try {
      const res = await fetch(`/api/courses/${courseChapterDialog.course.id}/chapters/${chapterId}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) toast.success(t("admin.chapterDeleted"));
      openChapterDialog(courseChapterDialog.course);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setChapterSaving(false);
      setConfirmChapterDelete(null);
    }
  };

  // ── Lesson CRUD ──
  const handleSaveLesson = async () => {
    if (!courseChapterDialog.course || !addingLessonChapterId || !lessonForm.titleAr.trim()) return;
    setChapterSaving(true);
    try {
      if (editingLessonId) {
        const res = await fetch(`/api/courses/${courseChapterDialog.course.id}/chapters/${addingLessonChapterId}/lessons/${editingLessonId}`, {
          method: "PUT",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ ...lessonForm, title: lessonForm.titleAr }),
        });
        if (res.ok) toast.success(t("admin.lessonUpdated"));
      } else {
        const res = await fetch(`/api/courses/${courseChapterDialog.course.id}/chapters/${addingLessonChapterId}/lessons`, {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ ...lessonForm, title: lessonForm.titleAr }),
        });
        if (res.ok) toast.success(t("admin.lessonAdded"));
      }
      setAddingLessonChapterId(null);
      setEditingLessonId(null);
      setLessonForm({ titleAr: "", titleFr: "", titleEn: "", videoUrl: "", duration: "", order: 0, isFree: false });
      openChapterDialog(courseChapterDialog.course);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setChapterSaving(false);
    }
  };

  const handleDeleteLesson = async (chapterId: string, lessonId: string) => {
    if (!courseChapterDialog.course) return;
    setChapterSaving(true);
    try {
      const res = await fetch(`/api/courses/${courseChapterDialog.course.id}/chapters/${chapterId}/lessons/${lessonId}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) toast.success(t("admin.lessonDeleted"));
      openChapterDialog(courseChapterDialog.course);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setChapterSaving(false);
      setConfirmChapterDelete(null);
    }
  };

  // Preview data
  const getPreviewItem = (): ContentItem | null => {
    if (!previewDialog.item && !editDialog.item) return null;
    const base = previewDialog.item || editDialog.item;
    if (!base) return null;
    return {
      ...base,
      titleAr: formTitleAr || base.titleAr,
      titleFr: formTitleFr || base.titleFr,
      titleEn: formTitleEn || base.titleEn,
      descriptionAr: formDescAr || base.descriptionAr,
      imageUrl: formImageUrl || base.imageUrl,
      status: formStatus,
      category: formCategory || base.category,
      tags: formTags || base.tags,
    };
  };

  // Available categories from current items
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((i) => { if (i.category) cats.add(i.category); });
    CATEGORIES.forEach((c) => cats.add(c));
    return Array.from(cats);
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.content")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("admin.manageContent")}</p>
        </div>
        <Button onClick={() => openEdit(null, true)} className="bg-teal-600 hover:bg-teal-700 text-white">
          <Plus className="size-4 me-1.5" />
          {SECTION_LABELS[contentSubTab].addNew}
        </Button>
      </div>

      {/* Content Sub-tabs */}
      <div className="flex gap-1 overflow-x-auto bg-muted rounded-lg p-1 scrollbar-none">
        {subTabs.map((st) => (
          <button
            key={st.key}
            onClick={() => { setContentSubTab(st.key); setSearchQuery(""); setStatusFilter("all"); setPriceFilter("all"); setCategoryFilter("all"); setSelectedIds(new Set()); }}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              contentSubTab === st.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(st.labelKey)}
          </button>
        ))}
      </div>

      {/* Search, Filter, Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.searchContent") || "البحث في المحتوى..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-9"
          />
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["all", "published", "draft"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statusFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(f === "all" ? "admin.filterAll" : f === "published" ? "admin.filterPublished" : "admin.filterDraft")}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["all", "free", "paid"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPriceFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                priceFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(f === "all" ? "admin.filterAll" : f === "free" ? "admin.filterFree" : "admin.filterPaid")}
            </button>
          ))}
        </div>
        {/* Category Filter */}
        <div className="flex items-center gap-1.5">
          <Folder className="size-4 text-muted-foreground" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="all">{t("admin.filterAll") || "الكل"}</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="size-4 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="newest">{t("admin.newestFirst") || "الأحدث أولاً"}</option>
            <option value="oldest">{t("admin.oldestFirst") || "الأقدم أولاً"}</option>
            <option value="titleAZ">{t("admin.titleAZ") || "العنوان أ-ي"}</option>
            <option value="titleZA">{t("admin.titleZA") || "العنوان ي-أ"}</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800">
          <span className="text-sm font-medium">{selectedIds.size} {t("admin.selected") || "محدد"}</span>
          <div className="flex gap-2 ms-auto">
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleBulkAction("publish")} disabled={saving}>
              <Check className="size-3 me-1" /> {t("admin.bulkPublish") || "نشر المحدد"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleBulkAction("draft")} disabled={saving}>
              {t("admin.bulkDraft") || "تحويل لمسودة"}
            </Button>
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => handleBulkAction("delete")} disabled={saving}>
              <Trash2 className="size-3 me-1" /> {t("admin.bulkDelete") || "حذف المحدد"}
            </Button>
          </div>
        </div>
      )}

      {/* Content List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredItems.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>{t("admin.title")}</TableHead>
                <TableHead>{t("admin.status")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("admin.date")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("admin.isFree")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("admin.itemPrice")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("admin.views") || "المشاهدات"}</TableHead>
                <TableHead className="text-end">{t("admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Skeleton className="h-4 w-48 mx-auto mb-2" />
                    <Skeleton className="h-4 w-32 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {SECTION_LABELS[contentSubTab].noData}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-teal-50/50 dark:bg-teal-950/20" : ""}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-md overflow-hidden bg-muted shrink-0 hidden sm:block">
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-sm truncate max-w-[200px] block">{item.title}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.category && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
                            )}
                            {item.scheduledAt && new Date(item.scheduledAt) > new Date() && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0">
                                {t("admin.scheduled") || "مجدول"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          item.status === "published"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0"
                        }
                      >
                        {t(item.status === "published" ? "admin.published" : "admin.draft")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{item.date}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={item.isFree ? "outline" : "secondary"} className="text-xs">
                        {item.isFree ? t("common.free") : t("common.paid")}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.isFree ? (
                        <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{t("common.free")}</span>
                      ) : item.price ? (
                        <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">{item.price.toLocaleString()} {t("common.currency")}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t("admin.noPriceSet")}</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {item.viewCount || 0}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        {/* Chapter management for courses */}
                        {contentSubTab === "courses" && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openChapterDialog(item)} title={t("admin.chapterManagement")}>
                            <BookOpen className="size-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(item, false)} title={t("admin.edit")}>
                          <Pencil className="size-4" />
                        </Button>
                        {/* Duplicate */}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDuplicate(item)} title={t("admin.duplicate") || "نسخ"}>
                          <Copy className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700" onClick={() => setDeleteDialog(item)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog - with scrollable body and fixed footer */}
      <Dialog open={editDialog.open} onOpenChange={(open) => { if (!open) setEditDialog({ open: false, item: null, isNew: false }); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editDialog.isNew ? SECTION_LABELS[contentSubTab].addNew : SECTION_LABELS[contentSubTab].edit}
            </DialogTitle>
            <DialogDescription>
              {SECTION_LABELS[contentSubTab].descriptionLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto max-h-[60vh] flex-1">
            {/* Trilingual title inputs */}
            {(["ar", "fr", "en"] as const).map((lang) => (
              <div key={lang} className="space-y-1.5">
                <Label className="text-sm">
                  {t(`admin.${lang}`)}
                </Label>
                <Input
                  placeholder={
                    lang === "ar" ? "العنوان بالعربية" :
                    lang === "fr" ? "Titre en français" : "Title in English"
                  }
                  value={lang === "ar" ? formTitleAr : lang === "fr" ? formTitleFr : formTitleEn}
                  onChange={(e) => {
                    if (lang === "ar") setFormTitleAr(e.target.value);
                    else if (lang === "fr") setFormTitleFr(e.target.value);
                    else setFormTitleEn(e.target.value);
                  }}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                />
              </div>
            ))}

            {/* Description fields for non-article content types */}
            {contentSubTab !== "articles" && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("admin.description") || "الوصف"}</Label>
                {(["ar", "fr", "en"] as const).map((lang) => (
                  <div key={`desc-${lang}`} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {lang === "ar" ? "العربية" : lang === "fr" ? "Français" : "English"}
                    </Label>
                    <Textarea
                      placeholder={
                        lang === "ar" ? "اكتب الوصف بالعربية..." :
                        lang === "fr" ? "Description en français..." : "Description in English..."
                      }
                      value={lang === "ar" ? formDescAr : lang === "fr" ? formDescFr : formDescEn}
                      onChange={(e) => {
                        if (lang === "ar") setFormDescAr(e.target.value);
                        else if (lang === "fr") setFormDescFr(e.target.value);
                        else setFormDescEn(e.target.value);
                      }}
                      dir={lang === "ar" ? "rtl" : "ltr"}
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            )}

            <FileUploadComponent
              value={formImageUrl}
              onChange={setFormImageUrl}
              label={SECTION_LABELS[contentSubTab].imageLabel}
              placeholder="https://..."
              uploadType="content"
              contentType={contentSubTab}
              maxSizeMB={100}
            />

            {/* Video URL field (required) */}
            {contentSubTab === "videos" && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  رابط الفيديو (YouTube / URL) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={formVideoUrl}
                  onChange={(e) => setFormVideoUrl(e.target.value)}
                  dir="ltr"
                />
              </div>
            )}

            {/* Video URL field for coaching (optional) */}
            {contentSubTab === "coaching" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                  <Video className="size-4" />
                  رابط فيديو الكوتشينغ (اختياري)
                </Label>
                <p className="text-xs text-muted-foreground">
                  أضف فيديو يوتيوب أو فيديو مباشر لعنصر الكوتشينغ. إذا لم تضف فيديو، سيتم عرض المحتوى النصي فقط.
                </p>
                <FileUploadComponent
                  value={formVideoUrl}
                  onChange={setFormVideoUrl}
                  label={locale === "ar" ? "رفع فيديو أو إدخال رابط" : "Upload video or enter URL"}
                  placeholder="https://www.youtube.com/watch?v=... أو https://res.cloudinary.com/.../video.mp4"
                  uploadType="content"
                  contentType="videos"
                  maxSizeMB={500}
                />
              </div>
            )}

            {/* Audio URL field (required) */}
            {contentSubTab === "podcasts" && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  رابط الصوت (Audio URL) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="https://..."
                  value={formAudioUrl}
                  onChange={(e) => setFormAudioUrl(e.target.value)}
                  dir="ltr"
                />
              </div>
            )}

            {/* File URL field for PDFs (required) */}
            {contentSubTab === "pdfs" && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  رابط الملف (PDF URL) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="https://..."
                  value={formFileUrl}
                  onChange={(e) => setFormFileUrl(e.target.value)}
                  dir="ltr"
                />
              </div>
            )}

            {/* Stream URL field for Live Sessions */}
            {contentSubTab === "live" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    رابط البث (Stream URL)
                  </Label>
                  <Input
                    placeholder="https://www.youtube.com/watch?v=... أو رابط البث المباشر"
                    value={formStreamUrl}
                    onChange={(e) => setFormStreamUrl(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    رابط اجتماع Zoom (Zoom Meeting URL)
                  </Label>
                  <Input
                    placeholder="https://zoom.us/j/..."
                    value={formZoomUrl}
                    onChange={(e) => setFormZoomUrl(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </>
            )}

            {/* Article content fields - Rich Text Editor */}
            {contentSubTab === "articles" && (
              <>
                {(["ar", "fr", "en"] as const).map((lang) => (
                  <div key={`content-${lang}`} className="space-y-1.5">
                    <Label className="text-sm">
                      المحتوى {lang === "ar" ? "(عربي)" : lang === "fr" ? "(فرنسي)" : "(إنجليزي)"}
                    </Label>
                    <RichTextEditor
                      value={lang === "ar" ? formContentAr : lang === "fr" ? formContentFr : formContentEn}
                      onChange={(html) => {
                        if (lang === "ar") setFormContentAr(html);
                        else if (lang === "fr") setFormContentFr(html);
                        else setFormContentEn(html);
                      }}
                      placeholder={lang === "ar" ? "اكتب المحتوى بالعربية..." : lang === "fr" ? "Contenu en français..." : "Content in English..."}
                      dir={lang === "ar" ? "rtl" : "ltr"}
                    />
                  </div>
                ))}
              </>
            )}

            {/* Coaching content fields - Rich Text Editor */}
            {contentSubTab === "coaching" && (
              <>
                <div className="space-y-2 mb-2">
                  <Label className="text-sm font-semibold text-teal-700 flex items-center gap-2">
                    <FileText className="size-4" />
                    محتوى الكوتشينغ (اختياري)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    أضف محتوى نصي مفصل يظهر للمستخدم عند الضغط على "ابدأ الآن". يمكن أن يكون تمارين، نصائح، أو محتوى تفاعلي.
                  </p>
                </div>
                {(["ar", "fr", "en"] as const).map((lang) => (
                  <div key={`coaching-content-${lang}`} className="space-y-1.5">
                    <Label className="text-sm">
                      المحتوى {lang === "ar" ? "(عربي)" : lang === "fr" ? "(فرنسي)" : "(إنجليزي)"}
                    </Label>
                    <RichTextEditor
                      value={lang === "ar" ? formContentAr : lang === "fr" ? formContentFr : formContentEn}
                      onChange={(html) => {
                        if (lang === "ar") setFormContentAr(html);
                        else if (lang === "fr") setFormContentFr(html);
                        else setFormContentEn(html);
                      }}
                      placeholder={lang === "ar" ? "اكتب محتوى الكوتشينغ بالعربية..." : lang === "fr" ? "Contenu du coaching en français..." : "Coaching content in English..."}
                      dir={lang === "ar" ? "rtl" : "ltr"}
                    />
                  </div>
                ))}
              </>
            )}

            {/* Duration field for videos/podcasts/coaching */}
            {(contentSubTab === "videos" || contentSubTab === "podcasts" || contentSubTab === "coaching") && (
              <div className="space-y-1.5">
                <Label className="text-sm">المدة (Duration)</Label>
                <Input
                  placeholder="00:30:00"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                />
              </div>
            )}

            {/* Order field for coaching */}
            {contentSubTab === "coaching" && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t("admin.order") || "الترتيب"}</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formOrder}
                  onChange={(e) => setFormOrder(parseInt(e.target.value) || 0)}
                />
              </div>
            )}

            {/* Category & Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Folder className="size-3.5" /> {t("admin.category") || "التصنيف"}
                </Label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Tag className="size-3.5" /> {t("admin.tags") || "الوسوم"}
                </Label>
                <Input
                  placeholder={t("admin.tagsPlaceholder") || "أدخل الوسوم مفصولة بفواصل..."}
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">{t("admin.isFree")}</Label>
              <Switch checked={formIsFree} onCheckedChange={setFormIsFree} />
            </div>

            {!formIsFree && (
              <div className="space-y-1.5">
                <Label className="text-sm">{t("admin.priceDZD")}</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formPrice ?? ""}
                  onChange={(e) => setFormPrice(e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label className="text-sm">{t("admin.published")}</Label>
              <Switch
                checked={formStatus === "published"}
                onCheckedChange={(checked) => setFormStatus(checked ? "published" : "draft")}
              />
            </div>

            {/* Scheduled Publishing */}
            {formStatus === "published" && (
              <div className="space-y-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> {t("admin.scheduledAt") || "تاريخ النشر المجدول"}
                </Label>
                <Input
                  type="datetime-local"
                  value={formScheduledAt}
                  onChange={(e) => setFormScheduledAt(e.target.value)}
                  dir="ltr"
                />
              </div>
            )}

            {/* SEO Settings (collapsible) */}
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                onClick={() => setShowSeo(!showSeo)}
              >
                <span className="flex items-center gap-1.5">
                  <Search className="size-3.5" /> {t("admin.seoSettings") || "إعدادات SEO"}
                </span>
                <ChevronDown className={`size-4 transition-transform ${showSeo ? "rotate-180" : ""}`} />
              </button>
              {showSeo && (
                <div className="p-3 pt-0 space-y-3 border-t">
                  {(["ar", "fr", "en"] as const).map((lang) => (
                    <div key={`seo-${lang}`} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{t(`admin.${lang}`)}</p>
                      <Input
                        placeholder={t("admin.metaTitle") || "عنوان ميتا"}
                        value={lang === "ar" ? formMetaTitleAr : lang === "fr" ? formMetaTitleFr : formMetaTitleEn}
                        onChange={(e) => {
                          if (lang === "ar") setFormMetaTitleAr(e.target.value);
                          else if (lang === "fr") setFormMetaTitleFr(e.target.value);
                          else setFormMetaTitleEn(e.target.value);
                        }}
                        dir={lang === "ar" ? "rtl" : "ltr"}
                      />
                      <Textarea
                        placeholder={t("admin.metaDescription") || "وصف ميتا"}
                        value={lang === "ar" ? formMetaDescAr : lang === "fr" ? formMetaDescFr : formMetaDescEn}
                        onChange={(e) => {
                          if (lang === "ar") setFormMetaDescAr(e.target.value);
                          else if (lang === "fr") setFormMetaDescFr(e.target.value);
                          else setFormMetaDescEn(e.target.value);
                        }}
                        dir={lang === "ar" ? "rtl" : "ltr"}
                        rows={2}
                      />
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("admin.ogImage") || "صورة OG"}</Label>
                    <Input
                      placeholder="https://..."
                      value={formOgImage}
                      onChange={(e) => setFormOgImage(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 border-t pt-3">
            <Button variant="outline" onClick={() => setEditDialog({ open: false, item: null, isNew: false })}>
              {t("admin.cancel")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const previewItem: ContentItem = {
                  id: editDialog.item?.id || "preview",
                  title: formTitleAr,
                  titleAr: formTitleAr,
                  titleFr: formTitleFr,
                  titleEn: formTitleEn,
                  description: formDescAr,
                  descriptionAr: formDescAr,
                  descriptionFr: formDescFr,
                  descriptionEn: formDescEn,
                  imageUrl: formImageUrl,
                  isFree: formIsFree,
                  price: formPrice,
                  status: formStatus,
                  date: new Date().toISOString().split("T")[0],
                  category: formCategory,
                  tags: formTags,
                  scheduledAt: formScheduledAt || undefined,
                };
                setPreviewDialog({ open: true, item: previewItem });
              }}
              title={t("admin.preview") || "معاينة"}
            >
              <Eye className="size-4 me-1.5" /> {t("admin.preview") || "معاينة"}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? <Skeleton className="h-4 w-16" /> : t("admin.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog.open} onOpenChange={(open) => { if (!open) setPreviewDialog({ open: false, item: null }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.preview") || "معاينة"}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <div className="w-[300px] border-2 border-gray-300 dark:border-gray-700 rounded-[2rem] overflow-hidden bg-white dark:bg-gray-900">
              {/* Phone notch */}
              <div className="flex justify-center py-1 bg-gray-100 dark:bg-gray-800">
                <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded-b-lg" />
              </div>
              {/* Phone content */}
              <div className="p-3 space-y-3 max-h-[50vh] overflow-y-auto" dir="rtl">
                {getPreviewItem()?.imageUrl && (
                  <img src={getPreviewItem()!.imageUrl} alt="" className="w-full h-36 object-cover rounded-lg" />
                )}
                <h2 className="text-lg font-bold">{getPreviewItem()?.titleAr || getPreviewItem()?.title}</h2>
                {getPreviewItem()?.category && (
                  <Badge variant="outline" className="text-[10px]">{getPreviewItem()!.category}</Badge>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {getPreviewItem()?.descriptionAr || getPreviewItem()?.description}
                </p>
                {contentSubTab === "articles" && formContentAr && (
                  <div className="text-xs leading-relaxed prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeDisplayHtml(formContentAr) }} />
                )}
                <div className="flex items-center gap-2">
                  <Badge className={getPreviewItem()?.status === "published" ? "bg-emerald-100 text-emerald-700 border-0" : "bg-amber-100 text-amber-700 border-0"}>
                    {getPreviewItem()?.status === "published" ? t("admin.published") : t("admin.draft")}
                  </Badge>
                  {getPreviewItem()?.isFree ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300">{t("common.free")}</Badge>
                  ) : (
                    <Badge variant="secondary">{getPreviewItem()?.price?.toLocaleString()} {t("common.currency")}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) setDeleteDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              {t("admin.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chapter Management Dialog (for courses) - with full CRUD */}
      <Dialog open={courseChapterDialog.open} onOpenChange={(open) => { if (!open) { setCourseChapterDialog({ open: false, course: null, chapters: [] }); setAddingChapter(false); setEditingChapterId(null); setAddingLessonChapterId(null); setEditingLessonId(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("admin.chapterManagement")}</DialogTitle>
            <DialogDescription>
              {courseChapterDialog.course?.title || ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto flex-1">
            {(!courseChapterDialog.chapters || courseChapterDialog.chapters.length === 0) && !addingChapter ? (
              <div className="py-8 text-center text-muted-foreground">
                <BookOpen className="size-8 mx-auto mb-2 opacity-30" />
                <p>{t("admin.noData")}</p>
              </div>
            ) : (
              courseChapterDialog.chapters?.map((chapter) => (
                <div key={chapter.id} className="border rounded-lg p-3">
                  {/* Chapter header */}
                  <div className="flex items-center gap-2 mb-2">
                    <GripVertical className="size-4 text-muted-foreground cursor-grab shrink-0" />
                    {editingChapterId === chapter.id ? (
                      <div className="flex-1 space-y-2">
                        {(["ar", "fr", "en"] as const).map((lang) => (
                          <Input
                            key={`ed-ch-${lang}`}
                            placeholder={lang === "ar" ? "عنوان الفصل بالعربية" : lang === "fr" ? "Titre du chapitre" : "Chapter title"}
                            value={lang === "ar" ? chapterForm.titleAr : lang === "fr" ? chapterForm.titleFr : chapterForm.titleEn}
                            onChange={(e) => setChapterForm((prev) => ({ ...prev, [`title${lang.charAt(0).toUpperCase() + lang.slice(1)}`]: e.target.value }))}
                            dir={lang === "ar" ? "rtl" : "ltr"}
                            className="h-8 text-sm"
                          />
                        ))}
                        <Input type="number" placeholder={t("admin.orderField") || "الترتيب"} value={chapterForm.order} onChange={(e) => setChapterForm((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))} dir="ltr" className="h-8 text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSaveChapter} disabled={chapterSaving}>
                            {chapterSaving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingChapterId(null); setChapterForm({ titleAr: "", titleFr: "", titleEn: "", order: 0 }); }}>
                            <X className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-sm flex-1">{chapter.titleAr || chapter.title}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingChapterId(chapter.id); setChapterForm({ titleAr: chapter.titleAr || "", titleFr: chapter.titleFr || "", titleEn: chapter.titleEn || "", order: chapter.order || 0 }); }}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" onClick={() => setConfirmChapterDelete({ type: "chapter", id: chapter.id })}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Chapter translations */}
                  {editingChapterId !== chapter.id && (
                    <div className="ms-6 text-xs text-muted-foreground mb-2">
                      {chapter.titleFr && <p>FR: {chapter.titleFr}</p>}
                      {chapter.titleEn && <p>EN: {chapter.titleEn}</p>}
                    </div>
                  )}

                  {/* Lessons */}
                  {chapter.lessons && chapter.lessons.length > 0 && (
                    <div className="ms-6 space-y-1.5 mb-2">
                      {chapter.lessons.map((lesson) => (
                        <div key={lesson.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                          {editingLessonId === lesson.id && addingLessonChapterId === chapter.id ? (
                            <div className="flex-1 space-y-2">
                              {(["ar", "fr", "en"] as const).map((lang) => (
                                <Input
                                  key={`ed-ls-${lang}`}
                                  placeholder={lang === "ar" ? "عنوان الدرس بالعربية" : lang === "fr" ? "Titre de la leçon" : "Lesson title"}
                                  value={lang === "ar" ? lessonForm.titleAr : lang === "fr" ? lessonForm.titleFr : lessonForm.titleEn}
                                  onChange={(e) => setLessonForm((prev) => ({ ...prev, [`title${lang.charAt(0).toUpperCase() + lang.slice(1)}`]: e.target.value }))}
                                  dir={lang === "ar" ? "rtl" : "ltr"}
                                  className="h-7 text-xs"
                                />
                              ))}
                              <div className="grid grid-cols-2 gap-2">
                                <Input placeholder={t("admin.videoUrl") || "رابط الفيديو"} value={lessonForm.videoUrl} onChange={(e) => setLessonForm((prev) => ({ ...prev, videoUrl: e.target.value }))} dir="ltr" className="h-7 text-xs" />
                                <Input placeholder={t("admin.orderField") || "الترتيب"} type="number" value={lessonForm.order} onChange={(e) => setLessonForm((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))} dir="ltr" className="h-7 text-xs" />
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Switch checked={lessonForm.isFree} onCheckedChange={(v) => setLessonForm((prev) => ({ ...prev, isFree: v }))} />
                                  <Label className="text-xs">{t("admin.isFreeLesson") || "درس مجاني"}</Label>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSaveLesson} disabled={chapterSaving}>
                                    {chapterSaving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingLessonId(null); setAddingLessonChapterId(null); setLessonForm({ titleAr: "", titleFr: "", titleEn: "", videoUrl: "", duration: "", order: 0, isFree: false }); }}>
                                    <X className="size-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="text-xs font-medium flex-1">{lesson.titleAr || lesson.title}</span>
                              {lesson.isFree && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-emerald-600 border-emerald-300">{t("common.free")}</Badge>
                              )}
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditingLessonId(lesson.id); setAddingLessonChapterId(chapter.id); setLessonForm({ titleAr: lesson.titleAr || "", titleFr: lesson.titleFr || "", titleEn: lesson.titleEn || "", videoUrl: lesson.videoUrl || "", duration: lesson.duration || "", order: lesson.order || 0, isFree: lesson.isFree || false }); }}>
                                <Pencil className="size-2.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-rose-600" onClick={() => setConfirmChapterDelete({ type: "lesson", id: lesson.id, parentId: chapter.id })}>
                                <Trash2 className="size-2.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Lesson inline form */}
                  {addingLessonChapterId === chapter.id && editingLessonId === null && (
                    <div className="ms-6 p-2 rounded border bg-teal-50/50 dark:bg-teal-950/20 space-y-2">
                      <p className="text-xs font-medium text-teal-700 dark:text-teal-300">{t("admin.addLesson") || "إضافة درس"}</p>
                      {(["ar", "fr", "en"] as const).map((lang) => (
                        <Input
                          key={`new-ls-${lang}`}
                          placeholder={lang === "ar" ? "عنوان الدرس بالعربية" : lang === "fr" ? "Titre de la leçon" : "Lesson title"}
                          value={lang === "ar" ? lessonForm.titleAr : lang === "fr" ? lessonForm.titleFr : lessonForm.titleEn}
                          onChange={(e) => setLessonForm((prev) => ({ ...prev, [`title${lang.charAt(0).toUpperCase() + lang.slice(1)}`]: e.target.value }))}
                          dir={lang === "ar" ? "rtl" : "ltr"}
                          className="h-7 text-xs"
                        />
                      ))}
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder={t("admin.videoUrl") || "رابط الفيديو"} value={lessonForm.videoUrl} onChange={(e) => setLessonForm((prev) => ({ ...prev, videoUrl: e.target.value }))} dir="ltr" className="h-7 text-xs" />
                        <Input placeholder={t("admin.orderField") || "الترتيب"} type="number" value={lessonForm.order} onChange={(e) => setLessonForm((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))} dir="ltr" className="h-7 text-xs" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch checked={lessonForm.isFree} onCheckedChange={(v) => setLessonForm((prev) => ({ ...prev, isFree: v }))} />
                          <Label className="text-xs">{t("admin.isFreeLesson") || "درس مجاني"}</Label>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSaveLesson} disabled={chapterSaving}>
                            {chapterSaving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3 me-1" />} {t("admin.save") || "حفظ"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddingLessonChapterId(null); setLessonForm({ titleAr: "", titleFr: "", titleEn: "", videoUrl: "", duration: "", order: 0, isFree: false }); }}>
                            {t("admin.cancel") || "إلغاء"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Add Lesson button */}
                  {addingLessonChapterId !== chapter.id && (
                    <div className="ms-6">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-teal-600" onClick={() => { setAddingLessonChapterId(chapter.id); setEditingLessonId(null); setLessonForm({ titleAr: "", titleFr: "", titleEn: "", videoUrl: "", duration: "", order: 0, isFree: false }); }}>
                        <Plus className="size-3 me-1" /> {t("admin.addLesson") || "إضافة درس"}
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Add Chapter inline form */}
            {addingChapter && (
              <div className="p-3 rounded-lg border-2 border-dashed border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/20 space-y-2">
                <p className="text-xs font-medium text-teal-700 dark:text-teal-300">{t("admin.addChapter") || "إضافة فصل"}</p>
                {(["ar", "fr", "en"] as const).map((lang) => (
                  <Input
                    key={`new-ch-${lang}`}
                    placeholder={lang === "ar" ? "عنوان الفصل بالعربية" : lang === "fr" ? "Titre du chapitre" : "Chapter title"}
                    value={lang === "ar" ? chapterForm.titleAr : lang === "fr" ? chapterForm.titleFr : chapterForm.titleEn}
                    onChange={(e) => setChapterForm((prev) => ({ ...prev, [`title${lang.charAt(0).toUpperCase() + lang.slice(1)}`]: e.target.value }))}
                    dir={lang === "ar" ? "rtl" : "ltr"}
                    className="h-8 text-sm"
                  />
                ))}
                <Input type="number" placeholder={t("admin.orderField") || "الترتيب"} value={chapterForm.order} onChange={(e) => setChapterForm((prev) => ({ ...prev, order: parseInt(e.target.value) || 0 }))} dir="ltr" className="h-8 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSaveChapter} disabled={chapterSaving}>
                    {chapterSaving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3 me-1" />} {t("admin.save") || "حفظ"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setAddingChapter(false); setChapterForm({ titleAr: "", titleFr: "", titleEn: "", order: 0 }); }}>
                    {t("admin.cancel") || "إلغاء"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-center flex-shrink-0 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => { setAddingChapter(true); setEditingChapterId(null); setChapterForm({ titleAr: "", titleFr: "", titleEn: "", order: 0 }); }}>
              <Plus className="size-4 me-1.5" />
              {t("admin.addChapter")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chapter/Lesson Delete Confirmation */}
      <AlertDialog open={!!confirmChapterDelete} onOpenChange={(open) => { if (!open) setConfirmChapterDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmChapterDelete?.type === "chapter" ? (t("admin.confirmDeleteChapter") || "هل أنت متأكد من حذف هذا الفصل وجميع دروسه؟") : (t("admin.confirmDeleteLesson") || "هل أنت متأكد من حذف هذا الدرس؟")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmChapterDelete?.type === "chapter") {
                  handleDeleteChapter(confirmChapterDelete.id);
                } else if (confirmChapterDelete?.type === "lesson" && confirmChapterDelete.parentId) {
                  handleDeleteLesson(confirmChapterDelete.parentId, confirmChapterDelete.id);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {t("admin.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TAB 3.5: INDIVIDUAL PURCHASES ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

interface PurchaseItem extends Payment {
  contentTitle?: string;
  contentType?: string;
}

function PurchasesView() {
  const { t, locale } = useTranslation();
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [receiptDialog, setReceiptDialog] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "reject" | "delete"; payment: PurchaseItem | null }>({ type: "approve", payment: null });

  const contentTypeNames: Record<string, string> = {
    courses: "دورة",
    articles: "مقال",
    podcasts: "بودكاست",
    videos: "فيديو",
    pdfs: "كتاب إلكتروني",
    live: "جلسة مباشرة",
  };

  const contentTypeIcons: Record<string, typeof BookOpen> = {
    courses: BookOpen,
    articles: FileText,
    podcasts: Headphones,
    videos: Video,
    pdfs: FileDown,
    live: Radio,
  };

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchases", { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        const purchaseList = data.purchases || [];

        // Fetch member info
        const userMap: Record<string, { name: string; email: string }> = {};
        const membersRes = await fetch("/api/admin/members", { headers: adminHeaders() });
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          for (const m of (membersData.users || [])) {
            userMap[m.id] = { name: m.name || "—", email: m.email || "—" };
          }
        }

        const mapped: PurchaseItem[] = purchaseList.map((p: Record<string, unknown>) => {
          const userInfo = userMap[p.userId as string] || { name: "—", email: "—" };
          return {
            id: p.id as string,
            userName: userInfo.name,
            userEmail: userInfo.email,
            planType: p.contentType as string || "—",
            amount: `${Number(p.amount).toLocaleString()} DA`,
            ccpNumber: (p.ccpNumber as string) || "—",
            receiptUrl: (p.receiptImage as string) || "",
            status: p.status as "pending" | "approved" | "rejected",
            timestamp: new Date(p.createdAt as string).toLocaleString(),
            isPurchase: true,
            purchaseEndpoint: `/api/purchases/${p.id as string}`,
            contentTitle: (p.contentTitleAr as string) || (p.contentTitle as string) || "",
            contentType: p.contentType as string,
          };
        });
        setPurchases(mapped);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);

  const filtered = useMemo(() => {
    if (subTab === "all") return purchases;
    return purchases.filter((p) => p.status === subTab);
  }, [purchases, subTab]);

  const counts = useMemo(() => ({
    pending: purchases.filter((p) => p.status === "pending").length,
    approved: purchases.filter((p) => p.status === "approved").length,
    rejected: purchases.filter((p) => p.status === "rejected").length,
    total: purchases.length,
  }), [purchases]);

  const handleAction = async () => {
    if (!confirmAction.payment) return;

    // Handle delete separately
    if (confirmAction.type === "delete") {
      try {
        const endpoint = `/api/purchases/${confirmAction.payment.id}`;
        const res = await fetch(endpoint, {
          method: "DELETE",
          headers: adminHeaders(),
        });
        if (res.ok) {
          toast.success(locale === "ar" ? "تم حذف الشراء بنجاح. وصول المستخدم محفوظ." : locale === "fr" ? "Achat supprimé avec succès. L'accès de l'utilisateur est préservé." : "Purchase deleted successfully. User access is preserved.");
          fetchPurchases();
        } else {
          toast.error(t("common.error"));
        }
      } catch {
        toast.error(t("common.error"));
      }
      setConfirmAction({ type: "approve", payment: null });
      return;
    }

    try {
      const endpoint = confirmAction.payment.purchaseEndpoint || `/api/purchases/${confirmAction.payment.id}`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          status: confirmAction.type,
          adminNote: "",
        }),
      });
      if (res.ok) {
        toast.success(confirmAction.type === "approve" ? t("admin.paymentApproved") : t("admin.paymentRejected"));
        fetchPurchases();
      } else {
        toast.error(t("common.error"));
      }
    } catch { toast.error(t("common.error")); }
    setConfirmAction({ type: "approve", payment: null });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShoppingBag className="size-6 text-teal-600" />
          {t("admin.individualPurchases")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.individualPurchasesDesc")}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("admin.all"), count: counts.total, color: "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800" },
          { label: t("admin.pending"), count: counts.pending, color: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900" },
          { label: t("admin.approved"), count: counts.approved, color: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900" },
          { label: t("admin.rejected"), count: counts.rejected, color: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900" },
        ].map((stat) => (
          <Card key={stat.label} className={`border ${stat.color}`}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{stat.count}</p>
              <p className="text-xs mt-0.5 opacity-80">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              subTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tab === "all" ? "admin.all" : tab === "pending" ? "admin.pending" : tab === "approved" ? "admin.approved" : "admin.rejected")}
            {tab !== "all" && (
              <span className="ms-1 text-[10px] opacity-60">
                ({counts[tab]})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Purchase list */}
      <div className="space-y-3">
        {loading ? (
          <Card><CardContent className="py-12 text-center"><Skeleton className="h-4 w-48 mx-auto mb-3" /><Skeleton className="h-4 w-32 mx-auto" /></CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ShoppingBag className="size-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">{t("admin.noPurchasesFound")}</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((purchase) => {
            const CTIcon = contentTypeIcons[purchase.contentType || purchase.planType] || FileText;
            return (
              <Card key={purchase.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Content type icon */}
                    <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 shrink-0">
                      <CTIcon className="size-5" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {contentTypeNames[purchase.contentType || purchase.planType] || purchase.planType}
                        </Badge>
                        <Badge
                          className={
                            purchase.status === "pending"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0 text-[10px]"
                              : purchase.status === "approved"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0 text-[10px]"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300 border-0 text-[10px]"
                          }
                        >
                          {t(purchase.status === "pending" ? "admin.pending" : purchase.status === "approved" ? "admin.approved" : "admin.rejected")}
                        </Badge>
                      </div>
                      {purchase.contentTitle && (
                        <p className="text-sm font-medium text-foreground truncate">{purchase.contentTitle}</p>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{purchase.userName}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground text-xs">{purchase.userEmail}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{purchase.amount}</span>
                        {purchase.ccpNumber && purchase.ccpNumber !== "—" && (
                          <span>CCP: {purchase.ccpNumber}</span>
                        )}
                        <span>{purchase.timestamp}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {purchase.receiptUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setReceiptDialog(purchase.receiptUrl)}
                        >
                          <Eye className="size-3.5 me-1" />
                          {t("admin.viewReceipt")}
                        </Button>
                      )}
                      {purchase.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => setConfirmAction({ type: "approve", payment: purchase })}
                          >
                            <Check className="size-3.5 me-1" />
                            {t("admin.approve")}
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                            onClick={() => setConfirmAction({ type: "reject", payment: purchase })}
                          >
                            <Ban className="size-3.5 me-1" />
                            {t("admin.reject")}
                          </Button>
                        </>
                      )}
                      {(purchase.status === "rejected") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setConfirmAction({ type: "delete", payment: purchase })}
                        >
                          <Trash2 className="size-3.5 me-1" />
                          {locale === "ar" ? "حذف" : locale === "fr" ? "Supprimer" : "Delete"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Receipt Dialog */}
      <Dialog open={!!receiptDialog} onOpenChange={() => setReceiptDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.viewReceipt")}</DialogTitle>
          </DialogHeader>
          {receiptDialog && (
            <div className="rounded-lg overflow-hidden border bg-muted">
              <img
                src={receiptDialog}
                alt="Receipt"
                className="w-full h-auto max-h-[70vh] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<p className="p-8 text-center text-muted-foreground">Could not load receipt image</p>';
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction.payment} onOpenChange={() => setConfirmAction({ type: "approve", payment: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction.type === "delete"
                ? (locale === "ar" ? "حذف الشراء" : locale === "fr" ? "Supprimer l'achat" : "Delete Purchase")
                : confirmAction.type === "approve" ? t("admin.confirmApprove") : t("admin.confirmReject")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.type === "delete"
                ? (locale === "ar"
                    ? `هل أنت متأكد من حذف هذا الشراء؟ سيتم حذف سجل الشراء فقط وسيبقى وصول المستخدم للمحتوى محفوظاً.`
                    : locale === "fr"
                    ? `Êtes-vous sûr de vouloir supprimer cet achat ? Seul l'enregistrement de l'achat sera supprimé, l'accès de l'utilisateur au contenu sera préservé.`
                    : `Are you sure you want to delete this purchase? Only the purchase record will be deleted, the user's access to the content will be preserved.`)
                : confirmAction.payment && (
                    <span>{confirmAction.payment.userName} — {confirmAction.payment.amount}</span>
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={confirmAction.type === "delete" ? "bg-red-600 hover:bg-red-700" : confirmAction.type === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
            >
              {confirmAction.type === "delete"
                ? (locale === "ar" ? "حذف نهائي" : locale === "fr" ? "Supprimer définitivement" : "Delete Permanently")
                : confirmAction.type === "approve" ? t("admin.approve") : t("admin.reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TAB: PRICES ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Subscription plan config ──────────────────────────────────────────────

const SUBSCRIPTION_PLANS: Array<{ id: string; labelKey: string; icon: typeof Crown; gradient: string }> = [
  { id: "full", labelKey: "subscriptions.fullAccess", icon: Crown, gradient: "from-amber-400 via-orange-500 to-rose-500" },
  { id: "courses", labelKey: "subscriptions.coursesOnly", icon: BookOpen, gradient: "from-emerald-400 to-teal-600" },
  { id: "articles", labelKey: "subscriptions.articlesOnly", icon: FileText, gradient: "from-cyan-400 to-sky-600" },
  { id: "podcasts", labelKey: "subscriptions.podcastsOnly", icon: Headphones, gradient: "from-violet-400 to-purple-600" },
  { id: "videos", labelKey: "subscriptions.videosOnly", icon: Video, gradient: "from-rose-400 to-pink-600" },
  { id: "pdfs", labelKey: "subscriptions.pdfsOnly", icon: FileDown, gradient: "from-amber-400 to-yellow-600" },
  { id: "live", labelKey: "subscriptions.liveOnly", icon: Radio, gradient: "from-teal-400 to-emerald-600" },
  { id: "coaching", labelKey: "subscriptions.coachingOnly", icon: Star, gradient: "from-indigo-400 to-blue-600" },
];

const DEFAULT_SUB_PRICES: Record<string, number> = {
  full: 2000,
  courses: 500,
  articles: 500,
  podcasts: 500,
  videos: 500,
  pdfs: 500,
  live: 500,
  coaching: 500,
};

function PricesView() {
  const { t } = useTranslation();
  const [allItems, setAllItems] = useState<Array<{ item: ContentItem; type: ContentSubTab; typeLabel: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [priceDialog, setPriceDialog] = useState<{ open: boolean; contentType: ContentSubTab; item: ContentItem | null }>({ open: false, contentType: "courses", item: null });
  const [newPrice, setNewPrice] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<ContentSubTab | "all">("all");
  const [saving, setSaving] = useState(false);

  // ── Subscription prices state ──
  const [subPrices, setSubPrices] = useState<Record<string, number>>({ ...DEFAULT_SUB_PRICES });
  const [subPricesLoading, setSubPricesLoading] = useState(true);
  const [editingSubPrice, setEditingSubPrice] = useState<string | null>(null);
  const [subPriceInput, setSubPriceInput] = useState<number>(0);
  const [savingSubPrice, setSavingSubPrice] = useState(false);

  // ── Full plan content types ──
  const ALL_CONTENT_TYPES = ["courses", "articles", "podcasts", "videos", "pdfs", "live", "coaching"];
  const [fullPlanIncludes, setFullPlanIncludes] = useState<string[]>(ALL_CONTENT_TYPES);
  const [savingFullPlanIncludes, setSavingFullPlanIncludes] = useState(false);

  // ── Full plan per-item exclusions ──
  const [fullPlanExcludedItems, setFullPlanExcludedItems] = useState<Array<{ id: string; type: string }>>([]);
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const toggleFullPlanType = (type: string) => {
    setFullPlanIncludes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleItemExclusion = (itemId: string, itemType: string) => {
    setFullPlanExcludedItems(prev => {
      const exists = prev.find(e => e.id === itemId);
      if (exists) {
        return prev.filter(e => e.id !== itemId);
      }
      return [...prev, { id: itemId, type: itemType }];
    });
  };

  const isItemExcluded = (itemId: string) => fullPlanExcludedItems.some(e => e.id === itemId);

  const saveFullPlanIncludes = async () => {
    setSavingFullPlanIncludes(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          settings: {
            full_plan_includes: JSON.stringify(fullPlanIncludes),
            full_plan_excluded_items: JSON.stringify(fullPlanExcludedItems),
          },
        }),
      });
      if (res.ok) {
        toast.success(t("admin.settingsSaved") || "تم الحفظ بنجاح");
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSavingFullPlanIncludes(false);
    }
  };

  // ── Fetch subscription prices ──
  const fetchSubPrices = useCallback(async () => {
    setSubPricesLoading(true);
    try {
      const res = await fetch("/api/subscription-prices");
      if (res.ok) {
        const data = await res.json();
        if (data.prices) {
          setSubPrices(data.prices);
        }
        if (data.fullPlanIncludes) {
          setFullPlanIncludes(data.fullPlanIncludes);
        }
        if (data.fullPlanExcludedItems) {
          setFullPlanExcludedItems(data.fullPlanExcludedItems);
        }
      }
    } catch (e) {
      console.error("Error fetching subscription prices:", e);
    } finally {
      setSubPricesLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubPrices(); }, [fetchSubPrices]);

  const handleSubPriceSave = async (planId: string) => {
    setSavingSubPrice(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          settings: {
            [`subscription_price_${planId}`]: subPriceInput,
          },
        }),
      });
      if (res.ok) {
        setSubPrices((prev) => ({ ...prev, [planId]: subPriceInput }));
        setEditingSubPrice(null);
        toast.success(t("admin.priceUpdated"));
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSavingSubPrice(false);
    }
  };

  const startEditSubPrice = (planId: string) => {
    setSubPriceInput(subPrices[planId] ?? DEFAULT_SUB_PRICES[planId] ?? 0);
    setEditingSubPrice(planId);
  };

  // ── Fetch all content types ──
  const fetchAllContent = useCallback(async () => {
    setLoading(true);
    try {
      const typeLabels: Record<ContentSubTab, string> = {
        courses: t("nav.courses"),
        articles: t("nav.articles"),
        podcasts: t("nav.podcasts"),
        videos: t("nav.videos"),
        pdfs: t("nav.pdfs"),
        live: t("nav.live"),
        coaching: t("nav.coaching"),
      };

      const results: Array<{ item: ContentItem; type: ContentSubTab; typeLabel: string }> = [];

      // Use the unified admin all-content endpoint (1 request instead of 6)
      try {
        const res = await fetch("/api/admin/all-content", { headers: adminHeaders() });
        if (res.ok) {
          const data = await res.json();
          const tabs: ContentSubTab[] = ["courses", "articles", "podcasts", "videos", "pdfs", "live", "coaching"];
          const responseKeys: Record<ContentSubTab, string> = {
            courses: "courses",
            articles: "articles",
            podcasts: "podcasts",
            videos: "videos",
            pdfs: "pdfs",
            live: "liveSessions",
            coaching: "coachings",
          };
          for (const tab of tabs) {
            const rawItems = data[responseKeys[tab]] || [];
            rawItems.forEach((r: Record<string, unknown>) => {
              results.push({
                item: normalizeContentItem(r),
                type: tab,
                typeLabel: typeLabels[tab],
              });
            });
          }
        }
      } catch (e) {
        console.error("Error fetching all-content:", e);
      }

      setAllItems(results);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchAllContent(); }, [fetchAllContent]);

  const filteredItems = useMemo(() => {
    if (filterType === "all") return allItems;
    return allItems.filter((r) => r.type === filterType);
  }, [allItems, filterType]);

  const openPriceEdit = (contentType: ContentSubTab, item: ContentItem) => {
    setNewPrice(item.price);
    setPriceDialog({ open: true, contentType, item });
  };

  const handlePriceSave = async () => {
    if (!priceDialog.item || !priceDialog.contentType) return;
    setSaving(true);
    try {
      const updatedPrice = newPrice ?? 0;
      const config = CONTENT_API_CONFIG[priceDialog.contentType];
      const res = await fetch("/api/prices", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          contentType: config.contentType,
          itemId: priceDialog.item.id,
          price: updatedPrice,
        }),
      });

      if (res.ok) {
        toast.success(t("admin.priceUpdated"));
        fetchAllContent();
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
      setPriceDialog({ open: false, contentType: "courses", item: null });
    }
  };

  const typeColorMap: Record<string, string> = {
    courses: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    articles: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
    podcasts: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    videos: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
    pdfs: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    live: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.prices")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("admin.managePrices")}</p>
      </div>

      {/* ── Subscription Plan Prices ── */}
      <Card className="border-amber-200 dark:border-amber-900/50 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
              <Crown className="size-5 text-white" />
            </div>
            <div>
              <span>{t("admin.subscriptionPrices") || "أسعار الاشتراكات"}</span>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                {t("admin.subscriptionPricesDesc") || "قم بتعديل أسعار خطط الاشتراك الشهرية"}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subPricesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const PlanIcon = plan.icon;
                const currentPrice = subPrices[plan.id] ?? DEFAULT_SUB_PRICES[plan.id] ?? 0;
                const isEditing = editingSubPrice === plan.id;
                const isFull = plan.id === "full";

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`relative rounded-xl border-2 p-4 transition-all ${
                      isFull
                        ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 dark:border-amber-700 shadow-md shadow-amber-500/10"
                        : "border-muted hover:border-primary/30 bg-card"
                    }`}
                  >
                    {isFull && (
                      <Badge className="absolute -top-2.5 start-3 bg-amber-500 text-white border-0 text-[10px] px-2">
                        ⭐ {t("admin.recommended") || "مميز"}
                      </Badge>
                    )}

                    <div className="flex items-center gap-3 mb-3">
                      <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-lg shrink-0`}>
                        <PlanIcon className="size-5 text-white" />
                      </div>
                      <span className="font-semibold text-sm leading-tight">{t(plan.labelKey)}</span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={subPriceInput}
                            onChange={(e) => setSubPriceInput(e.target.value ? parseFloat(e.target.value) : 0)}
                            className="h-9 text-sm font-semibold"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSubPriceSave(plan.id);
                              if (e.key === "Escape") setEditingSubPrice(null);
                            }}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">DA</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white flex-1"
                            onClick={() => handleSubPriceSave(plan.id)}
                            disabled={savingSubPrice}
                          >
                            {savingSubPrice ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs flex-1"
                            onClick={() => setEditingSubPrice(null)}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xl font-bold text-foreground">{currentPrice.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground ms-1">DA</span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">/{t("subscriptions.perMonth")}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950"
                          onClick={() => startEditSubPrice(plan.id)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Full Plan Content Types & Per-Item Control ── */}
      <Card className="border-blue-200 dark:border-blue-900/50 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500">
              <Crown className="size-5 text-white" />
            </div>
            <div>
              <span>{t("admin.fullPlanIncludes") || "محتوى الاشتراك الكامل"}</span>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                {t("admin.fullPlanIncludesDesc") || "اختر أنواع المحتوى المشمولة في خطة الوصول الكامل، ثم حدد العناصر التي تريد استثناؤها"}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Checkboxes for each content type */}
          <div className="space-y-3">
            {ALL_CONTENT_TYPES.map((type) => {
              const typeLabels: Record<string, string> = { courses: t("nav.courses"), articles: t("nav.articles"), podcasts: t("nav.podcasts"), videos: t("nav.videos"), pdfs: t("nav.pdfs"), live: t("nav.live"), coaching: t("nav.coaching") };
              const typeIcons: Record<string, typeof BookOpen> = { courses: BookOpen, articles: FileText, podcasts: Headphones, videos: Video, pdfs: FileDown, live: Radio, coaching: Sparkles };
              const typeGradients: Record<string, string> = { courses: "from-emerald-400 to-teal-600", articles: "from-cyan-400 to-sky-600", podcasts: "from-violet-400 to-purple-600", videos: "from-rose-400 to-pink-600", pdfs: "from-amber-400 to-yellow-600", live: "from-teal-400 to-emerald-600", coaching: "from-indigo-400 to-blue-600" };
              const isChecked = fullPlanIncludes.includes(type);
              const TypeIcon = typeIcons[type];
              const isExpanded = expandedType === type;
              const itemsOfType = allItems.filter(i => i.type === type);
              const excludedCount = fullPlanExcludedItems.filter(e => e.type === type).length;

              return (
                <div key={type} className="space-y-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFullPlanType(type)}
                      className={`relative flex-1 rounded-xl border-2 p-3 transition-all flex items-center gap-3 ${
                        isChecked
                          ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-600 shadow-sm"
                          : "border-muted hover:border-blue-200 bg-card"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${typeGradients[type]} flex items-center justify-center shrink-0 ${!isChecked ? 'opacity-40' : ''}`}>
                        <TypeIcon className="size-4 text-white" />
                      </div>
                      <span className={`text-sm font-medium ${!isChecked ? 'text-muted-foreground' : ''}`}>{typeLabels[type]}</span>
                      {isChecked && (
                        <Check className="size-4 text-blue-500 absolute top-1.5 end-1.5" />
                      )}
                    </button>
                    {isChecked && itemsOfType.length > 0 && (
                      <button
                        onClick={() => setExpandedType(isExpanded ? null : type)}
                        className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                          isExpanded
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-blue-600"
                            : "border-muted hover:border-blue-200 bg-card text-muted-foreground hover:text-blue-600"
                        }`}
                        title={t("admin.manageItems") || "إدارة العناصر"}
                      >
                        <ChevronDown className={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* Per-item control - expanded section */}
                  {isChecked && isExpanded && (
                    <div className="mt-2 me-12 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/10 space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">
                          {t("admin.itemsInPlan") || "العناصر في الاشتراك الكامل"}
                          {excludedCount > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 ms-1">
                              ({excludedCount} {t("admin.excluded") || "مستثنى"})
                            </span>
                          )}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2"
                            onClick={() => {
                              // Include all items of this type (remove from exclusions)
                              setFullPlanExcludedItems(prev => prev.filter(e => e.type !== type));
                            }}
                          >
                            {t("admin.includeAll") || "تضمين الكل"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2 text-amber-600"
                            onClick={() => {
                              // Exclude all non-free items of this type
                              const itemsToExclude = itemsOfType.filter(i => !i.item.isFree).map(i => ({ id: i.item.id, type: i.type }));
                              setFullPlanExcludedItems(prev => {
                                const withoutThisType = prev.filter(e => e.type !== type);
                                return [...withoutThisType, ...itemsToExclude];
                              });
                            }}
                          >
                            {t("admin.excludeAll") || "استثناء الكل"}
                          </Button>
                        </div>
                      </div>
                      {itemsOfType.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          {t("admin.noItemsInType") || "لا توجد عناصر في هذا القسم بعد"}
                        </p>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1 scrollbar-thin">
                          {itemsOfType.map(({ item }) => {
                            const excluded = isItemExcluded(item.id);
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all text-sm ${
                                  excluded
                                    ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
                                    : "bg-card border border-transparent"
                                }`}
                              >
                                <button
                                  onClick={() => toggleItemExclusion(item.id, type)}
                                  className={`shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-all ${
                                    excluded
                                      ? "border-amber-400 bg-amber-100 dark:bg-amber-900"
                                      : "border-blue-400 bg-blue-500"
                                  }`}
                                >
                                  {excluded ? (
                                    <X className="size-3 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <Check className="size-3 text-white" />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <span className={`text-xs truncate block ${excluded ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    {item.title}
                                  </span>
                                </div>
                                {item.isFree ? (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400 shrink-0">
                                    {t("common.free")}
                                  </Badge>
                                ) : excluded ? (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400 shrink-0">
                                    {t("admin.excluded") || "مستثنى"}
                                  </Badge>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setFullPlanIncludes([...ALL_CONTENT_TYPES])}
            >
              {t("admin.selectAll") || "تحديد الكل"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => { setFullPlanIncludes([]); setFullPlanExcludedItems([]); }}
            >
              {t("admin.deselectAll") || "إلغاء الكل"}
            </Button>
            <Button
              size="sm"
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={saveFullPlanIncludes}
              disabled={savingFullPlanIncludes}
            >
              {savingFullPlanIncludes ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              {t("admin.save") || "حفظ"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter by content type */}
      <div className="flex gap-1 overflow-x-auto bg-muted rounded-lg p-1 scrollbar-none">
        <button
          onClick={() => setFilterType("all")}
          className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
            filterType === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("admin.allPrices")}
        </button>
        {(["courses", "articles", "podcasts", "videos", "pdfs", "live", "coaching"] as ContentSubTab[]).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
              filterType === type ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`nav.${type}`)}
          </button>
        ))}
      </div>

      {/* Prices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.title")}</TableHead>
                <TableHead>{t("admin.contentType")}</TableHead>
                <TableHead>{t("admin.isFree")}</TableHead>
                <TableHead>{t("admin.itemPrice")}</TableHead>
                <TableHead className="text-end">{t("admin.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Skeleton className="h-4 w-48 mx-auto mb-2" />
                    <Skeleton className="h-4 w-32 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    {t("admin.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map(({ item, type }) => (
                  <TableRow key={`${type}-${item.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-md overflow-hidden bg-muted shrink-0 hidden sm:block">
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-medium text-sm truncate max-w-[200px]">{item.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`border-0 text-xs ${typeColorMap[type]}`}>
                        {t(`nav.${type}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.isFree ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">{t("common.free")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("common.paid")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.isFree ? (
                        <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">—</span>
                      ) : item.price ? (
                        <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{item.price.toLocaleString()} {t("common.currency")}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t("admin.noPriceSet")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      {!item.isFree && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => openPriceEdit(type, item)}>
                          <Pencil className="size-3.5" />
                          {t("admin.updatePrice")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Price Edit Dialog */}
      <Dialog open={priceDialog.open} onOpenChange={(open) => { if (!open) setPriceDialog({ open: false, contentType: "courses", item: null }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Banknote className="size-5 text-teal-600" />
                {t("admin.updatePrice")}
              </div>
            </DialogTitle>
            <DialogDescription>
              {priceDialog.item?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("admin.priceDZD")}</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={newPrice ?? ""}
                onChange={(e) => setNewPrice(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0"
                className="text-lg font-semibold"
              />
            </div>
            <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
              {newPrice ? (
                <span>{t("admin.itemPrice")}: <strong className="text-foreground">{newPrice.toLocaleString()} {t("common.currency")}</strong></span>
              ) : (
                <span>{t("admin.noPriceSet")}</span>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialog({ open: false, contentType: "courses", item: null })}>
              {t("admin.cancel")}
            </Button>
            <Button onClick={handlePriceSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Check className="size-4 me-1.5" />
              {t("admin.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TAB 5: SETTINGS ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsView() {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Site settings state
  const [siteName, setSiteName] = useState({ ar: "", fr: "", en: "" });
  const [siteDesc, setSiteDesc] = useState({ ar: "", fr: "", en: "" });

  // Social links state
  const [socialLinks, setSocialLinks] = useState({
    youtube: "",
    zoom: "",
    facebook: "",
    instagram: "",
    tiktok: "",
    twitter: "",
    telegram: "",
    whatsapp: "",
  });

  // CCP payment state
  const [ccpNumber, setCcpNumber] = useState("");
  const [ccpHolderName, setCcpHolderName] = useState("");
  const [ccpWilaya, setCcpWilaya] = useState("");

  // Sliders state
  const [sliders, setSliders] = useState<Slider[]>([]);
  const [sliderDialog, setSliderDialog] = useState<{ open: boolean; slider: Slider | null; isNew: boolean }>({ open: false, slider: null, isNew: false });
  const [sliderForm, setSliderForm] = useState({ imageUrl: "", title: "", order: 0 });

  // Individual purchase settings state
  const [individualPurchasesEnabled, setIndividualPurchasesEnabled] = useState(true);

  // Homepage editor state
  const [heroTitle, setHeroTitle] = useState({ ar: "", fr: "", en: "" });
  const [heroSubtitle, setHeroSubtitle] = useState({ ar: "", fr: "", en: "" });
  const [heroDescription, setHeroDescription] = useState({ ar: "", fr: "", en: "" });
  const [siteOwnerNameSetting, setSiteOwnerNameSetting] = useState({ ar: "", fr: "", en: "" });
  const [ctaButton1, setCtaButton1] = useState({ ar: "", fr: "", en: "" });
  const [ctaButton2, setCtaButton2] = useState({ ar: "", fr: "", en: "" });
  const [introVideoUrl, setIntroVideoUrl] = useState("");

  // Admin code change state
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");

  const socialConfig = [
    { key: "youtube" as const, labelKey: "admin.youtube", icon: "▶" },
    { key: "zoom" as const, labelKey: "admin.zoom", icon: "◉" },
    { key: "facebook" as const, labelKey: "admin.facebook", icon: "f" },
    { key: "instagram" as const, labelKey: "admin.instagram", icon: "📷" },
    { key: "tiktok" as const, labelKey: "admin.tiktok", icon: "♪" },
    { key: "twitter" as const, labelKey: "admin.twitter", icon: "𝕏" },
    { key: "telegram" as const, labelKey: "admin.telegram", icon: "✈" },
    { key: "whatsapp" as const, labelKey: "admin.whatsapp", icon: "💬" },
  ];

  // ── Fetch settings on mount ──
  useEffect(() => {
    (async () => {
      try {
        // Fetch site settings
        const settingsRes = await fetch("/api/admin/settings", { headers: adminHeaders() });
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          const settings = data.settings || {};

          if (settings.siteName) {
            try {
              const parsed = JSON.parse(settings.siteName);
              setSiteName((prev) => ({ ...prev, ar: parsed.ar || prev.ar, fr: parsed.fr || prev.fr, en: parsed.en || prev.en }));
            } catch { /* keep defaults */ }
          }
          if (settings.siteDescription) {
            try {
              const parsed = JSON.parse(settings.siteDescription);
              setSiteDesc((prev) => ({ ...prev, ar: parsed.ar || prev.ar, fr: parsed.fr || prev.fr, en: parsed.en || prev.en }));
            } catch { /* keep defaults */ }
          }
          if (settings.socialLinks) {
            try {
              const parsed = JSON.parse(settings.socialLinks);
              setSocialLinks((prev) => ({ ...prev, ...parsed }));
            } catch { /* keep defaults */ }
          }
          if (settings.ccpNumber) {
            setCcpNumber(settings.ccpNumber);
          }
          if (settings.ccpHolderName) {
            setCcpHolderName(settings.ccpHolderName);
          }
          if (settings.ccpWilaya) {
            setCcpWilaya(settings.ccpWilaya);
          }
          if (settings.individualPurchasesEnabled !== undefined) {
            setIndividualPurchasesEnabled(settings.individualPurchasesEnabled === "true" || settings.individualPurchasesEnabled === true);
          }
          // Homepage editor settings
          if (settings.heroTitle) {
            try { const parsed = JSON.parse(settings.heroTitle); setHeroTitle((prev) => ({ ...prev, ar: parsed.ar || prev.ar, fr: parsed.fr || prev.fr, en: parsed.en || prev.en })); } catch { /* keep defaults */ }
          }
          if (settings.heroSubtitle) {
            try { const parsed = JSON.parse(settings.heroSubtitle); setHeroSubtitle((prev) => ({ ...prev, ar: parsed.ar || prev.ar, fr: parsed.fr || prev.fr, en: parsed.en || prev.en })); } catch { /* keep defaults */ }
          }
          if (settings.heroDescription) {
            try { const parsed = JSON.parse(settings.heroDescription); setHeroDescription((prev) => ({ ...prev, ar: parsed.ar || prev.ar, fr: parsed.fr || prev.fr, en: parsed.en || prev.en })); } catch { /* keep defaults */ }
          }
          if (settings.siteOwnerNameSetting) {
            try { const parsed = JSON.parse(settings.siteOwnerNameSetting); setSiteOwnerNameSetting((prev) => ({ ...prev, ar: parsed.ar || prev.ar, fr: parsed.fr || prev.fr, en: parsed.en || prev.en })); } catch { /* keep defaults */ }
          }
          if (settings.ctaButton1) {
            try { const parsed = JSON.parse(settings.ctaButton1); setCtaButton1((prev) => ({ ...prev, ar: parsed.ar || prev.ar, fr: parsed.fr || prev.fr, en: parsed.en || prev.en })); } catch { /* keep defaults */ }
          }
          if (settings.ctaButton2) {
            try { const parsed = JSON.parse(settings.ctaButton2); setCtaButton2((prev) => ({ ...prev, ar: parsed.ar || prev.ar, fr: parsed.fr || prev.fr, en: parsed.en || prev.en })); } catch { /* keep defaults */ }
          }
          if (settings.introVideoUrl) {
            setIntroVideoUrl(settings.introVideoUrl);
          }
        }

        // Fetch sliders
        const slidersRes = await fetch("/api/sliders");
        if (slidersRes.ok) {
          const data = await slidersRes.json();
          setSliders((data.sliders || []).map((s: Record<string, unknown>) => ({
            id: s.id as string,
            imageUrl: s.imageUrl as string,
            title: s.title as string,
            order: (s.order as number) || 0,
          })));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Save site name & description ──
  const handleSaveSiteInfo = async () => {
    setSaving("siteInfo");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          settings: {
            siteName: JSON.stringify(siteName),
            siteDescription: JSON.stringify(siteDesc),
          },
        }),
      });
      if (res.ok) {
        toast.success(t("admin.changesSaved"));
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(null);
    }
  };

  // ── Save homepage content ──
  const handleSaveHomepage = async () => {
    setSaving("homepage");
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
            introVideoUrl: introVideoUrl,
          },
        }),
      });
      if (res.ok) {
        toast.success(t("admin.changesSaved"));
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(null);
    }
  };

  // ── Save social links ──
  const handleSaveSocialLinks = async () => {
    setSaving("social");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          settings: {
            socialLinks: JSON.stringify(socialLinks),
          },
        }),
      });
      if (res.ok) {
        toast.success(t("admin.changesSaved"));
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(null);
    }
  };

  // ── Save CCP number ──
  const handleSaveCCP = async () => {
    if (!ccpNumber.trim()) {
      toast.error(t("common.error"));
      return;
    }
    if (!ccpHolderName.trim()) {
      toast.error(t("common.error"));
      return;
    }
    if (!ccpWilaya.trim()) {
      toast.error(t("common.error"));
      return;
    }
    setSaving("ccp");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          settings: { ccpNumber, ccpHolderName, ccpWilaya },
        }),
      });
      if (res.ok) {
        toast.success(t("admin.changesSaved"));
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(null);
    }
  };

  // ── Save individual purchase settings ──
  const handleSavePurchaseSettings = async () => {
    setSaving("purchaseSettings");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({
          settings: { individualPurchasesEnabled: String(individualPurchasesEnabled) },
        }),
      });
      if (res.ok) {
        toast.success(t("admin.changesSaved"));
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(null);
    }
  };

  // ── Change admin code ──
  const handleChangeAdminCode = async () => {
    if (!currentCode.trim() || !newCode.trim()) {
      toast.error(t("common.error"));
      return;
    }
    if (newCode.length < 4) {
      toast.error(t("admin.codeMinLength"));
      return;
    }
    setSaving("adminCode");
    try {
      const res = await fetch("/api/admin/change-code", {
        method: "PUT",
        headers: adminHeaders(),
        body: JSON.stringify({ currentCode, newCode }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStoredAdminCode(newCode);
        toast.success(t("admin.codeChanged"));
        setCurrentCode("");
        setNewCode("");
      } else if (res.status === 403) {
        toast.error(t("admin.wrongCurrentCode"));
      } else {
        // Show the actual error message from server for debugging
        const errorMsg = data.debug || data.error || t("common.error");
        toast.error(errorMsg);
        console.error("Change code failed:", data);
      }
    } catch (err) {
      toast.error(t("common.error"));
      console.error("Change code network error:", err);
    } finally {
      setSaving(null);
    }
  };

  // ── Fetch sliders helper ──
  const fetchSliders = useCallback(async () => {
    try {
      const res = await fetch("/api/sliders");
      if (res.ok) {
        const data = await res.json();
        setSliders((data.sliders || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          imageUrl: s.imageUrl as string,
          title: s.title as string,
          order: (s.order as number) || 0,
        })));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const openSliderDialog = (slider: Slider | null, isNew: boolean) => {
    setSliderForm({
      imageUrl: slider?.imageUrl || "",
      title: slider?.title || "",
      order: slider?.order || sliders.length + 1,
    });
    setSliderDialog({ open: true, slider, isNew });
  };

  const handleSliderSave = async () => {
    if (!sliderForm.title.trim()) return;
    try {
      if (sliderDialog.isNew) {
        const res = await fetch("/api/sliders", {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(sliderForm),
        });
        if (!res.ok) {
          toast.error(t("common.error"));
          return;
        }
      } else if (sliderDialog.slider) {
        const res = await fetch("/api/sliders", {
          method: "PUT",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ id: sliderDialog.slider.id, ...sliderForm }),
        });
        if (!res.ok) {
          toast.error(t("common.error"));
          return;
        }
      }
      toast.success(t("admin.changesSaved"));
      fetchSliders();
    } catch {
      toast.error(t("common.error"));
    }
    setSliderDialog({ open: false, slider: null, isNew: false });
  };

  const handleSliderDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/sliders/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      if (res.ok) {
        toast.success(t("admin.itemDeleted"));
        fetchSliders();
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("admin.settings")}</h1>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <Skeleton className="h-4 w-48 mx-auto mb-3" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("admin.settings")}</h1>
      </div>

      {/* ─── Site Settings ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin.siteName")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trilingual site name */}
          {(["ar", "fr", "en"] as const).map((lang) => (
            <div key={`name-${lang}`} className="space-y-1.5">
              <Label className="text-sm flex items-center gap-2">
                {t(`admin.${lang}`)}
              </Label>
              <Input
                value={siteName[lang]}
                onChange={(e) => setSiteName((prev) => ({ ...prev, [lang]: e.target.value }))}
                dir={lang === "ar" ? "rtl" : "ltr"}
              />
            </div>
          ))}
          <Separator />
          {/* Trilingual site description */}
          {(["ar", "fr", "en"] as const).map((lang) => (
            <div key={`desc-${lang}`} className="space-y-1.5">
              <Label className="text-sm">{t("admin.siteDescription")} ({t(`admin.${lang}`)})</Label>
              <Textarea
                value={siteDesc[lang]}
                onChange={(e) => setSiteDesc((prev) => ({ ...prev, [lang]: e.target.value }))}
                rows={2}
                dir={lang === "ar" ? "rtl" : "ltr"}
              />
            </div>
          ))}
          <div className="pt-2">
            <Button onClick={handleSaveSiteInfo} disabled={saving === "siteInfo"} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving === "siteInfo" ? <Skeleton className="h-4 w-20" /> : t("admin.saveChanges")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Homepage Editor ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="size-5 text-teal-600" />
            {t("admin.homepageEditor")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("admin.homepageEditorDesc")}</p>

          {/* Hero Title - Trilingual */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-teal-700">{t("admin.heroTitle")}</Label>
            {(["ar", "fr", "en"] as const).map((lang) => (
              <div key={`heroTitle-${lang}`} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                <Input
                  value={heroTitle[lang]}
                  onChange={(e) => setHeroTitle((prev) => ({ ...prev, [lang]: e.target.value }))}
                  placeholder={lang === "ar" ? "فضاء الشفاء" : lang === "fr" ? "Espace de Guérison" : "Healing Space"}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                />
              </div>
            ))}
          </div>

          <Separator />

          {/* Hero Subtitle - Trilingual */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-teal-700">{t("admin.heroSubtitle")}</Label>
            {(["ar", "fr", "en"] as const).map((lang) => (
              <div key={`heroSub-${lang}`} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                <Input
                  value={heroSubtitle[lang]}
                  onChange={(e) => setHeroSubtitle((prev) => ({ ...prev, [lang]: e.target.value }))}
                  placeholder={lang === "ar" ? "منصتك الشاملة للعلاج والتعليم" : lang === "fr" ? "Votre plateforme complète de guérison" : "Your comprehensive healing platform"}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                />
              </div>
            ))}
          </div>

          <Separator />

          {/* Hero Description - Trilingual */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-teal-700">{t("admin.heroDescription")}</Label>
            {(["ar", "fr", "en"] as const).map((lang) => (
              <div key={`heroDesc-${lang}`} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                <Textarea
                  value={heroDescription[lang]}
                  onChange={(e) => setHeroDescription((prev) => ({ ...prev, [lang]: e.target.value }))}
                  rows={3}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  placeholder={lang === "ar" ? "منصة الدكتورة نسرين التعليمية..." : lang === "fr" ? "Plateforme éducative de Dr. Ness..." : "Dr. Ness's educational platform..."}
                />
              </div>
            ))}
          </div>

          <Separator />

          {/* Site Owner Name - Trilingual */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-teal-700">{t("admin.siteOwnerName")}</Label>
            {(["ar", "fr", "en"] as const).map((lang) => (
              <div key={`ownerName-${lang}`} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                <Input
                  value={siteOwnerNameSetting[lang]}
                  onChange={(e) => setSiteOwnerNameSetting((prev) => ({ ...prev, [lang]: e.target.value }))}
                  placeholder={lang === "ar" ? "الدكتورة نسرين" : "Dr. Ness"}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                />
              </div>
            ))}
          </div>

          <Separator />

          {/* CTA Buttons - Trilingual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-teal-700">{t("admin.ctaButton1")}</Label>
              {(["ar", "fr", "en"] as const).map((lang) => (
                <div key={`cta1-${lang}`} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                  <Input
                    value={ctaButton1[lang]}
                    onChange={(e) => setCtaButton1((prev) => ({ ...prev, [lang]: e.target.value }))}
                    placeholder={lang === "ar" ? "ابدأ رحلة الشفاء" : lang === "fr" ? "Commencer" : "Start Healing"}
                    dir={lang === "ar" ? "rtl" : "ltr"}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-teal-700">{t("admin.ctaButton2")}</Label>
              {(["ar", "fr", "en"] as const).map((lang) => (
                <div key={`cta2-${lang}`} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                  <Input
                    value={ctaButton2[lang]}
                    onChange={(e) => setCtaButton2((prev) => ({ ...prev, [lang]: e.target.value }))}
                    placeholder={lang === "ar" ? "تصفح المحتوى" : lang === "fr" ? "Parcourir" : "Browse Content"}
                    dir={lang === "ar" ? "rtl" : "ltr"}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Intro Video URL */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-teal-700 flex items-center gap-2">
              <Video className="size-4" />
              {t("admin.introVideoUrl")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("admin.introVideoUrlDesc")}</p>
            <div className="flex gap-2">
              <Input
                value={introVideoUrl}
                onChange={(e) => setIntroVideoUrl(e.target.value)}
                placeholder="https://res.cloudinary.com/.../video.mp4 أو https://www.youtube.com/embed/xxxxxxx"
                dir="ltr"
                className="flex-1"
              />
              {introVideoUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setIntroVideoUrl("")}
                  title={t("admin.removeVideo")}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            {/* Video upload button */}
            <div className="flex items-center gap-2">
              <label
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950/30 dark:text-teal-400 dark:hover:bg-teal-950/50"
              >
                <Upload className="size-3.5" />
                {t("admin.uploadVideo")}
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1 * 1024 * 1024 * 1024) {
                      toast.error(locale === "ar" ? "الملف كبير جداً (الحد 1 جيجابايت)" : "File too large (max 1GB)");
                      return;
                    }
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("type", "content");
                    formData.append("contentType", "videos");
                    try {
                      const res = await fetch("/api/upload", {
                        method: "POST",
                        headers: adminFormDataHeaders(),
                        body: formData,
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setIntroVideoUrl(data.url);
                        toast.success(t("admin.videoUploaded"));
                      } else {
                        const err = await res.json();
                        toast.error(err.error || t("common.error"));
                      }
                    } catch {
                      toast.error(t("common.error"));
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {introVideoUrl && introVideoUrl.includes('res.cloudinary.com') && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Check className="size-3 text-green-500" />
                  {t("admin.videoUploadedSuccess")}
                </span>
              )}
            </div>
            {/* Video preview */}
            {introVideoUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border bg-muted/50">
                <div className="relative aspect-video">
                  {introVideoUrl.includes('youtube.com') || introVideoUrl.includes('youtu.be') ? (
                    <iframe
                      src={introVideoUrl}
                      title="Video preview"
                      className="absolute inset-0 h-full w-full"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      className="absolute inset-0 h-full w-full object-contain bg-black"
                      controls
                      playsInline
                      preload="metadata"
                    >
                      <source src={introVideoUrl} />
                    </video>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button onClick={handleSaveHomepage} disabled={saving === "homepage"} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving === "homepage" ? <Skeleton className="h-4 w-20" /> : t("admin.saveChanges")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Social Links ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin.socialLinks")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {socialConfig.map((sc) => (
            <div key={sc.key} className="flex items-center gap-3">
              <Label className="w-28 shrink-0 text-sm font-medium">{t(sc.labelKey)}</Label>
              <Input
                value={socialLinks[sc.key]}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, [sc.key]: e.target.value }))}
                placeholder={`https://...`}
                className="flex-1"
                dir="ltr"
              />
            </div>
          ))}
          <div className="pt-2">
            <Button onClick={handleSaveSocialLinks} disabled={saving === "social"} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving === "social" ? <Skeleton className="h-4 w-20" /> : t("admin.saveChanges")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── CCP Payment Info ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="size-5 text-teal-600" />
            معلومات الدفع CCP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">معلومات الحساب البريدي CCP التي تظهر للمستخدمين عند الدفع</p>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">اسم صاحب الحساب</Label>
            <Input
              value={ccpHolderName}
              onChange={(e) => setCcpHolderName(e.target.value)}
              placeholder="الاسم الكامل"
              dir="rtl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">رقم CCP</Label>
            <Input
              value={ccpNumber}
              onChange={(e) => setCcpNumber(e.target.value)}
              placeholder="00000 00000 00"
              dir="ltr"
              className="font-mono tracking-wider text-center text-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">الولاية</Label>
            <Input
              value={ccpWilaya}
              onChange={(e) => setCcpWilaya(e.target.value)}
              placeholder="اسم الولاية"
              dir="rtl"
            />
          </div>
          <div className="pt-2">
            <Button onClick={handleSaveCCP} disabled={saving === "ccp"} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving === "ccp" ? <Skeleton className="h-4 w-20" /> : t("admin.saveChanges")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Slider Management ─── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t("admin.sliders")}</CardTitle>
          <Button size="sm" onClick={() => openSliderDialog(null, true)} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="size-4 me-1.5" />
            {t("admin.addSlider")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sliders.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <ImageIcon className="size-8 mx-auto mb-2 opacity-30" />
              <p>{t("admin.noData")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sliders
                .sort((a, b) => a.order - b.order)
                .map((slider, idx) => (
                  <div key={slider.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                    <GripVertical className="size-5 text-muted-foreground cursor-grab shrink-0" />
                    <div className="size-16 h-10 rounded-md overflow-hidden bg-muted shrink-0">
                      <img src={slider.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{slider.title}</p>
                      <p className="text-xs text-muted-foreground">{t("admin.order")}: {idx + 1}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openSliderDialog(slider, false)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700" onClick={() => handleSliderDelete(slider.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Individual Purchases Settings ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingBag className="size-5 text-teal-600" />
            {t("admin.individualPurchases")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("admin.individualPurchasesSettingDesc")}</p>
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <p className="text-sm font-medium">{t("admin.enableIndividualPurchases")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("admin.enableIndividualPurchasesDesc")}</p>
            </div>
            <Switch
              checked={individualPurchasesEnabled}
              onCheckedChange={setIndividualPurchasesEnabled}
            />
          </div>
          <div className="pt-2">
            <Button onClick={handleSavePurchaseSettings} disabled={saving === "purchaseSettings"} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving === "purchaseSettings" ? <Skeleton className="h-4 w-20" /> : t("admin.saveChanges")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Security: Change Admin Code ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="size-5 text-teal-600" />
            {t("admin.security")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("admin.changeAdminCodeDesc")}</p>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t("admin.currentCode")}</Label>
            <Input
              type="password"
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value)}
              placeholder={t("admin.currentCodePlaceholder")}
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t("admin.newCode")}</Label>
            <Input
              type="password"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder={t("admin.newCodePlaceholder")}
              dir="ltr"
            />
          </div>
          <div className="pt-2">
            <Button
              onClick={handleChangeAdminCode}
              disabled={saving === "adminCode"}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving === "adminCode" ? <Skeleton className="h-4 w-20" /> : (
                <>
                  <Shield className="size-4 me-1.5" />
                  {t("admin.changeAdminCode")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Slider Add/Edit Dialog */}
      <Dialog open={sliderDialog.open} onOpenChange={(open) => { if (!open) setSliderDialog({ open: false, slider: null, isNew: false }); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {sliderDialog.isNew ? t("admin.addSlider") : t("admin.editSlider")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">{t("admin.sliderTitle")}</Label>
              <Input
                value={sliderForm.title}
                onChange={(e) => setSliderForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={t("admin.sliderTitle")}
              />
            </div>
            <FileUploadComponent
              value={sliderForm.imageUrl}
              onChange={(val) => setSliderForm((prev) => ({ ...prev, imageUrl: val }))}
              label={t("admin.sliderImage")}
              placeholder="https://..."
              uploadType="content"
              contentType="cover"
              maxSizeMB={100}
            />
            <div className="space-y-1.5">
              <Label className="text-sm">{t("admin.order")}</Label>
              <Input
                type="number"
                min={1}
                value={sliderForm.order}
                onChange={(e) => setSliderForm((prev) => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSliderDialog({ open: false, slider: null, isNew: false })}>
              {t("admin.cancel")}
            </Button>
            <Button onClick={handleSliderSave} className="bg-teal-600 hover:bg-teal-700 text-white">
              {t("admin.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TAB: HOMEPAGE CUSTOMIZER (تخصيص الرئيسية) ─────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function HomepageCustomizer() {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"hero" | "video" | "sliders" | "firebase">("hero");

  // Hero settings state
  const [heroTitle, setHeroTitle] = useState({ ar: "", fr: "", en: "" });
  const [heroSubtitle, setHeroSubtitle] = useState({ ar: "", fr: "", en: "" });
  const [heroDescription, setHeroDescription] = useState({ ar: "", fr: "", en: "" });
  const [siteOwnerNameSetting, setSiteOwnerNameSetting] = useState({ ar: "", fr: "", en: "" });
  const [ctaButton1, setCtaButton1] = useState({ ar: "", fr: "", en: "" });
  const [ctaButton2, setCtaButton2] = useState({ ar: "", fr: "", en: "" });

  // Video state
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);

  // Sliders state
  const [sliders, setSliders] = useState<Slider[]>([]);
  const [sliderDialog, setSliderDialog] = useState<{ open: boolean; slider: Slider | null; isNew: boolean }>({ open: false, slider: null, isNew: false });
  const [sliderForm, setSliderForm] = useState({ imageUrl: "", title: "", titleAr: "", titleFr: "", titleEn: "", order: 0, link: "" });

  // Firebase status
  const [firebaseStatus, setFirebaseStatus] = useState<any>(null);
  const [checkingFirebase, setCheckingFirebase] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    (async () => {
      try {
        const settingsRes = await fetch("/api/admin/settings", { headers: adminHeaders() });
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          const settings = data.settings || {};

          const parseTrilingual = (key: string) => {
            if (!settings[key]) return { ar: "", fr: "", en: "" };
            try {
              const parsed = JSON.parse(settings[key]);
              return { ar: parsed.ar || "", fr: parsed.fr || "", en: parsed.en || "" };
            } catch { return { ar: "", fr: "", en: "" }; }
          };

          setHeroTitle(parseTrilingual('heroTitle'));
          setHeroSubtitle(parseTrilingual('heroSubtitle'));
          setHeroDescription(parseTrilingual('heroDescription'));
          setSiteOwnerNameSetting(parseTrilingual('siteOwnerNameSetting'));
          setCtaButton1(parseTrilingual('ctaButton1'));
          setCtaButton2(parseTrilingual('ctaButton2'));
          if (settings.introVideoUrl) setIntroVideoUrl(settings.introVideoUrl);
        }

        const slidersRes = await fetch("/api/sliders");
        if (slidersRes.ok) {
          const data = await slidersRes.json();
          setSliders((data.sliders || []).map((s: Record<string, unknown>) => ({
            id: s.id as string,
            imageUrl: s.imageUrl as string,
            title: s.title as string,
            order: (s.order as number) || 0,
          })));
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // Save homepage content
  const handleSaveHomepage = async () => {
    setSaving("homepage");
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
          },
        }),
      });
      if (res.ok) {
        toast.success(t("admin.changesSaved") || "تم حفظ التغييرات");
      } else {
        toast.error(t("common.error") || "حدث خطأ");
      }
    } catch {
      toast.error(t("common.error") || "حدث خطأ");
    } finally {
      setSaving(null);
    }
  };

  // Upload video (direct to Cloudinary from browser — bypasses Vercel body size limit)
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
      // Step 1: Get signed upload parameters from our server
      const signRes = await fetch("/api/cloudinary/signature", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          folder: "healing-space/videos",
          resourceType: "video",
        }),
      });

      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({}));
        toast.error((err as Record<string, string>).error || t("common.error") || "Authorization failed");
        return;
      }

      const signData = await signRes.json();

      // Step 2: Upload directly to Cloudinary using XMLHttpRequest for real progress
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signData.cloudName}/video/upload`;

      const uploadResult = await new Promise<{ url: string; publicId: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Real progress tracking
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setVideoUploadProgress(percent);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve({ url: response.secure_url, publicId: response.public_id });
            } catch {
              reject(new Error("Invalid Cloudinary response"));
            }
          } else {
            try {
              const errResponse = JSON.parse(xhr.responseText);
              reject(new Error(errResponse.error?.message || `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

        xhr.open("POST", cloudinaryUrl);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", signData.apiKey);
        formData.append("timestamp", signData.timestamp.toString());
        formData.append("signature", signData.signature);
        formData.append("folder", signData.folder);
        // NOTE: resource_type is NOT a body param — it's in the URL path
        formData.append("use_filename", "true");
        formData.append("unique_filename", "true");

        xhr.send(formData);
      });

      setIntroVideoUrl(uploadResult.url);
      setVideoUploadProgress(100);
      toast.success(t("admin.videoUploaded") || "تم رفع الفيديو بنجاح");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("cancelled")) {
        toast.info(locale === "ar" ? "تم إلغاء الرفع" : "Upload cancelled");
      } else {
        console.error("[Video Upload] Error:", error);
        toast.error(t("common.error") || "حدث خطأ");
      }
    } finally {
      setUploadingVideo(false);
      setVideoUploadProgress(0);
      e.target.value = "";
    }
  };

  // Slider management
  const fetchSliders = useCallback(async () => {
    try {
      const res = await fetch("/api/sliders");
      if (res.ok) {
        const data = await res.json();
        setSliders((data.sliders || []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          imageUrl: s.imageUrl as string,
          title: s.title as string,
          order: (s.order as number) || 0,
        })));
      }
    } catch (e) { console.error(e); }
  }, []);

  const handleSliderSave = async () => {
    if (!sliderForm.titleAr && !sliderForm.titleFr && !sliderForm.titleEn && !sliderForm.title) return;
    try {
      if (sliderDialog.isNew) {
        const res = await fetch("/api/sliders", {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(sliderForm),
        });
        if (!res.ok) { toast.error(t("common.error")); return; }
      } else if (sliderDialog.slider) {
        const res = await fetch("/api/sliders", {
          method: "PUT",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ id: sliderDialog.slider.id, ...sliderForm }),
        });
        if (!res.ok) { toast.error(t("common.error")); return; }
      }
      toast.success(t("admin.changesSaved"));
      fetchSliders();
    } catch { toast.error(t("common.error")); }
    setSliderDialog({ open: false, slider: null, isNew: false });
  };

  const handleSliderDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/sliders/${encodeURIComponent(id)}`, { method: "DELETE", headers: adminHeaders() });
      if (res.ok) { toast.success(t("admin.itemDeleted")); fetchSliders(); }
      else { toast.error(t("common.error")); }
    } catch { toast.error(t("common.error")); }
  };

  // Check Firebase status
  const checkFirebaseStatus = async () => {
    setCheckingFirebase(true);
    try {
      const res = await fetch("/api/auth/firebase-status", { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFirebaseStatus(data);
      } else {
        setFirebaseStatus({ error: "Failed to check Firebase status" });
      }
    } catch {
      setFirebaseStatus({ error: "Network error checking Firebase status" });
    } finally {
      setCheckingFirebase(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">{t("admin.homepageEditor")}</h1>
        <Card><CardContent className="py-16 text-center"><Skeleton className="h-4 w-48 mx-auto mb-3" /><Skeleton className="h-4 w-32 mx-auto" /></CardContent></Card>
      </div>
    );
  }

  const sectionTabs = [
    { key: "hero" as const, label: locale === "ar" ? "البانر الرئيسي" : locale === "fr" ? "Bannière" : "Hero Banner", icon: BookOpen },
    { key: "video" as const, label: locale === "ar" ? "فيديو تعريفي" : locale === "fr" ? "Vidéo intro" : "Intro Video", icon: Video },
    { key: "sliders" as const, label: locale === "ar" ? "الشرائح" : locale === "fr" ? "Carrousel" : "Sliders", icon: ImageIcon },
    { key: "firebase" as const, label: locale === "ar" ? "حالة غوغل" : locale === "fr" ? "Statut Google" : "Google Status", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="size-6 text-teal-600" />
          {locale === "ar" ? "تخصيص الصفحة الرئيسية" : locale === "fr" ? "Personnaliser la page d'accueil" : "Customize Homepage"}
        </h1>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {sectionTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-teal-600 text-white shadow-lg shadow-teal-500/25"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── HERO SECTION ─── */}
      {activeSection === "hero" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="size-5 text-teal-600" />
              {locale === "ar" ? "تعديل البانر الرئيسي" : "Edit Hero Banner"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Hero Title */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-teal-700">{t("admin.heroTitle")}</Label>
              {(["ar", "fr", "en"] as const).map((lang) => (
                <div key={`heroTitle-${lang}`} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                  <Input value={heroTitle[lang]} onChange={(e) => setHeroTitle((prev) => ({ ...prev, [lang]: e.target.value }))} placeholder={lang === "ar" ? "فضاء الشفاء" : lang === "fr" ? "Espace de Guérison" : "Healing Space"} dir={lang === "ar" ? "rtl" : "ltr"} />
                </div>
              ))}
            </div>
            <Separator />
            {/* Hero Subtitle */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-teal-700">{t("admin.heroSubtitle")}</Label>
              {(["ar", "fr", "en"] as const).map((lang) => (
                <div key={`heroSub-${lang}`} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                  <Input value={heroSubtitle[lang]} onChange={(e) => setHeroSubtitle((prev) => ({ ...prev, [lang]: e.target.value }))} placeholder={lang === "ar" ? "منصتك الشاملة للعلاج والتعليم" : "Your comprehensive healing platform"} dir={lang === "ar" ? "rtl" : "ltr"} />
                </div>
              ))}
            </div>
            <Separator />
            {/* Hero Description */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-teal-700">{t("admin.heroDescription")}</Label>
              {(["ar", "fr", "en"] as const).map((lang) => (
                <div key={`heroDesc-${lang}`} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                  <Textarea value={heroDescription[lang]} onChange={(e) => setHeroDescription((prev) => ({ ...prev, [lang]: e.target.value }))} rows={3} dir={lang === "ar" ? "rtl" : "ltr"} placeholder={lang === "ar" ? "منصة الدكتورة نسرين التعليمية..." : "Dr. Ness's educational platform..."} />
                </div>
              ))}
            </div>
            <Separator />
            {/* Site Owner Name */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-teal-700">{t("admin.siteOwnerName")}</Label>
              {(["ar", "fr", "en"] as const).map((lang) => (
                <div key={`ownerName-${lang}`} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                  <Input value={siteOwnerNameSetting[lang]} onChange={(e) => setSiteOwnerNameSetting((prev) => ({ ...prev, [lang]: e.target.value }))} placeholder={lang === "ar" ? "الدكتورة نسرين" : "Dr. Ness"} dir={lang === "ar" ? "rtl" : "ltr"} />
                </div>
              ))}
            </div>
            <Separator />
            {/* CTA Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-teal-700">{t("admin.ctaButton1")}</Label>
                {(["ar", "fr", "en"] as const).map((lang) => (
                  <div key={`cta1-${lang}`} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                    <Input value={ctaButton1[lang]} onChange={(e) => setCtaButton1((prev) => ({ ...prev, [lang]: e.target.value }))} placeholder={lang === "ar" ? "ابدأ رحلة الشفاء" : "Start Healing"} dir={lang === "ar" ? "rtl" : "ltr"} />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-teal-700">{t("admin.ctaButton2")}</Label>
                {(["ar", "fr", "en"] as const).map((lang) => (
                  <div key={`cta2-${lang}`} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t(`admin.${lang}`)}</Label>
                    <Input value={ctaButton2[lang]} onChange={(e) => setCtaButton2((prev) => ({ ...prev, [lang]: e.target.value }))} placeholder={lang === "ar" ? "تصفح المحتوى" : "Browse Content"} dir={lang === "ar" ? "rtl" : "ltr"} />
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Button onClick={handleSaveHomepage} disabled={saving === "homepage"} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                {saving === "homepage" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {t("admin.saveChanges") || "حفظ التغييرات"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── VIDEO SECTION ─── */}
      {activeSection === "video" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="size-5 text-rose-600" />
              {locale === "ar" ? "الفيديو التعريفي" : locale === "fr" ? "Vidéo introductive" : "Intro Video"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              {locale === "ar" ? "أضف فيديو تعريفي يظهر في الصفحة الرئيسية. يمكنك رفع ملف فيديو أو إضافة رابط يوتيوب." : "Add an introductory video that appears on the homepage. Upload a video file or add a YouTube link."}
            </p>

            {/* Video Upload Button - PROMINENT */}
            <div className="rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/50 dark:border-teal-700 dark:bg-teal-950/20 p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/25">
                  <Video className="size-8 text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold">
                    {locale === "ar" ? "رفع فيديو تعريفي" : locale === "fr" ? "Télécharger une vidéo" : "Upload Intro Video"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {locale === "ar" ? "MP4, WebM, MOV — الحد الأقصى 1 جيجابايت" : "MP4, WebM, MOV — Max 1GB"}
                  </p>
                </div>

                {uploadingVideo ? (
                  <div className="w-full max-w-sm space-y-2">
                    <div className="flex items-center justify-center gap-2 text-sm text-teal-600">
                      <Loader2 className="size-5 animate-spin" />
                      {locale === "ar" ? "جارٍ رفع الفيديو..." : "Uploading video..."}
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div className="bg-teal-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${Math.min(videoUploadProgress, 100)}%` }} />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">{Math.round(videoUploadProgress)}%</p>
                  </div>
                ) : (
                  <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30 transition-all">
                    <Upload className="size-5" />
                    {locale === "ar" ? "اختر فيديو" : locale === "fr" ? "Choisir une vidéo" : "Choose Video"}
                    <input type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" className="hidden" onChange={handleVideoUpload} />
                  </label>
                )}
              </div>
            </div>

            <Separator />

            {/* Or enter URL */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Link2 className="size-4" />
                {locale === "ar" ? "أو أدخل رابط الفيديو" : "Or enter video URL"}
              </Label>
              <div className="flex gap-2">
                <Input value={introVideoUrl} onChange={(e) => setIntroVideoUrl(e.target.value)} placeholder="https://www.youtube.com/embed/xxxxxxx أو https://res.cloudinary.com/.../video.mp4" dir="ltr" className="flex-1" />
                {introVideoUrl && (
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setIntroVideoUrl("")}>
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Video Preview */}
            {introVideoUrl && (
              <div className="mt-3 rounded-xl overflow-hidden border shadow-lg">
                <div className="relative aspect-video bg-black">
                  {introVideoUrl.includes('youtube.com') || introVideoUrl.includes('youtu.be') ? (
                    <iframe src={introVideoUrl} title="Video preview" className="absolute inset-0 h-full w-full" allowFullScreen />
                  ) : (
                    <video className="absolute inset-0 h-full w-full object-contain" controls playsInline preload="metadata">
                      <source src={introVideoUrl} />
                    </video>
                  )}
                </div>
                <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate me-2">
                    {introVideoUrl.includes('youtube.com') || introVideoUrl.includes('youtu.be')
                      ? (locale === "ar" ? "فيديو يوتيوب" : "YouTube video")
                      : (locale === "ar" ? "فيديو مباشر" : "Direct video")}
                  </span>
                  <Check className="size-4 text-green-500 shrink-0" />
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button onClick={handleSaveHomepage} disabled={saving === "homepage"} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                {saving === "homepage" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {t("admin.saveChanges") || "حفظ التغييرات"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── SLIDERS SECTION ─── */}
      {activeSection === "sliders" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="size-5 text-violet-600" />
              {locale === "ar" ? "شرائح البانر" : locale === "fr" ? "Carrousel" : "Banner Sliders"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => { setSliderForm({ imageUrl: "", title: "", titleAr: "", titleFr: "", titleEn: "", order: sliders.length + 1, link: "" }); setSliderDialog({ open: true, slider: null, isNew: true }); }} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="size-4" />
              {locale === "ar" ? "إضافة شريحة" : "Add Slider"}
            </Button>

            {sliders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {locale === "ar" ? "لا توجد شرائح بعد. أضف شريحة لعرضها في البانر." : "No sliders yet. Add one to display in the banner."}
              </p>
            ) : (
              <div className="space-y-3">
                {sliders.sort((a, b) => a.order - b.order).map((slider) => (
                  <div key={slider.id} className="flex items-center gap-3 rounded-lg border p-3">
                    {slider.imageUrl ? (
                      <img src={slider.imageUrl} alt={slider.title} className="size-16 rounded-lg object-cover" />
                    ) : (
                      <div className="size-16 rounded-lg bg-muted flex items-center justify-center">
                        <ImageIcon className="size-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{slider.title}</p>
                      <p className="text-xs text-muted-foreground">{locale === "ar" ? "الترتيب" : "Order"}: {slider.order}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => { setSliderForm({ imageUrl: slider.imageUrl, title: slider.title, titleAr: "", titleFr: "", titleEn: "", order: slider.order, link: "" }); setSliderDialog({ open: true, slider, isNew: false }); }}>
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
                  <DialogTitle>{sliderDialog.isNew ? (locale === "ar" ? "إضافة شريحة" : "Add Slider") : (locale === "ar" ? "تعديل شريحة" : "Edit Slider")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "صورة الشريحة" : "Slider Image"}</Label>
                    <FileUploadComponent value={sliderForm.imageUrl} onChange={(url) => setSliderForm((prev) => ({ ...prev, imageUrl: url }))} contentType="sliders" />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                    <Input value={sliderForm.titleAr || sliderForm.title} onChange={(e) => setSliderForm((prev) => ({ ...prev, titleAr: e.target.value, title: e.target.value }))} dir="rtl" />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "الترتيب" : "Order"}</Label>
                    <Input type="number" value={sliderForm.order} onChange={(e) => setSliderForm((prev) => ({ ...prev, order: parseInt(e.target.value) || 1 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>{locale === "ar" ? "رابط (اختياري)" : "Link (optional)"}</Label>
                    <Input value={sliderForm.link || ""} onChange={(e) => setSliderForm((prev) => ({ ...prev, link: e.target.value }))} dir="ltr" placeholder="https://..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSliderDialog({ open: false, slider: null, isNew: false })}>{locale === "ar" ? "إلغاء" : "Cancel"}</Button>
                  <Button onClick={handleSliderSave} className="bg-teal-600 hover:bg-teal-700 text-white">{locale === "ar" ? "حفظ" : "Save"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* ─── FIREBASE/GOOGLE STATUS SECTION ─── */}
      {activeSection === "firebase" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="size-5 text-amber-600" />
              {locale === "ar" ? "حالة تسجيل الدخول بغوغل" : "Google Sign-in Status"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {locale === "ar"
                ? "تحقق من حالة إعدادات Firebase و Google لتشخيص مشاكل تسجيل الدخول."
                : "Check Firebase and Google configuration status to diagnose sign-in issues."}
            </p>

            <Button onClick={checkFirebaseStatus} disabled={checkingFirebase} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
              {checkingFirebase ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {locale === "ar" ? "فحص الحالة الآن" : "Check Status Now"}
            </Button>

            {firebaseStatus && (
              <div className="space-y-4 mt-4">
                {/* Admin SDK Status */}
                <div className="rounded-lg border p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    {firebaseStatus.adminSDK?.ready ? (
                      <><Check className="size-5 text-green-500" /> {locale === "ar" ? "Firebase Admin SDK يعمل" : "Firebase Admin SDK is working"}</>
                    ) : (
                      <><AlertCircle className="size-5 text-red-500" /> {locale === "ar" ? "Firebase Admin SDK لا يعمل!" : "Firebase Admin SDK is NOT working!"}</>
                    )}
                  </h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>Init Method: {firebaseStatus.adminSDK?.initMethod || "unknown"}</p>
                    {firebaseStatus.adminSDK?.initError && <p className="text-destructive">Error: {firebaseStatus.adminSDK.initError}</p>}
                  </div>
                </div>

                {/* Client Config */}
                <div className="rounded-lg border p-4">
                  <h4 className="font-semibold mb-2">{locale === "ar" ? "إعدادات العميل" : "Client Configuration"}</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>API Key: {firebaseStatus.clientConfig?.apiKey}</p>
                    <p>Auth Domain: {firebaseStatus.clientConfig?.authDomain}</p>
                    <p>Project ID: {firebaseStatus.clientConfig?.projectId}</p>
                  </div>
                </div>

                {/* Issues */}
                {firebaseStatus.issues && firebaseStatus.issues.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
                    <h4 className="font-semibold mb-2 text-red-700 dark:text-red-400 flex items-center gap-2">
                      <AlertCircle className="size-5" />
                      {locale === "ar" ? "مشاكل مكتشفة" : "Issues Found"}
                    </h4>
                    <ul className="text-sm space-y-1 text-red-600 dark:text-red-400">
                      {firebaseStatus.issues.map((issue: string, i: number) => (
                        <li key={i}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instructions */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4">
                  <h4 className="font-semibold mb-2 text-blue-700 dark:text-blue-400">
                    {locale === "ar" ? "خطوات الحل" : "Solution Steps"}
                  </h4>
                  <ol className="text-sm space-y-1 text-blue-600 dark:text-blue-400 list-decimal list-inside">
                    {(firebaseStatus.instructions?.ar || firebaseStatus.instructions?.en || []).map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
