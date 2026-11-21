/**
 * Клиент партнёрского API Donix.
 *
 * Формат запросов/ответов взят со страницы donix.org/api (кратко). Точные названия полей
 * ПРОВЕРЬТЕ по документации в кабинете — разбор ответов сделан «мягко» и принимает
 * несколько вариантов названий, но запросы (validate/order) могут потребовать правки.
 */
import { config } from "./config.ts";
import { DonixError } from "./donix-error.ts";
import { mockDonix } from "./donix-mock.ts";

export { DonixError };

export type DonixOrderStatus = "processing" | "completed" | "failed" | "refunded";

export interface DonixProduct {
  sku: string;
  name: string;
  usd: number;
  game?: string;
}

export interface DonixValidateResult {
  ok: boolean;
  nickname?: string;
  error?: string;
}

export interface DonixOrder {
  orderId: string;
  status: DonixOrderStatus;
  priceUsd?: number;
}

export interface DonixOrderInput {
  externalId: string;
  sku: string;
  uid: string;
  server?: string;
}

export interface DonixClient {
  ping(): Promise<boolean>;
  balance(): Promise<{ amount: number; currency: string }>;
  products(): Promise<DonixProduct[]>;
  validate(sku: string, uid: string, server?: string): Promise<DonixValidateResult>;
  createOrder(input: DonixOrderInput): Promise<DonixOrder>;
  getOrder(orderId: string): Promise<DonixOrder>;
}

type Json = Record<string, unknown>;
const asObj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const pickStr = (o: Json, ...keys: string[]): string | undefined => {
  for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  for (const k of keys) if (typeof o[k] === "number") return String(o[k]);
  return undefined;
};
const pickNum = (o: Json, ...keys: string[]): number | undefined => {
  for (const k of keys) {
    const n = Number(o[k]);
    if (o[k] !== undefined && o[k] !== null && o[k] !== "" && Number.isFinite(n)) return n;
  }
  return undefined;
};
/** Ответ может быть {data: …}, {products: […]} или сразу массивом. */
const unwrap = (v: unknown): unknown => {
  const o = asObj(v);
  return o.data !== undefined ? o.data : v;
};

const STATUSES: DonixOrderStatus[] = ["processing", "completed", "failed", "refunded"];
export const toStatus = (v: unknown): DonixOrderStatus => (STATUSES.includes(v as DonixOrderStatus) ? (v as DonixOrderStatus) : "processing");

function parseOrder(raw: unknown): DonixOrder {
  const o = asObj(unwrap(raw));
  const nested = asObj(o.order);
  const src = Object.keys(nested).length ? nested : o;
  return {
    orderId: pickStr(src, "order_id", "id", "orderId") ?? "",
    status: toStatus(src.status),
    priceUsd: pickNum(src, "price", "amount", "cost"),
  };
}

class HttpDonix implements DonixClient {
  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const res = await fetch(`${config.donix.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.donix.apiKey}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const o = asObj(data);
      const code = pickStr(o, "error", "code") ?? pickStr(asObj(o.error), "code") ?? (res.status === 401 ? "unauthorized" : `http_${res.status}`);
      throw new DonixError(code, res.status, pickStr(o, "message") ?? code);
    }
    return data;
  }

  async ping() {
    await this.call("GET", "/ping");
    return true;
  }

  async balance() {
    const o = asObj(unwrap(await this.call("GET", "/balance")));
    return { amount: pickNum(o, "balance", "amount") ?? 0, currency: pickStr(o, "currency") ?? "USD" };
  }

  async products() {
    const data = unwrap(await this.call("GET", "/products"));
    const list = Array.isArray(data) ? data : (asObj(data).products as unknown[]) ?? [];
    return list
      .map((item): DonixProduct | null => {
        const o = asObj(item);
        const sku = pickStr(o, "sku", "id");
        const usd = pickNum(o, "price", "partner_price", "cost");
        if (!sku || usd === undefined) return null;
        return { sku, name: pickStr(o, "name", "title") ?? sku, usd, game: pickStr(o, "game", "game_slug", "category") };
      })
      .filter((p): p is DonixProduct => p !== null);
  }

  async validate(sku: string, uid: string, server?: string) {
    try {
      const o = asObj(unwrap(await this.call("POST", "/validate", { sku, uid, ...(server ? { server, zone: server } : {}) })));
      const valid = o.valid ?? o.ok ?? o.success ?? true;
      return valid
        ? { ok: true, nickname: pickStr(o, "nickname", "name", "player_name", "username") }
        : { ok: false, error: "invalid_uid" };
    } catch (e) {
      if (e instanceof DonixError && e.code === "invalid_uid") return { ok: false, error: "invalid_uid" };
      throw e;
    }
  }

  async createOrder(input: DonixOrderInput) {
    const raw = await this.call("POST", "/order", {
      external_id: input.externalId,
      sku: input.sku,
      uid: input.uid,
      ...(input.server ? { server: input.server, zone: input.server } : {}),
    });
    return parseOrder(raw);
  }

  async getOrder(orderId: string) {
    return parseOrder(await this.call("GET", `/order/${encodeURIComponent(orderId)}`));
  }
}

export const donix: DonixClient = config.donix.mock ? mockDonix : new HttpDonix();
