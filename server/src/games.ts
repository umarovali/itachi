/**
 * Игры, которые продаёт сайт, и как распознать их товары в каталоге Donix.
 * Должно совпадать со slug'ами в web/src/data/games.ts.
 */
export interface GameDef {
  slug: string;
  title: string;
  /** Начала SKU в Donix, по которым товар относится к игре (сверить с /products). */
  skuPrefixes: string[];
  /** Ключи полей, которые сайт присылает для игрока. */
  fields: string[];
}

export const GAMES: GameDef[] = [
  { slug: "free-fire", title: "Free Fire", skuPrefixes: ["freefire", "free-fire", "ff-"], fields: ["uid"] },
  { slug: "pubg", title: "PUBG Mobile", skuPrefixes: ["pubg"], fields: ["uid"] },
  { slug: "mobile-legends", title: "Mobile Legends", skuPrefixes: ["ml-", "mlbb", "mobile-legends", "mobilelegends"], fields: ["uid", "server"] },
  { slug: "roblox", title: "Roblox", skuPrefixes: ["roblox"], fields: ["uid"] },
  { slug: "genshin-impact", title: "Genshin Impact", skuPrefixes: ["genshin"], fields: ["uid", "server"] },
  { slug: "standoff-2", title: "Standoff 2", skuPrefixes: ["standoff", "so2"], fields: ["uid"] },
];

export const gameBySlug = (slug: string): GameDef | undefined => GAMES.find((g) => g.slug === slug);

export function gameForSku(sku: string, donixGame?: string): GameDef | undefined {
  const s = sku.toLowerCase();
  const g = (donixGame ?? "").toLowerCase().replace(/[\s_]/g, "-");
  return GAMES.find((def) => def.slug === g || def.skuPrefixes.some((p) => s.startsWith(p)));
}
