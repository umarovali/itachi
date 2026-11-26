import { tr } from "./i18n";
import type { CurrencyCode, Rates } from "./currency";

export interface Product {
  sku: string;
  game: string;
  name: string;
  type: string;
  priceKgs: number;
  note?: string;
}

export interface Catalog {
  products: Product[];
  rates: Rates;
}

export interface ValidateResult {
  ok: boolean;
  nickname?: string | null;
  error?: string;
}

export interface PromoResult {
  ok: boolean;
  discountPercent?: number;
  error?: string;
}

export interface CreateOrderInput {
  game: string;
  sku: string;
  fields: Record<string, string>;
  telegram: string;
  displayCurrency: CurrencyCode;
  promoCode?: string;
}

export type OrderStatus = "awaiting_payment" | "payment_check" | "processing" | "completed" | "problem" | "refunded" | "rejected" | "expired";

export interface Order {
  id: string;
  status: OrderStatus;
  game: string;
  productName: string;
  fields: Record<string, string>;
  nickname: string | null;
  amount: number;
  basePrice: number;
  discountPercent: number;
  displayCurrency: CurrencyCode;
  createdAt: string;
  expiresAt: string;
  hasReceipt: boolean;
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init?.method ?? "GET",
      headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new Error(tr("net.error"));
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(data?.error ?? tr("srv.error", { n: res.status }));
  return data as T;
}

export const api = {
  catalog: () => request<Catalog>("/catalog"),
  validatePlayer: (game: string, sku: string, fields: Record<string, string>) =>
    request<ValidateResult>("/validate", { method: "POST", body: { game, sku, fields } }),
  checkPromo: (code: string) => request<PromoResult>("/promo/check", { method: "POST", body: { code } }),
  createOrder: (input: CreateOrderInput) => request<Order>("/orders", { method: "POST", body: input }),
  getOrder: (id: string) => request<Order>(`/orders/${encodeURIComponent(id)}`),
  markPaid: (id: string, senderName: string, method: string) =>
    request<Order>(`/orders/${encodeURIComponent(id)}/paid`, { method: "POST", body: { senderName, method } }),
  async uploadReceipt(id: string, image: Blob): Promise<Order> {
    let res: Response;
    try {
      res = await fetch(`/api/orders/${encodeURIComponent(id)}/receipt`, {
        method: "POST",
        headers: { "Content-Type": image.type || "image/jpeg" },
        body: image,
      });
    } catch {
      throw new Error(tr("net.upload"));
    }
    const data = (await res.json().catch(() => null)) as (Order & { error?: string }) | null;
    if (!res.ok) throw new Error(data?.error ?? tr("upload.fail", { n: res.status }));
    return data as Order;
  },
  cancelOrder: (id: string) => request<Order>(`/orders/${encodeURIComponent(id)}/cancel`, { method: "POST", body: {} }),
};
