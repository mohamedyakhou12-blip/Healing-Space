"use client";

import { useState, useEffect } from "react";
import {
  Leaf,
  Youtube,
  Facebook,
  Instagram,
  Music2,
  Twitter,
  Send,
  Phone,
  Home,
  BookOpen,
  FileText,
  Headphones,
  PlayCircle,
  FileDown,
  Radio,
  Video,
  MessageCircle,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAppStore, type PageName } from "@/lib/store";
import { Separator } from "@/components/ui/separator";

interface FooterLink {
  page: PageName;
  labelKey: string;
  icon: React.ElementType;
}

const footerLinks: FooterLink[] = [
  { page: "home", labelKey: "nav.home", icon: Home },
  { page: "courses", labelKey: "nav.courses", icon: BookOpen },
  { page: "articles", labelKey: "nav.articles", icon: FileText },
  { page: "podcasts", labelKey: "nav.podcasts", icon: Headphones },
  { page: "videos", labelKey: "nav.videos", icon: PlayCircle },
  { page: "pdfs", labelKey: "nav.pdfs", icon: FileDown },
  { page: "live", labelKey: "nav.live", icon: Radio },
];

interface SocialLinkConfig {
  key: string;
  name: string;
  icon: React.ElementType;
}

const socialLinkConfig: SocialLinkConfig[] = [
  { key: "youtube", name: "YouTube", icon: Youtube },
  { key: "facebook", name: "Facebook", icon: Facebook },
  { key: "instagram", name: "Instagram", icon: Instagram },
  { key: "tiktok", name: "TikTok", icon: Music2 },
  { key: "twitter", name: "Twitter", icon: Twitter },
  { key: "telegram", name: "Telegram", icon: Send },
  { key: "whatsapp", name: "WhatsApp", icon: Phone },
  { key: "zoom", name: "Zoom", icon: Video },
];

export function Footer() {
  const { t } = useTranslation();
  const { navigate, locale } = useAppStore();
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  // Fetch social links from admin settings
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public-settings?_t=" + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.socialLinks) {
            try {
              const parsed = JSON.parse(data.settings.socialLinks);
              setSocialLinks(parsed);
            } catch { /* keep defaults */ }
          }
        }
      } catch { /* silent */ }
    })();
  }, []);

  // Filter to only show social links that have been configured
  const activeSocialLinks = socialLinkConfig.filter(
    (s) => socialLinks[s.key] && socialLinks[s.key].trim() !== "" && socialLinks[s.key] !== "#"
  );

  return (
    <footer className="mt-auto border-t border-border/50 bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Top section: Logo + Description + Links */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Leaf className="size-4" />
              </div>
              <span className="text-lg font-bold gradient-text">
                {t("home.heroTitle")}
              </span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("siteOwner.name")} — {t("home.heroSubtitle")}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              {t("home.viewAll")}
            </h4>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
              {footerLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.page}>
                    <button
                      onClick={() => navigate(link.page)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span>{t(link.labelKey)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Social Media */}
          <div className="sm:col-span-2 lg:col-span-1">
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              {locale === "ar" ? "وسائل التواصل الاجتماعي" : locale === "fr" ? "Réseaux sociaux" : "Social Media"}
            </h4>
            {activeSocialLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeSocialLinks.map((social) => {
                  const Icon = social.icon;
                  const href = socialLinks[social.key];
                  return (
                    <a
                      key={social.key}
                      href={href}
                      aria-label={social.name}
                      className="flex size-10 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon className="size-4" />
                    </a>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {locale === "ar" ? "لم يتم إضافة روابط التواصل بعد" : locale === "fr" ? "Aucun lien social ajouté" : "No social links added yet"}
              </p>
            )}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Copyright */}
        <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-start">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {t("home.heroTitle")} — {t("siteOwner.name")}. All rights reserved.
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground/70">
            <Leaf className="size-3 text-primary/40" />
            Made with care for your wellbeing
          </p>
        </div>
      </div>
    </footer>
  );
}
