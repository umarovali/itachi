/**
 * Админы бота (и будущей админки).
 *  - superadmin — всегда РОВНО ОДИН (гарантирует уникальный индекс в базе). Добавляет/удаляет админов.
 *  - admin — подтверждает оплаты, смотрит заказы и статистику.
 *
 * Первый суперадмин назначается одноразовым кодом: сервер печатает его в консоль,
 * владелец отправляет боту `/claim КОД`. Пока суперадмин есть — код не создаётся.
 */
import { randomInt } from "node:crypto";
import { db, nowIso } from "./db.ts";
import { log } from "./log.ts";

export type Role = "superadmin" | "admin";

export interface Admin {
  tg_id: number;
  role: Role;
  name: string | null;
  added_by: number | null;
  created_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    tg_id      INTEGER PRIMARY KEY,
    role       TEXT NOT NULL CHECK (role IN ('superadmin', 'admin')),
    name       TEXT,
    added_by   INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS admins_one_superadmin ON admins(role) WHERE role = 'superadmin';
`);

export const listAdmins = (): Admin[] =>
  db.prepare("SELECT * FROM admins ORDER BY role = 'superadmin' DESC, created_at").all() as unknown as Admin[];

export const getAdmin = (tgId: number | undefined): Admin | undefined =>
  tgId === undefined ? undefined : (db.prepare("SELECT * FROM admins WHERE tg_id = ?").get(tgId) as Admin | undefined);

export const isAdmin = (tgId: number | undefined): boolean => getAdmin(tgId) !== undefined;
export const isSuperadmin = (tgId: number | undefined): boolean => getAdmin(tgId)?.role === "superadmin";
export const getSuperadmin = (): Admin | undefined => db.prepare("SELECT * FROM admins WHERE role = 'superadmin'").get() as Admin | undefined;

// ---------------------------------------------------------------- первый суперадмин

let claimCode: string | null = null;

/** Вызывается при старте: если суперадмина нет — печатаем одноразовый код. */
export function prepareClaimCode(): void {
  if (getSuperadmin()) {
    claimCode = null;
    return;
  }
  claimCode = String(randomInt(100000, 1000000));
  log.warn(`Суперадмин ещё не назначен. Отправьте боту:  /claim ${claimCode}`);
}

export function claimSuperadmin(tgId: number, name: string, code: string): "ok" | "taken" | "bad_code" {
  if (getSuperadmin()) return "taken";
  if (!claimCode || code.trim() !== claimCode) return "bad_code";
  try {
    db.prepare(
      "INSERT INTO admins (tg_id, role, name, added_by, created_at) VALUES (?, 'superadmin', ?, NULL, ?) ON CONFLICT(tg_id) DO UPDATE SET role = 'superadmin'",
    ).run(tgId, name, nowIso());
  } catch {
    return "taken"; // уникальный индекс: суперадмин уже есть
  }
  claimCode = null;
  log.info(`Суперадмин назначен: ${name} (${tgId})`);
  return "ok";
}

// ---------------------------------------------------------------- управление (только суперадмин)

export function addAdmin(byTgId: number, tgId: number, name: string | null): "ok" | "forbidden" | "exists" {
  if (!isSuperadmin(byTgId)) return "forbidden";
  if (getAdmin(tgId)) return "exists";
  db.prepare("INSERT INTO admins (tg_id, role, name, added_by, created_at) VALUES (?, 'admin', ?, ?, ?)").run(tgId, name, byTgId, nowIso());
  log.info(`admin added: ${name ?? ""} (${tgId}) by ${byTgId}`);
  return "ok";
}

export function removeAdmin(byTgId: number, tgId: number): "ok" | "forbidden" | "not_found" | "is_superadmin" {
  if (!isSuperadmin(byTgId)) return "forbidden";
  const target = getAdmin(tgId);
  if (!target) return "not_found";
  if (target.role === "superadmin") return "is_superadmin";
  db.prepare("DELETE FROM admins WHERE tg_id = ? AND role = 'admin'").run(tgId);
  log.info(`admin removed: ${tgId} by ${byTgId}`);
  return "ok";
}
