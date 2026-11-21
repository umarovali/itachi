/**
 * Вход в админку через Telegram-бота (без паролей).
 *
 *  1. Браузер: POST /api/admin/auth/start → { requestId (секрет браузера), botUrl (t.me/бот?start=login_КОД) }.
 *  2. Админ открывает ссылку → бот спрашивает «Подтвердить вход?» (с IP и браузером) → «Да».
 *  3. Браузер опрашивает /api/admin/auth/poll с requestId → получает cookie сессии.
 *
 * В ссылке только КОД; секрет requestId знает лишь браузер, начавший вход.
 * Сессия проверяет, что человек всё ещё админ, при КАЖДОМ запросе.
 */
import { createHash, randomBytes } from "node:crypto";
import { getAdmin, type Admin } from "./admins.ts";
import { db, nowIso } from "./db.ts";

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    tg_id      INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    user_agent TEXT
  );
`);

export const SESSION_COOKIE = "itachi_admin";
export const SESSION_DAYS = 7;
const LOGIN_TTL_MS = 5 * 60_000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const token = (bytes: number) => randomBytes(bytes).toString("base64url");

// ---------------------------------------------------------------- запросы на вход (в памяти, живут 5 минут)

interface LoginRequest {
  requestId: string;
  code: string;
  status: "pending" | "approved" | "rejected" | "used";
  tgId?: number;
  ip: string;
  userAgent: string;
  expiresAt: number;
}

const byCode = new Map<string, LoginRequest>();
const byRequestId = new Map<string, LoginRequest>();

function cleanup() {
  const now = Date.now();
  for (const r of byCode.values()) {
    if (r.expiresAt < now) {
      byCode.delete(r.code);
      byRequestId.delete(r.requestId);
    }
  }
}
setInterval(cleanup, 60_000).unref();

export function startLogin(ip: string, userAgent: string): LoginRequest {
  cleanup();
  if (byCode.size > 200) throw new Error("too many pending logins");
  const req: LoginRequest = {
    requestId: token(32),
    code: token(12).replace(/[-_]/g, "x"),
    status: "pending",
    ip,
    userAgent: userAgent.slice(0, 200),
    expiresAt: Date.now() + LOGIN_TTL_MS,
  };
  byCode.set(req.code, req);
  byRequestId.set(req.requestId, req);
  return req;
}

export function findLoginByCode(code: string): LoginRequest | undefined {
  const r = byCode.get(code);
  return r && r.expiresAt > Date.now() ? r : undefined;
}

/** Бот: админ нажал «Да» / «Нет». */
export function decideLogin(code: string, tgId: number, approve: boolean): "ok" | "expired" | "done" | "forbidden" {
  const r = findLoginByCode(code);
  if (!r) return "expired";
  if (r.status !== "pending") return "done";
  if (!getAdmin(tgId)) return "forbidden";
  r.status = approve ? "approved" : "rejected";
  r.tgId = tgId;
  return "ok";
}

/** Браузер: ждём решения. При «approved» — создаём сессию (один раз). */
export function pollLogin(requestId: string, userAgent: string): { status: "pending" | "rejected" | "expired" } | { status: "approved"; sessionToken: string } {
  const r = byRequestId.get(requestId);
  if (!r || r.expiresAt < Date.now() || r.status === "used") return { status: "expired" };
  if (r.status === "pending" || r.status === "rejected") return { status: r.status };
  r.status = "used";
  if (!r.tgId || !getAdmin(r.tgId)) return { status: "rejected" };
  return { status: "approved", sessionToken: createSession(r.tgId, userAgent) };
}

// ---------------------------------------------------------------- сессии

function createSession(tgId: number, userAgent: string): string {
  const t = token(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  db.prepare("INSERT INTO admin_sessions (token_hash, tg_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)").run(
    sha256(t),
    tgId,
    nowIso(),
    expires,
    userAgent.slice(0, 200),
  );
  db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").run(nowIso());
  return t;
}

/** Сессия → админ (или undefined, если сессии нет / истекла / человек больше не админ). */
export function sessionAdmin(sessionToken: string | undefined): Admin | undefined {
  if (!sessionToken) return undefined;
  const row = db.prepare("SELECT tg_id, expires_at FROM admin_sessions WHERE token_hash = ?").get(sha256(sessionToken)) as
    | { tg_id: number; expires_at: string }
    | undefined;
  if (!row || row.expires_at < nowIso()) return undefined;
  return getAdmin(row.tg_id);
}

export function destroySession(sessionToken: string | undefined): void {
  if (sessionToken) db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(sha256(sessionToken));
}

/** Удалённый админ — выкинуть из всех сессий. */
export function destroySessionsOf(tgId: number): void {
  db.prepare("DELETE FROM admin_sessions WHERE tg_id = ?").run(tgId);
}
