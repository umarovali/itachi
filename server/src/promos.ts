import { db } from "./db.ts";
import { UserError } from "./orders.ts";

export interface Promo {
  code: string;
  percent: number;
  maxUses: number | null;
  used: number;
  active: boolean;
  createdAt: string;
}

interface PromoRow {
  code: string;
  percent: number;
  max_uses: number | null;
  used: number;
  active: number;
  created_at: string;
}

const toPromo = (r: PromoRow): Promo => ({
  code: r.code,
  percent: r.percent,
  maxUses: r.max_uses,
  used: r.used,
  active: r.active === 1,
  createdAt: r.created_at,
});

export const CODE_RE = /^[A-Z0-9_-]{3,30}$/;

export function listPromos(): Promo[] {
  return (db.prepare("SELECT * FROM promo_codes ORDER BY active DESC, created_at DESC").all() as unknown as PromoRow[]).map(toPromo);
}

export function savePromo(input: { code: string; percent: number; maxUses: number | null }): Promo {
  const code = input.code.trim().toUpperCase();
  if (!CODE_RE.test(code)) throw new UserError("Код: 3–30 символов, только латиница, цифры, «-» и «_»");
  const percent = Math.round(Number(input.percent) * 100) / 100;
  if (!Number.isFinite(percent) || percent <= 0 || percent > 90) throw new UserError("Скидка должна быть от 0 до 90%");
  const maxUses = input.maxUses === null || input.maxUses === undefined ? null : Math.floor(Number(input.maxUses));
  if (maxUses !== null && !(maxUses > 0)) throw new UserError("Лимит использований должен быть больше 0 (или пустой — без лимита)");
  db.prepare(
    "INSERT INTO promo_codes (code, percent, max_uses, used, active, created_at) VALUES (?, ?, ?, 0, 1, ?) ON CONFLICT(code) DO UPDATE SET percent = excluded.percent, max_uses = excluded.max_uses, active = 1",
  ).run(code, percent, maxUses, new Date().toISOString());
  return getPromo(code)!;
}

export function getPromo(code: string): Promo | null {
  const r = db.prepare("SELECT * FROM promo_codes WHERE code = ?").get(code.trim().toUpperCase()) as PromoRow | undefined;
  return r ? toPromo(r) : null;
}

export function setPromoActive(code: string, active: boolean): boolean {
  return db.prepare("UPDATE promo_codes SET active = ? WHERE code = ?").run(active ? 1 : 0, code.trim().toUpperCase()).changes > 0;
}

export function deletePromo(code: string): boolean {
  return db.prepare("DELETE FROM promo_codes WHERE code = ?").run(code.trim().toUpperCase()).changes > 0;
}
