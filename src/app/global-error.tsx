"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: "1.5rem",
            padding: "1.5rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            background: "#f9fafb",
            color: "#111827",
          }}
        >
          <div style={{ fontSize: "3rem" }}>⚠️</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            حدث خطأ في التطبيق
          </h2>
          <p style={{ color: "#6b7280", maxWidth: "28rem", fontSize: "0.875rem" }}>
            {error.message || "خطأ غير متوقع. يرجى تحديث الصفحة."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.5rem",
              borderRadius: "0.5rem",
              background: "#0d9488",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: "500",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
