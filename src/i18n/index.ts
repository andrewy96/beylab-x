import en from "./en.json";
import zh from "./zh.json";

export const locales = ["en", "zh"] as const;
export type Locale = (typeof locales)[number];

export type Dict = typeof en;

const dicts: Record<Locale, Dict> = { en, zh };

export function isLocale(v: string): v is Locale {
  return (locales as readonly string[]).includes(v);
}

export function getDict(locale: Locale): Dict {
  return dicts[locale] ?? dicts.en;
}

/** Swap the locale segment of a pathname, keeping the rest. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const parts = pathname.split("/");
  if (parts.length > 1 && isLocale(parts[1])) parts[1] = target;
  else parts.splice(1, 0, target);
  return parts.join("/") || "/";
}
