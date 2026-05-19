"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">حدث خطأ غير متوقع</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || "حدث خطأ أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى."}
        </p>
      </div>
      <Button onClick={reset} className="gap-2">
        <RotateCw className="size-4" />
        إعادة المحاولة
      </Button>
    </div>
  );
}
