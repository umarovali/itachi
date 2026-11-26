import { tr } from "./i18n";
export type CurrencyCode = "KGS" | "RUB" | "KZT" | "UZS";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  roundStep: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  KGS: { code: "KGS", symbol: "сом", name: "Сом", roundStep: 1 },
  RUB: { code: "RUB", symbol: "₽", name: "Рубль", roundStep: 1 },
  KZT: { code: "KZT", symbol: "₸", name: "Тенге", roundStep: 10 },
  UZS: { code: "UZS", symbol: "сум", name: "Сум", roundStep: 100 },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);
export const DEFAULT_CURRENCY: CurrencyCode = "KGS";

export type Rates = Record<CurrencyCode, number>;

export const PAY_CURRENCY: CurrencyCode = "KGS";

export function somToDisplay(som: number, code: CurrencyCode, rates: Rates): number {
  if (code === PAY_CURRENCY) return som;
  const step = CURRENCIES[code].roundStep;
  return Math.round((som / rates.KGS) * rates[code] / step) * step;
}

export function formatDisplay(som: number, code: CurrencyCode, rates: Rates): string {
  const text = formatMoney(somToDisplay(som, code, rates), code);
  return code === PAY_CURRENCY ? text : `≈ ${text}`;
}

export function formatMoney(amount: number, code: CurrencyCode): string {
  return `${amount.toLocaleString("ru-RU")} ${tr(`cur.sym.${code}`)}`;
}

const TZ_PREFIX_TO_CURRENCY: Array<[string[], CurrencyCode]> = [
  [["Asia/Bishkek"], "KGS"],
  [["Asia/Almaty", "Asia/Qostanay", "Asia/Aqtobe", "Asia/Aqtau", "Asia/Atyrau", "Asia/Oral", "Asia/Qyzylorda"], "KZT"],
  [["Asia/Tashkent", "Asia/Samarkand"], "UZS"],
  [
    [
      "Europe/Moscow", "Europe/Kaliningrad", "Europe/Samara", "Europe/Volgograd", "Europe/Saratov",
      "Europe/Ulyanovsk", "Europe/Astrakhan", "Europe/Kirov", "Asia/Yekaterinburg", "Asia/Omsk",
      "Asia/Novosibirsk", "Asia/Barnaul", "Asia/Tomsk", "Asia/Novokuznetsk", "Asia/Krasnoyarsk",
      "Asia/Irkutsk", "Asia/Chita", "Asia/Yakutsk", "Asia/Khandyga", "Asia/Vladivostok", "Asia/Ust-Nera",
      "Asia/Magadan", "Asia/Sakhalin", "Asia/Srednekolymsk", "Asia/Kamchatka", "Asia/Anadyr",
    ],
    "RUB",
  ],
];

export function detectCurrency(): CurrencyCode {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return DEFAULT_CURRENCY;
  }
  for (const [zones, code] of TZ_PREFIX_TO_CURRENCY) {
    if (zones.includes(tz)) return code;
  }
  return DEFAULT_CURRENCY;
}

const STORAGE_KEY = "itachi.currency";

export function loadSavedCurrency(): CurrencyCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v in CURRENCIES ? (v as CurrencyCode) : null;
  } catch {
    return null;
  }
}

export function saveCurrency(code: CurrencyCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {}
}
