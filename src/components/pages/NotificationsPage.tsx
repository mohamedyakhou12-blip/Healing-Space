"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  BookOpen,
  Video,
  Headphones,
  FileText,
  Radio,
  Check,
  Circle,
  Info,
  Users,
  Loader2,
} from "lucide-react";

type NotificationType = "info" | "success" | "warning" | "payment";

interface Notification {
  id: string;
  type: string;
  title: string;
  titleAr?: string;
  titleFr?: string;
  titleEn?: string;
  message: string;
  messageAr?: string;
  messageFr?: string;
  messageEn?: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  userId: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  payment: CreditCard,
  content: BookOpen,
  social: Users,
};

const gradientMap: Record<string, string> = {
  info: "from-cyan-400 to-teal-500",
  success: "from-emerald-400 to-green-500",
  warning: "from-amber-400 to-orange-500",
  payment: "from-violet-400 to-purple-500",
  content: "from-rose-400 to-pink-500",
  social: "from-sky-400 to-blue-500",
};

function getLocalizedField(obj: Record<string, any> | undefined, field: string, locale: string, fallback: string): string {
  if (!obj) return fallback;
  return obj[`${field}${locale.charAt(0).toUpperCase() + locale.slice(1)}`]
    || obj[field]
    || fallback;
}

function formatRelativeTime(dateStr: string, locale: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (locale === "ar") {
      if (diffMins < 1) return "الآن";
      if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      if (diffDays < 7) return `منذ ${diffDays} يوم`;
      if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسبوع`;
      return date.toLocaleDateString("ar-DZ");
    } else if (locale === "fr") {
      if (diffMins < 1) return "À l'instant";
      if (diffMins < 60) return `Il y a ${diffMins} min`;
      if (diffHours < 24) return `Il y a ${diffHours}h`;
      if (diffDays < 7) return `Il y a ${diffDays}j`;
      return date.toLocaleDateString("fr-FR");
    } else {
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString("en-US");
    }
  } catch {
    return "";
  }
}

export default function NotificationsPage() {
  const { t, locale, dir } = useTranslation();
  const { user, navigate } = useAppStore();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/notifications?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications((data.notifications || []) as Notification[]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch {
      // silent
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read locally
    if (!notification.isRead) {
      fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notification.id] }),
      }).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }
    // Navigate if link exists
    if (notification.link) {
      const pageMap: Record<string, "courses" | "articles" | "podcasts" | "videos" | "pdfs" | "live" | "subscriptions" | "payment"> = {
        courses: "courses",
        articles: "articles",
        podcasts: "podcasts",
        videos: "videos",
        pdfs: "pdfs",
        live: "live",
        subscriptions: "subscriptions",
        payments: "payment",
      };
      const page = pageMap[notification.link];
      if (page) {
        navigate(page);
      }
    }
  };

  return (
    <motion.div
      dir={dir}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-4 md:p-6 lg:p-8 max-w-3xl mx-auto"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold">{t("notifications.title")}</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {unreadCount} {locale === "ar" ? "إشعار غير مقروء" : locale === "fr" ? "notification(s) non lue(s)" : "unread notification(s)"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex rounded-lg border overflow-hidden">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
              className="rounded-none"
            >
              {t("common.all")}
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("unread")}
              className="rounded-none gap-1.5"
            >
              <Circle className="h-2 w-2 fill-current" />
              {locale === "ar" ? "غير مقروء" : locale === "fr" ? "Non lues" : "Unread"}
            </Button>
          </div>

          {/* Mark All Read */}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="gap-2"
            >
              {markingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center py-16"
          >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </motion.div>
        ) : filteredNotifications.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16 space-y-4"
          >
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Bell className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-medium text-muted-foreground">
                {t("notifications.noNotifications")}
              </p>
              <p className="text-sm text-muted-foreground/70">
                {locale === "ar"
                  ? "ستظهر هنا الإشعارات الجديدة عند توفرها"
                  : locale === "fr"
                    ? "Les nouvelles notifications apparaîtront ici"
                    : "New notifications will appear here"}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {filteredNotifications.map((notification, index) => {
              const Icon = iconMap[notification.type] || Bell;
              const gradient = gradientMap[notification.type] || gradientMap.info;

              const title = notification[`title${locale.charAt(0).toUpperCase() + locale.slice(1)}`]
                || notification.title
                || "";
              const message = notification[`message${locale.charAt(0).toUpperCase() + locale.slice(1)}`]
                || notification.message
                || "";
              const timeStr = formatRelativeTime(notification.createdAt, locale);

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: notification.isRead ? 0 : -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    className={`cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-md ${
                      !notification.isRead ? "border-primary/20 bg-primary/[0.02]" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-3 sm:gap-4">
                        {/* Icon */}
                        <div className="shrink-0">
                          <div
                            className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}
                          >
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`text-sm leading-snug ${!notification.isRead ? "font-semibold" : "font-medium"}`}>
                              {title}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {timeStr}
                              </span>
                              {!notification.isRead && (
                                <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                          </div>
                          {message && (
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                              {message}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
