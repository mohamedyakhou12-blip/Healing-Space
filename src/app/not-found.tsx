import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-secondary to-card px-4 text-center dark:from-background dark:via-secondary dark:to-card">
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-7xl font-extrabold text-transparent">
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
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-8 py-3 text-base font-medium text-white shadow-lg shadow-teal-500/25 transition-shadow hover:shadow-xl hover:shadow-teal-500/30"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
