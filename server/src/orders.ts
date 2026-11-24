import { randomInt } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getProduct, priceKgs } from "./catalog.ts";
import { config } from "./config.ts";
import { db, nowIso, tx } from "./db.ts";
import { donix, DonixError, type DonixOrderStatus } from "./donix.ts";
import { gameBySlug } from "./games.ts";
import { log } from "./log.ts";
import { CURRENCY_CODES, type CurrencyCode } from "./rates.ts";

export type OrderStatus =
  | "awaiting_payment"
  | "payment_check"
  | "confirmed"
  | "sending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded"
  | "customer_refunded"
  | "rejected"
  | "expired";

export interface Order {
  id: string;
  status: OrderStatus;
  game: string;
  sku: string;
  product_name: string;
  fields: Record<string, string>;
  nickname: string | null;
  telegram: string;
  display_currency: CurrencyCode;
  base_price: number;
  discount_percent: number;
  promo_code: string | null;
  amount: number;
  cost_usd: number;
  sender_name: string | null;
  pay_method: string | null;
  receipt_path: string | null;
  donix_order_id: string | null;
  error: string | null;
  tg_messages: { chatId: number; messageId: number }[];
  reminded: number;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  confirmed_at: string | null;
  finished_at: string | null;
}

export class UserError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type OrderEvent =
  | { kind: "paid"; order: Order }
  | { kind: "changed"; order: Order }
  | { kind: "donix_error"; order: Order; code: string };

export const orderEvents = new EventEmitter<{ event: [OrderEvent] }>();
const emit = (e: OrderEvent) => orderEvents.emit("event", e);

type Row = Omit<Order, "fields" | "tg_messages"> & { fields: string; tg_messages: string };
const fromRow = (r: Row): Order => ({ ...r, fields: JSON.parse(r.fields), tg_messages: JSON.parse(r.tg_messages) });

export function getOrder(id: string): Order | undefined {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Row | undefined;
  return row ? fromRow(row) : undefined;
}

export function listOrders(statuses: OrderStatus[], limit = 20): Order[] {
  const marks = statuses.map(() => "?").join(",");
  return (db.prepare(`SELECT * FROM orders WHERE status IN (${marks}) ORDER BY created_at DESC LIMIT ?`).all(...statuses, limit) as unknown as Row[]).map(fromRow);
}

export function saveTgMessages(id: string, messages: Order["tg_messages"]): void {
  db.prepare("UPDATE orders SET tg_messages = ? WHERE id = ?").run(JSON.stringify(messages), id);
}

function transition(id: string, from: OrderStatus[], to: OrderStatus, extra: Record<string, string | number | null> = {}): Order | undefined {
  const sets = ["status = ?", ...Object.keys(extra).map((k) => `${k} = ?`)].join(", ");
  const marks = from.map(() => "?").join(",");
  const res = db.prepare(`UPDATE orders SET ${sets} WHERE id = ? AND status IN (${marks})`).run(to, ...Object.values(extra), id, ...from);
  return res.changes ? getOrder(id) : undefined;
}

const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newId = () => Array.from({ length: 6 }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join("");

export interface CreateOrderInput {
  game: string;
  sku: string;
  fields: Record<string, string>;
  telegram: string;
  displayCurrency: string;
  promoCode?: string;
}

export function checkPromo(code: string): { percent: number } | null {
  const row = db.prepare("SELECT percent, max_uses, used FROM promo_codes WHERE code = ? AND active = 1").get(code.trim().toUpperCase()) as
    | { percent: number; max_uses: number | null; used: number }
    | undefined;
  if (!row || (row.max_uses !== null && row.used >= row.max_uses)) return null;
  return { percent: row.percent };
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const game = gameBySlug(input.game);
  if (!game) throw new UserError("Игра не найдена");
  const product = getProduct(input.sku);
  if (!product || product.game !== game.slug) throw new UserError("Товар не найден или больше недоступен");

  const fields: Record<string, string> = {};
  for (const key of game.fields) {
    const v = String(input.fields[key] ?? "").trim();
    if (!v || v.length > 64) throw new UserError("Заполни данные игрока");
    fields[key] = v;
  }
  const telegram = input.telegram.trim();
  if (!/^@[A-Za-z0-9_]{5,32}$/.test(telegram)) throw new UserError("Укажи Telegram в формате @username");
  const displayCurrency = (CURRENCY_CODES as readonly string[]).includes(input.displayCurrency) ? (input.displayCurrency as CurrencyCode) : "KGS";

  const check = await donix.validate(product.sku, fields.uid, fields.server);
  if (!check.ok) throw new UserError("Игровой ID не прошёл проверку. Проверь, правильно ли он введён.");

  const promoCode = input.promoCode?.trim().toUpperCase() || null;
  const promo = promoCode ? checkPromo(promoCode) : null;
  if (promoCode && !promo) throw new UserError("Промокод не найден или уже использован");

  const base = priceKgs(product);
  const discountPercent = promo?.percent ?? 0;
  const discounted = Math.max(1, Math.round(base * (1 - discountPercent / 100)));
  const now = new Date();

  const amount = discounted;

  const order = tx(() => {
    let id = newId();
    while (db.prepare("SELECT 1 FROM orders WHERE id = ?").get(id)) id = newId();

    db.prepare(`
      INSERT INTO orders (id, status, game, sku, product_name, fields, nickname, telegram, display_currency,
        base_price, discount_percent, promo_code, amount, cost_usd, created_at, expires_at)
      VALUES (?, 'awaiting_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, game.slug, product.sku, product.name, JSON.stringify(fields), check.nickname ?? null, telegram, displayCurrency,
      base, discountPercent, promo ? promoCode : null, amount, product.usd, now.toISOString(),
      new Date(now.getTime() + config.orderTtlMinutes * 60_000).toISOString(),
    );
    return getOrder(id)!;
  });
  log.info(`order ${order.id} created: ${order.product_name} → ${order.amount} сом`);
  return order;
}

export const RECEIPTS_DIR = join(dirname(config.dbPath), "receipts");
mkdirSync(RECEIPTS_DIR, { recursive: true });

export type ReceiptExt = "jpg" | "png" | "webp" | "pdf";

export function detectReceipt(buf: Buffer): ReceiptExt | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length > 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  return null;
}

export const RECEIPT_MIME: Record<ReceiptExt, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function attachReceipt(id: string, data: Buffer): Order {
  const order = getOrder(id);
  if (!order) throw new UserError("Заказ не найден", 404);
  if (order.status !== "awaiting_payment") throw new UserError("К этому заказу уже нельзя прикрепить чек");
  const ext = detectReceipt(data);
  if (!ext) throw new UserError("Прикрепи чек: скриншот (JPG/PNG) или PDF из банка.");
  const file = `${order.id}-${Date.now()}.${ext}`;
  writeFileSync(join(RECEIPTS_DIR, file), data);
  db.prepare("UPDATE orders SET receipt_path = ? WHERE id = ?").run(file, id);
  if (order.receipt_path) {
    try {
      unlinkSync(join(RECEIPTS_DIR, order.receipt_path));
    } catch {}
  }
  return getOrder(id)!;
}

export function receiptFile(o: Order): string | null {
  return o.receipt_path ? join(RECEIPTS_DIR, o.receipt_path) : null;
}

export function markPaid(id: string, senderName: string, method: string): Order {
  const order = getOrder(id);
  if (!order) throw new UserError("Заказ не найден", 404);
  if (order.status === "payment_check") return order;
  if (order.status !== "awaiting_payment") throw new UserError("Этот заказ уже нельзя оплатить. Оформи новый.");
  if (new Date(order.expires_at).getTime() < Date.now()) throw new UserError("Время на оплату истекло. Если ты уже перевёл деньги — напиши в поддержку.");
  if (!order.receipt_path) throw new UserError("Прикрепи чек оплаты (скриншот или PDF).");
  const updated = transition(id, ["awaiting_payment"], "payment_check", {
    sender_name: senderName.trim().slice(0, 60),
    pay_method: method.slice(0, 20),
    paid_at: nowIso(),
  });
  if (!updated) throw new UserError("Не удалось обновить заказ, попробуй ещё раз");
  emit({ kind: "paid", order: updated });
  return updated;
}

export function cancelByCustomer(id: string): Order | undefined {
  const updated = transition(id, ["awaiting_payment"], "expired", { finished_at: nowIso() });
  if (updated) emit({ kind: "changed", order: updated });
  return updated;
}

export async function confirmPayment(id: string): Promise<Order> {
  const order = transition(id, ["awaiting_payment", "payment_check", "expired", "rejected"], "confirmed", { confirmed_at: nowIso(), error: null });
  if (!order) {
    const cur = getOrder(id);
    if (!cur) throw new UserError("Заказ не найден", 404);
    return cur;
  }
  if (order.promo_code) db.prepare("UPDATE promo_codes SET used = used + 1 WHERE code = ?").run(order.promo_code);
  emit({ kind: "changed", order });
  return sendToDonix(id);
}

export function rejectPayment(id: string): Order {
  const order = transition(id, ["awaiting_payment", "payment_check", "expired"], "rejected", { finished_at: nowIso() });
  const result = order ?? getOrder(id);
  if (!result) throw new UserError("Заказ не найден", 404);
  if (order) emit({ kind: "changed", order });
  return result;
}

export async function sendToDonix(id: string): Promise<Order> {
  const order = transition(id, ["confirmed", "failed", "refunded"], "sending", { error: null });
  if (!order) return getOrder(id)!;
  emit({ kind: "changed", order });
  try {
    const res = await donix.createOrder({ externalId: order.id, sku: order.sku, uid: order.fields.uid, server: order.fields.server });
    const next = transition(id, ["sending"], "processing", { donix_order_id: res.orderId, cost_usd: res.priceUsd ?? order.cost_usd })!;
    log.info(`order ${id} sent to Donix (${res.orderId})`);
    emit({ kind: "changed", order: next });
    if (res.status !== "processing") return applyDonixStatus({ externalId: id, donixOrderId: res.orderId, status: res.status }) ?? next;
    return next;
  } catch (e) {
    const code = e instanceof DonixError ? e.code : "network_error";
    log.error(`order ${id}: Donix error ${code}`, (e as Error).message);
    const back = transition(id, ["sending"], "confirmed", { error: code })!;
    emit({ kind: "donix_error", order: back, code });
    return back;
  }
}

export function markCustomerRefunded(id: string): Order {
  const order = transition(id, ["failed", "refunded", "confirmed"], "customer_refunded", { finished_at: nowIso() });
  const result = order ?? getOrder(id);
  if (!result) throw new UserError("Заказ не найден", 404);
  if (order) emit({ kind: "changed", order });
  return result;
}

export function applyDonixStatus(input: { externalId?: string; donixOrderId?: string; status: DonixOrderStatus; priceUsd?: number }): Order | undefined {
  const order = input.externalId ? getOrder(input.externalId) : undefined;
  const target =
    order ??
    (input.donixOrderId ? (db.prepare("SELECT * FROM orders WHERE donix_order_id = ?").get(input.donixOrderId) as Row | undefined) : undefined);
  if (!target) {
    log.warn("Donix status for unknown order", input);
    return undefined;
  }
  if (input.status === "processing") return getOrder(target.id);
  const from: OrderStatus[] = input.status === "refunded" ? ["processing", "sending", "completed", "failed"] : ["processing", "sending"];
  const updated = transition(target.id, from, input.status, {
    finished_at: nowIso(),
    ...(input.priceUsd !== undefined ? { cost_usd: input.priceUsd } : {}),
  });
  if (updated && updated.status !== target.status) {
    log.info(`order ${updated.id}: Donix → ${updated.status}`);
    emit({ kind: "changed", order: updated });
  }
  return updated ?? getOrder(target.id);
}

export function expireOrders(): void {
  const rows = db.prepare("SELECT id FROM orders WHERE status = 'awaiting_payment' AND expires_at < ?").all(nowIso()) as { id: string }[];
  for (const { id } of rows) {
    const o = transition(id, ["awaiting_payment"], "expired", { finished_at: nowIso() });
    if (o) emit({ kind: "changed", order: o });
  }
}

export function ordersNeedingReminder(): Order[] {
  const before = new Date(Date.now() - 10 * 60_000).toISOString();
  const rows = (db.prepare("SELECT * FROM orders WHERE status = 'payment_check' AND reminded = 0 AND paid_at < ?").all(before) as unknown as Row[]).map(fromRow);
  for (const o of rows) db.prepare("UPDATE orders SET reminded = 1 WHERE id = ?").run(o.id);
  return rows;
}

export async function pollStuckOrders(): Promise<void> {
  const before = new Date(Date.now() - 3 * 60_000).toISOString();
  const rows = db.prepare("SELECT id, donix_order_id FROM orders WHERE status = 'processing' AND donix_order_id IS NOT NULL AND confirmed_at < ?").all(before) as {
    id: string;
    donix_order_id: string;
  }[];
  for (const r of rows) {
    try {
      const d = await donix.getOrder(r.donix_order_id);
      applyDonixStatus({ externalId: r.id, donixOrderId: r.donix_order_id, status: d.status, priceUsd: d.priceUsd });
    } catch (e) {
      log.warn(`poll ${r.id} failed`, (e as Error).message);
    }
  }
}

const PUBLIC_STATUS: Record<OrderStatus, string> = {
  awaiting_payment: "awaiting_payment",
  payment_check: "payment_check",
  confirmed: "processing",
  sending: "processing",
  processing: "processing",
  completed: "completed",
  failed: "problem",
  refunded: "problem",
  customer_refunded: "refunded",
  rejected: "rejected",
  expired: "expired",
};

export function publicOrder(o: Order) {
  return {
    id: o.id,
    status: PUBLIC_STATUS[o.status],
    game: o.game,
    productName: o.product_name,
    fields: o.fields,
    nickname: o.nickname,
    amount: o.amount,
    basePrice: o.base_price,
    discountPercent: o.discount_percent,
    displayCurrency: o.display_currency,
    createdAt: o.created_at,
    expiresAt: o.expires_at,
    hasReceipt: o.receipt_path !== null,
  };
}

export function adminOrder(o: Order) {
  return {
    ...publicOrder(o),
    rawStatus: o.status,
    telegram: o.telegram,
    sku: o.sku,
    promoCode: o.promo_code,
    costUsd: o.cost_usd,
    senderName: o.sender_name,
    payMethod: o.pay_method,
    donixOrderId: o.donix_order_id,
    error: o.error,
    paidAt: o.paid_at,
    confirmedAt: o.confirmed_at,
    finishedAt: o.finished_at,
    receiptKind: o.receipt_path ? (o.receipt_path.endsWith(".pdf") ? "pdf" : "image") : null,
  };
}
