import ar from "./ar";
import fr from "./fr";
import en from "./en";

export const translations = { ar, fr, en } as const;

export type TranslationSections = (typeof translations)["ar"];

export type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<TranslationSections>;

export type Locale = "ar" | "fr" | "en";

export { ar, fr, en };
export type { default as Ar } from "./ar";
export type { default as Fr } from "./fr";
export type { default as En } from "./en";
