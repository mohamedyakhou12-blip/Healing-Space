"use client";

import { useEffect } from "react";
import {
  Home,
  BookOpen,
  FileText,
  Headphones,
  PlayCircle,
  FileDown,
  Radio,
  CreditCard,
  User,
  Shield,
  Leaf,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAppStore, type PageName } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface NavItem {
  page: PageName;
  labelKey: string;
  icon: React.ElementType;
  authOnly?: boolean;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { page: "home", labelKey: "nav.home", icon: Home },
  { page: "courses", labelKey: "nav.courses", icon: BookOpen },
  { page: "articles", labelKey: "nav.articles", icon: FileText },
  { page: "podcasts", labelKey: "nav.podcasts", icon: Headphones },
  { page: "videos", labelKey: "nav.videos", icon: PlayCircle },
  { page: "pdfs", labelKey: "nav.pdfs", icon: FileDown },
  { page: "live", labelKey: "nav.live", icon: Radio },
  { page: "coaching", labelKey: "nav.coaching", icon: Sparkles },
];

const secondaryNavItems: NavItem[] = [
  { page: "subscriptions", labelKey: "nav.subscriptions", icon: CreditCard, authOnly: true },
  { page: "profile", labelKey: "nav.profile", icon: User, authOnly: true },
  { page: "admin", labelKey: "nav.admin", icon: Shield, adminOnly: true },
];

function SidebarNav({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const { navigate, currentPage, user, isAdmin } = useAppStore();

  const handleNav = (page: PageName) => {
    navigate(page);
    onNavigate?.();
  };

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.authOnly && !user) return false;
      if (item.adminOnly && !isAdmin) return false;
      return true;
    });

  const visiblePrimaryItems = filterItems(navItems);
  const visibleSecondaryItems = filterItems(secondaryNavItems);

  return (
    <nav className={cn("flex flex-col", className)}>
      <ScrollArea className="flex-1 px-3 py-4">
        {/* Primary navigation */}
        <ul className="space-y-1" role="menubar">
          {visiblePrimaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            return (
              <li key={item.page} role="none">
                <button
                  role="menuitem"
                  onClick={() => handleNav(item.page)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "size-5 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span>{t(item.labelKey)}</span>
                  {/* Active indicator */}
                  {isActive && (
                    <span className="ms-auto size-1.5 rounded-full bg-primary" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Divider + Secondary items */}
        {visibleSecondaryItems.length > 0 && (
          <>
            <Separator className="my-4" />
            <ul className="space-y-1" role="menubar">
              {visibleSecondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.page;
                return (
                  <li key={item.page} role="none">
                    <button
                      role="menuitem"
                      onClick={() => handleNav(item.page)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon
                        className={cn(
                          "size-5 shrink-0 transition-colors",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span>{t(item.labelKey)}</span>
                      {isActive && (
                        <span className="ms-auto size-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </ScrollArea>

      {/* Decorative bottom section */}
      <div className="mt-auto border-t border-border/50 px-4 py-4">
        <div className="mb-2 text-center">
          <p className="text-xs font-semibold text-primary">{t("siteOwner.name")}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary/5 to-accent/10 p-3">
          <Leaf className="size-4 shrink-0 text-primary/60" />
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            &quot;الشفاء يبدأ من الداخل، والنمو لا يتوقف.&quot;
          </p>
        </div>
      </div>
    </nav>
  );
}

/* ── Desktop Sidebar (fixed) ── */
export function SidebarDesktop() {
  return (
    <aside
      className="sidebar hidden lg:flex lg:fixed lg:inset-y-0 lg:start-0 lg:z-40 lg:w-64 lg:flex-col border-e border-border/50 bg-sidebar"
    >
      {/* Spacer for header height (~h-14) */}
      <div className="h-14 shrink-0" />
      <SidebarNav />
    </aside>
  );
}

/* ── Mobile Sidebar (Sheet overlay) ── */
export function SidebarMobile() {
  const { sidebarOpen, setSidebarOpen, locale } = useAppStore();
  const isRtl = locale === "ar";

  // Close sidebar on mount to avoid stale state
  useEffect(() => {
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  return (
    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent
        side={isRtl ? "right" : "left"}
        className="w-72 p-0"
      >
        <SheetHeader className="border-b border-border/50 px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Leaf className="size-4" />
            </div>
            <span className="gradient-text">فضاء الشفاء</span>
          </SheetTitle>
          <SheetDescription className="sr-only">Navigation menu</SheetDescription>
        </SheetHeader>
        <SidebarNav onNavigate={() => setSidebarOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
