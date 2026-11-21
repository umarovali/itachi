/**
 * Каталог товаров: синхронизация с Donix /products и расчёт цен в сомах.
 * Цена = цена Donix (USD) × (1 + наценка) × курс KGS, округление вверх до сома.
 */
import { config } from "./config.ts";
import { db, getSetting, nowIso, setSetting, tx } from "./db.ts";
import { donix } from "./donix.ts";
import { gameForSku } from "./games.ts";
import { log } from "./log.ts";
import { getRates } from "./rates.ts";

export interface ProductRow {
  sku: string;
  game: string;
  name: string;
  type: string;
  usd: number;
  price_override_kgs: number | null;
  active: number;
  sort: number;
}

export function getMarkupPercent(): number {
  const v = Number(getSetting("markup_percent"));
  return Number.isFinite(v) && getSetting("markup_percent") !== undefined ? v : config.defaultMarkupPercent;
}

export function setMarkupPercent(percent: number): void {
  setSetting("markup_percent", String(percent));
}

export function priceKgs(
  p: Pick<ProductRow, "usd" | "price_override_kgs">,
  ctx: { markup: number; kgs: number } = { markup: getMarkupPercent(), kgs: getRates().KGS },
): number {
  if (p.price_override_kgs) return p.price_override_kgs;
  return Math.ceil(p.usd * (1 + ctx.markup / 100) * ctx.kgs);
}

/** Тип товара для группировки на сайте — угадываем по названию. */
function guessType(game: string, name: string): string {
  const n = name.toLowerCase();
  if (/(weekly|monthly|pass|pack|набор|welkin|подписк|voucher)/.test(n)) return "voucher";
  if (game === "pubg") return "uc";
  if (game === "roblox") return "robux";
  if (game === "genshin-impact") return "crystal";
  if (game === "standoff-2") return "gold";
  return "diamond";
}

export async function syncProducts(): Promise<{ total: number; added: number; disabled: number }> {
  const remote = await donix.products();
  const now = nowIso();
  return tx(() => {
    const existing = new Set((db.prepare("SELECT sku FROM products").all() as { sku: string }[]).map((r) => r.sku));
    const seen = new Set<string>();
    let added = 0;
    const upsert = db.prepare(`
      INSERT INTO products (sku, game, name, type, usd, active, sort, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(sku) DO UPDATE SET game = excluded.game, name = excluded.name, usd = excluded.usd,
        active = 1, sort = excluded.sort, updated_at = excluded.updated_at`);
    remote.forEach((p, i) => {
      const game = gameForSku(p.sku, p.game);
      if (!game) return; // игра, которую сайт пока не продаёт
      seen.add(p.sku);
      if (!existing.has(p.sku)) added++;
      upsert.run(p.sku, game.slug, p.name, guessType(game.slug, p.name), p.usd, i, now);
    });
    let disabled = 0;
    const off = db.prepare("UPDATE products SET active = 0, updated_at = ? WHERE sku = ? AND active = 1");
    for (const sku of existing) if (!seen.has(sku)) disabled += Number(off.run(now, sku).changes);
    log.info(`catalog synced: ${seen.size} products (+${added} new, ${disabled} disabled)`);
    return { total: seen.size, added, disabled };
  });
}

export function getProduct(sku: string): ProductRow | undefined {
  return db.prepare("SELECT * FROM products WHERE sku = ? AND active = 1").get(sku) as ProductRow | undefined;
}

/** Каталог для сайта — БЕЗ закупочной цены (её покупателям видеть не нужно). */
export function publicCatalog() {
  const rows = db.prepare("SELECT * FROM products WHERE active = 1 ORDER BY game, sort").all() as unknown as ProductRow[];
  const { updatedAt, ...rates } = getRates();
  const ctx = { markup: getMarkupPercent(), kgs: rates.KGS };
  return {
    products: rows.map((p) => ({ sku: p.sku, game: p.game, name: p.name, type: p.type, priceKgs: priceKgs(p, ctx) })),
    rates,
    ratesUpdatedAt: updatedAt,
  };
}
