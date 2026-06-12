import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-50/80 to-white px-4 text-center dark:from-teal-950/30 dark:via-emerald-950/20 dark:to-background">
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 bg-gradient-to-r from-teal-600 via-emerald-500 to-cyan-600 bg-clip-text text-7xl font-extrabold text-transparent">
          404
        </h1>
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          الصفحة غير موجودة
        </h2>
        <p className="mb-8 text-lg text-muted-foreground">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 px-8 py-3 text-base font-medium text-white shadow-lg shadow-teal-500/25 transition-shadow hover:shadow-xl hover:shadow-teal-500/30"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
