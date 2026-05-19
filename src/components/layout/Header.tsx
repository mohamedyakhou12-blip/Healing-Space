"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import {
  Leaf,
  Moon,
  Sun,
  Bell,
  Menu,
  Globe,
  LogIn,
  ChevronDown,
  User,
  LogOut,
  Settings,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "@/lib/i18n";
import { useAppStore, type Locale } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const localeOptions: { value: Locale; flag: string; nativeLabel: string }[] = [
  { value: "ar", flag: "🇩🇿", nativeLabel: "العربية" },
  { value: "fr", flag: "🇫🇷", nativeLabel: "Français" },
  { value: "en", flag: "🇬🇧", nativeLabel: "English" },
];

export function Header() {
  const { t, locale, setLocale } = useTranslation();
  const { navigate, setSidebarOpen, user, isAdmin, logout } =
    useAppStore();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(`/api/notifications`);
        if (res.ok) {
          const data = await res.json();
          setUnreadCount((data.notifications as Array<{ isRead: boolean }>)?.filter((n) => !n.isRead).length || 0);
        }
      } catch { /* silent */ }
    })();
  }, [user]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const currentLocaleOption = localeOptions.find((l) => l.value === locale);

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="sticky top-0 z-50 w-full glass-card border-b border-border/50 px-3 py-2 sm:px-4 sm:py-2.5">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* ── Left: Logo + Hamburger ── */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Toggle sidebar"
          >
            <Menu className="size-5" />
          </Button>

          {/* Logo */}
          <button
            onClick={() => navigate("home")}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-9">
              <Leaf className="size-4 sm:size-5" />
            </div>
            <span className="hidden text-base font-bold text-foreground sm:block lg:text-lg">
              {t("home.heroTitle")}
            </span>
            <span className="hidden text-[10px] font-medium text-muted-foreground sm:block lg:text-xs">
              {t("siteOwner.name")}
            </span>
          </button>
        </div>

        {/* ── Right: Actions ── */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Language selector */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden gap-1.5 px-2 text-xs sm:flex"
                  >
                    <Globe className="size-4" />
                    <span className="hidden sm:inline">
                      {currentLocaleOption?.flag}{" "}
                      {currentLocaleOption?.nativeLabel}
                    </span>
                    <ChevronDown className="size-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("common.language")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {localeOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setLocale(opt.value)}
                  className={
                    locale === opt.value
                      ? "bg-primary/10 font-medium text-primary"
                      : ""
                  }
                >
                  <span className="me-2 text-base">{opt.flag}</span>
                  <span>{opt.nativeLabel}</span>
                  {locale === opt.value && (
                    <span className="ms-auto text-primary">&#10003;</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile language selector (just cycle through) */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden shrink-0"
            onClick={() => {
              const idx = localeOptions.findIndex((l) => l.value === locale);
              const next = localeOptions[(idx + 1) % localeOptions.length];
              setLocale(next.value);
            }}
            aria-label={t("common.language")}
          >
            <Globe className="size-5" />
          </Button>

          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={toggleTheme}
                aria-label={
                  mounted
                    ? theme === "dark"
                      ? t("common.lightMode")
                      : t("common.darkMode")
                    : t("common.darkMode")
                }
              >
                {mounted && theme === "dark" ? (
                  <Sun className="size-5 text-healing-gold" />
                ) : (
                  <Moon className="size-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {mounted
                ? theme === "dark"
                  ? t("common.lightMode")
                  : t("common.darkMode")
                : "..."}
            </TooltipContent>
          </Tooltip>

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative shrink-0"
                onClick={() => navigate("notifications")}
                aria-label={t("nav.notifications")}
              >
                <Bell className="size-5" />
                {/* Unread count badge */}
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 end-0 flex size-4 items-center justify-center p-0 text-[10px] font-bold leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("nav.notifications")}</TooltipContent>
          </Tooltip>

          {/* User / Login */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="hidden gap-2 px-2 sm:flex"
                >
                  <Avatar className="size-7 border-2 border-primary/30">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[100px] truncate text-sm font-medium lg:block">
                    {user.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="truncate">
                  {user.name}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("profile")}>
                  <User className="me-2 size-4" />
                  {t("nav.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("subscriptions")}>
                  <Settings className="me-2 size-4" />
                  {t("nav.subscriptions")}
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("admin")}>
                    <Settings className="me-2 size-4" />
                    {t("nav.admin")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={logout}
                >
                  <LogOut className="me-2 size-4" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-xs sm:block"
                onClick={() => navigate("login")}
              >
                {t("nav.login")}
              </Button>
              <Button
                size="sm"
                className="hidden text-xs sm:flex"
                onClick={() => navigate("register")}
              >
                {t("nav.register")}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden shrink-0"
                onClick={() => navigate("login")}
                aria-label={t("nav.login")}
              >
                <LogIn className="size-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
