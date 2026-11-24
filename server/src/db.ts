import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS products (
    sku          TEXT PRIMARY KEY,
    game         TEXT NOT NULL,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'item',
    usd          REAL NOT NULL,          -- цена Donix для нас
    price_override_kgs INTEGER,          -- ручная цена в сомах (если задана)
    active       INTEGER NOT NULL DEFAULT 1,
    sort         INTEGER NOT NULL DEFAULT 0,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rates (
    code       TEXT PRIMARY KEY,         -- KGS, RUB, KZT, UZS
    rate       REAL NOT NULL,            -- сколько единиц за 1 USD
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    code       TEXT PRIMARY KEY,
    percent    REAL NOT NULL,
    max_uses   INTEGER,                  -- NULL = без ограничения
    used       INTEGER NOT NULL DEFAULT 0,
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id               TEXT PRIMARY KEY,
    status           TEXT NOT NULL,
    game             TEXT NOT NULL,
    sku              TEXT NOT NULL,
    product_name     TEXT NOT NULL,
    fields           TEXT NOT NULL,      -- JSON
    nickname         TEXT,
    telegram         TEXT NOT NULL,
    display_currency TEXT NOT NULL,
    base_price       INTEGER NOT NULL,   -- цена товара в сомах до скидки
    discount_percent REAL NOT NULL DEFAULT 0,
    promo_code       TEXT,
    amount           INTEGER NOT NULL,   -- сумма к оплате, сом
    cost_usd         REAL NOT NULL,      -- сколько спишет Donix (на момент заказа)
    sender_name      TEXT,
    pay_method       TEXT,
    donix_order_id   TEXT,
    error            TEXT,
    tg_messages      TEXT NOT NULL DEFAULT '[]', -- JSON [{chatId, messageId}]
    reminded         INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL,
    expires_at       TEXT NOT NULL,
    paid_at          TEXT,               -- покупатель нажал «Я оплатил»
    confirmed_at     TEXT,               -- админ подтвердил оплату
    finished_at      TEXT
  );
  CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS orders_amount ON orders(amount, status);

  CREATE TABLE IF NOT EXISTS webhook_events (
    key         TEXT PRIMARY KEY,
    received_at TEXT NOT NULL
  );
`);

for (const sql of ["ALTER TABLE orders ADD COLUMN receipt_path TEXT"]) {
  try {
    db.exec(sql);
  } catch {}
}

export const nowIso = (): string => new Date().toISOString();

export function getSetting(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
