import { db, nowIso } from "./db.ts";
import { log } from "./log.ts";

export const CURRENCY_CODES = ["KGS", "RUB", "KZT", "UZS"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];
export type Rates = Record<CurrencyCode, number>;

const FALLBACK: Rates = { KGS: 87.4, RUB: 81, KZT: 505, UZS: 12100 };

export function getRates(): Rates & { updatedAt: string | null } {
  const rows = db.prepare("SELECT code, rate, updated_at FROM rates").all() as { code: string; rate: number; updated_at: string }[];
  const rates: Rates = { ...FALLBACK };
  let updatedAt: string | null = null;
  for (const r of rows) {
    if ((CURRENCY_CODES as readonly string[]).includes(r.code)) rates[r.code as CurrencyCode] = r.rate;
    if (!updatedAt || r.updated_at > updatedAt) updatedAt = r.updated_at;
  }
  return { ...rates, updatedAt };
}

export async function refreshRates(): Promise<void> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(15_000) });
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) throw new Error(`bad response: ${data.result}`);
    const upsert = db.prepare("INSERT INTO rates (code, rate, updated_at) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at");
    const now = nowIso();
    for (const code of CURRENCY_CODES) {
      const rate = data.rates[code];
      if (typeof rate === "number" && rate > 0) upsert.run(code, rate, now);
    }
    log.info("rates updated", getRates());
  } catch (e) {
    log.warn("rates refresh failed, using saved/fallback rates", (e as Error).message);
  }
}
