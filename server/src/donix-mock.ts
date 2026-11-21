/**
 * ТЕСТОВЫЙ Donix — работает, пока в .env нет DONIX_API_KEY.
 * Ничего никуда не отправляет: заказы «выполняются» через 5 секунд и присылают
 * себе вебхук, как настоящий Donix. Если UID оканчивается на 0 — заказ «failed».
 */
import type { DonixClient, DonixOrder, DonixProduct } from "./donix.ts";
import { DonixError } from "./donix-error.ts";

const PRODUCTS: DonixProduct[] = [
  { sku: "freefire-110", name: "110 💎", usd: 0.85 },
  { sku: "freefire-341", name: "341 💎", usd: 2.45 },
  { sku: "freefire-572", name: "572 💎", usd: 3.95 },
  { sku: "freefire-1166", name: "1166 💎", usd: 7.9 },
  { sku: "freefire-2398", name: "2398 💎", usd: 15.3 },
  { sku: "freefire-6160", name: "6160 💎", usd: 38.4 },
  { sku: "freefire-weekly-lite", name: "Weekly Lite", usd: 0.4 },
  { sku: "freefire-weekly", name: "Weekly Voucher", usd: 1.65 },
  { sku: "freefire-monthly", name: "Monthly Voucher", usd: 6.2 },

  { sku: "pubg-60", name: "60 UC", usd: 0.95 },
  { sku: "pubg-325", name: "325 UC", usd: 4.6 },
  { sku: "pubg-660", name: "660 UC", usd: 9.1 },
  { sku: "pubg-1800", name: "1800 UC", usd: 23 },
  { sku: "pubg-3850", name: "3850 UC", usd: 46 },
  { sku: "pubg-weekly-1", name: "Weekly Deal Pack 1", usd: 0.97 },

  { sku: "ml-55", name: "55 алмазов", usd: 0.82 },
  { sku: "ml-165", name: "165 алмазов", usd: 2.4 },
  { sku: "ml-275", name: "275 алмазов", usd: 3.9 },
  { sku: "ml-565", name: "565 алмазов", usd: 7.8 },
  { sku: "ml-1155", name: "1155 алмазов", usd: 15.6 },
  { sku: "ml-weekly", name: "Weekly Diamond Pass", usd: 1.45 },

  { sku: "roblox-50", name: "50 Robux", usd: 1.08 },
  { sku: "roblox-100", name: "100 Robux", usd: 1.95 },
  { sku: "roblox-400", name: "400 Robux", usd: 5.4 },
  { sku: "roblox-800", name: "800 Robux", usd: 10.2 },
  { sku: "roblox-1700", name: "1700 Robux", usd: 20.5 },

  { sku: "genshin-60", name: "60 кристаллов", usd: 1.0 },
  { sku: "genshin-330", name: "330 кристаллов", usd: 4.9 },
  { sku: "genshin-1090", name: "1090 кристаллов", usd: 14.8 },
  { sku: "genshin-2240", name: "2240 кристаллов", usd: 29.5 },
  { sku: "genshin-welkin", name: "Welkin Moon", usd: 4.9 },

  { sku: "standoff-100", name: "100 Gold", usd: 1.1 },
  { sku: "standoff-500", name: "500 Gold", usd: 5.2 },
  { sku: "standoff-1000", name: "1000 Gold", usd: 10.1 },
  { sku: "standoff-3000", name: "3000 Gold", usd: 29 },
];

let balanceUsd = 50;
const orders = new Map<string, DonixOrder & { externalId: string }>();

/** Куда мок «шлёт вебхук» — подключается в index.ts. */
let onWebhook: ((body: { event: string; order_id: string; external_id: string; status: string; price: string; currency: string }) => void) | null = null;
export const setMockWebhookHandler = (fn: typeof onWebhook) => {
  onWebhook = fn;
};

export const mockDonix: DonixClient = {
  async ping() {
    return true;
  },
  async balance() {
    return { amount: Math.round(balanceUsd * 100) / 100, currency: "USD" };
  },
  async products() {
    return PRODUCTS;
  },
  async validate(_sku, uid) {
    await new Promise((r) => setTimeout(r, 400));
    if (!/^[A-Za-z0-9_#.-]{4,}$/.test(uid.trim())) return { ok: false, error: "invalid_uid" };
    return { ok: true, nickname: /^\d+$/.test(uid) ? `Player_${uid.slice(-4)}` : uid };
  },
  async createOrder(input) {
    const product = PRODUCTS.find((p) => p.sku === input.sku);
    if (!product) throw new DonixError("product_not_found", 404);
    if (balanceUsd < product.usd) throw new DonixError("insufficient_balance", 402);
    balanceUsd -= product.usd;
    const orderId = crypto.randomUUID();
    const order = { orderId, status: "processing" as const, priceUsd: product.usd, externalId: input.externalId };
    orders.set(orderId, order);
    setTimeout(() => {
      const failed = input.uid.trim().endsWith("0");
      const status = failed ? "failed" : "completed";
      if (failed) balanceUsd += product.usd;
      orders.set(orderId, { ...order, status });
      onWebhook?.({
        event: `order.${status}`,
        order_id: orderId,
        external_id: input.externalId,
        status,
        price: String(product.usd),
        currency: "USD",
      });
    }, 5000);
    return { orderId, status: "processing", priceUsd: product.usd };
  },
  async getOrder(orderId) {
    const o = orders.get(orderId);
    if (!o) throw new DonixError("order_not_found", 404);
    return { orderId: o.orderId, status: o.status, priceUsd: o.priceUsd };
  },
};
