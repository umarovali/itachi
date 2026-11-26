import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en } from "../i18n/en";
import { ky } from "../i18n/ky";
import { ru } from "../i18n/ru";
import { uz } from "../i18n/uz";

export type Lang = "ru" | "ky" | "uz" | "en";

export const LANGS: Array<{ code: Lang; short: string; native: string; locale: string }> = [
  { code: "ru", short: "RU", native: "Русский", locale: "ru-RU" },
  { code: "ky", short: "KY", native: "Кыргызча", locale: "ky-KG" },
  { code: "uz", short: "UZ", native: "O'zbekcha", locale: "uz-UZ" },
  { code: "en", short: "EN", native: "English", locale: "en-GB" },
];

const DICTS: Record<Lang, Record<string, string>> = { ru, ky, uz, en };
const KEY = "faapay.lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && saved in DICTS) return saved as Lang;
  } catch { /* ignore */ }
  // Основная аудитория — Кыргызстан: по умолчанию русский, свой язык определяем по браузеру
  const prefs = typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  for (const p of prefs) {
    const c = p.slice(0, 2).toLowerCase();
    if (c === "ky" || c === "uz") return c;
    if (c === "ru") return "ru";
  }
  return "ru";
}

let current: Lang = detect();

function fill(s: string, params?: Record<string, string | number>) {
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : s;
}

/** Перевод по ключу (можно вызывать и вне компонентов, например в api.ts) */
export function tr(key: string, params?: Record<string, string | number>): string {
  return fill(DICTS[current][key] ?? ru[key] ?? key, params);
}

/** Перевод текста из данных игр: ключом служит исходный русский текст */
export function trText(text: string): string {
  const m = /^Например: (.+)$/.exec(text);
  if (m) return tr("ph.example", { v: m[1] });
  return DICTS[current][text] ?? text;
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof tr;
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    current = l;
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: tr, locale: LANGS.find((x) => x.code === lang)!.locale }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n вне I18nProvider");
  return ctx;
}
