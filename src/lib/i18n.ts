"use client";

import { useCallback, useMemo } from "react";
import { translations, type Locale } from "@/lib/translations";
import { useAppStore } from "@/lib/store";

/**
 * Returns the text direction for a given locale.
 */
export function getDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Deeply resolves a dot-separated key path against a nested object.
 * Falls back to the key itself if not found.
 */
function resolveTranslation(
  obj: Record<string, unknown>,
  keyPath: string
): string {
  const keys = keyPath.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      // Key not found — return the raw key path as a fallback so devs can spot missing translations
      return keyPath;
    }
  }

  return typeof current === "string" ? current : keyPath;
}

/**
 * React hook that provides translation utilities.
 *
 * Usage:
 *   const { t, locale, setLocale, dir } = useTranslation();
 *   const label = t("nav.home");  // → "الرئيسية" when locale is "ar"
 */
export function useTranslation() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const dir = useMemo(() => getDirection(locale), [locale]);

  const t = useCallback(
    (key: string): string => {
      const dictionary = translations[locale];
      return resolveTranslation(
        dictionary as unknown as Record<string, unknown>,
        key
      );
    },
    [locale]
  );

  return {
    t,
    locale,
    setLocale,
    dir,
  } as const;
}

// Re-export for convenience
export { translations };
export type { Locale };
