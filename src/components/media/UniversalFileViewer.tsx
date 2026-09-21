"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Image as ImageIcon, Music, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UniversalFileViewerProps {
  src: string;
  title: string;
  className?: string;
}

type FileKind = "image" | "video" | "audio" | "pdf" | "office" | "text" | "document";

function getFileKind(src: string): FileKind {
  const cleanSrc = src.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/.test(cleanSrc)) return "image";
  if (/\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/.test(cleanSrc)) return "video";
  if (/\.(mp3|wav|m4a|aac|flac|oga|opus)$/.test(cleanSrc)) return "audio";
  if (/\.pdf$/.test(cleanSrc)) return "pdf";
  if (/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/.test(cleanSrc)) return "office";
  if (/\.(txt|md|csv|tsv|json|xml|log|yaml|yml|ini|conf)$/.test(cleanSrc)) return "text";
  return "document";
}

function TextViewer({ src, title }: { src: string; title: string }) {
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <FileText className="h-14 w-14 text-primary" aria-hidden="true" />
        <p className="max-w-md text-muted-foreground">تعذّر تحميل النص للعرض المباشر.</p>
        <Button asChild>
          <a href={src} download>
            <Download className="me-2 h-4 w-4" /> تنزيل الملف
          </a>
        </Button>
      </div>
    );
  }

  return (
    <pre className="max-h-[75vh] w-full overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-background p-6 text-start text-sm leading-relaxed" dir="auto" aria-label={title}>
      {content || "جارٍ تحميل النص…"}
    </pre>
  );
}

export function UniversalFileViewer({ src, title, className = "" }: UniversalFileViewerProps) {
  const kind = useMemo(() => getFileKind(src), [src]);

  return (
    <section className={`overflow-hidden rounded-2xl border bg-muted/30 ${className}`} aria-label={title}>
      <div className="flex min-h-[22rem] items-center justify-center p-3 sm:p-6">
        {kind === "image" && (
          <img src={src} alt={title} className="max-h-[75vh] w-full rounded-xl object-contain" />
        )}
        {kind === "video" && (
          <video src={src} controls playsInline preload="metadata" className="max-h-[75vh] w-full rounded-xl bg-black" aria-label={title} />
        )}
        {kind === "audio" && (
          <div className="flex w-full max-w-2xl flex-col items-center gap-5 rounded-xl border bg-background p-8 text-center">
            <Music className="h-14 w-14 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold">{title}</h2>
            <audio src={src} controls preload="metadata" className="w-full" aria-label={title} />
          </div>
        )}
        {kind === "pdf" && (
          <iframe src={`${src}#view=FitH`} title={title} className="h-[75vh] w-full rounded-xl bg-background" />
        )}
        {kind === "office" && (
          <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(src)}&embedded=true`} title={title} className="h-[75vh] w-full rounded-xl bg-background" />
        )}
        {kind === "text" && <TextViewer src={src} title={title} />}
        {kind === "document" && (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <FileText className="h-14 w-14 text-primary" aria-hidden="true" />
            <p className="max-w-md text-muted-foreground">هذا النوع من الملفات لا يدعم العرض المباشر في المتصفح (مثل الأرشيفات أو البرامج)، ويمكنك تنزيله وفتحه بالتطبيق المناسب.</p>
            <Button asChild>
              <a href={src} download>
                <Download className="me-2 h-4 w-4" /> تنزيل الملف
              </a>
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 border-t bg-background/70 p-3">
        <Button variant="outline" asChild>
          <a href={src} target="_blank" rel="noreferrer">
            {kind === "image" ? <ImageIcon className="me-2 h-4 w-4" /> : kind === "video" ? <Video className="me-2 h-4 w-4" /> : <FileText className="me-2 h-4 w-4" />}
            فتح في نافذة جديدة
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={src} download>
            <Download className="me-2 h-4 w-4" /> تنزيل
          </a>
        </Button>
      </div>
    </section>
  );
}

export default UniversalFileViewer;
