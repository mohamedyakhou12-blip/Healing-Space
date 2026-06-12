/**
 * @deprecated This store is NOT used by the main app.
 * The app uses `useAppStore().locale` and `useAppStore().setLocale()` instead.
 * This file only exists for backward compatibility with any legacy components.
 * All new code should use `useAppStore` from `@/lib/store`.
 */

import { create } from 'zustand';

export type Language = 'ar' | 'fr' | 'en';

interface LangState {
  language: Language;
  dir: 'rtl' | 'ltr';
  setLanguage: (lang: Language) => void;
}

export const useLangStore = create<LangState>((set) => ({
  language: 'ar',
  dir: 'rtl',
  setLanguage: (language) =>
    set({
      language,
      dir: language === 'ar' ? 'rtl' : 'ltr',
    }),
}));
