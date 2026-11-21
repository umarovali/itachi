/** API админки: /api/admin/... (только для вошедших админов). */
import { createReadStream, existsSync } from "node:fs";
import express, { type NextFunction, type Request, type Response, type Router } from "express";
import type { Admin } from "./admins.ts";
import { destroySession, pollLogin, SESSION_COOKIE, SESSION_DAYS, sessionAdmin, startLogin } from "./auth.ts";
import { getBotUsername } from "./bot.ts";
import { getMarkupPercent } from "./catalog.ts";
import { config } from "./config.ts";
import { db } from "./db.ts";
import { donix } from "./donix.ts";
import { log } from "./log.ts";
import {
  adminOrder,
  confirmPayment,
  getOrder,
  markCustomerRefunded,
  receiptFile,
  rejectPayment,
  sendToDonix,
  UserError,
  type OrderStatus,
} from "./orders.ts";
import { getRates } from "./rates.ts";

declare module "express-serve-static-core" {
  interface Request {
    admin?: Admin;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

const secureCookies = config.publicSiteUrl.startsWith("https://");
const cookieBase = { httpOnly: true, sameSite: "strict" as const, secure: secureCookies, path: "/api/admin" };

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const admin = sessionAdmin(readCookie(req, SESSION_COOKIE));
  if (!admin) return res.status(401).json({ error: "Нужно войти" });
  req.admin = admin;
  next();
}

/** Простая защита от CSRF: изменяющие запросы должны идти с JSON (браузерные формы так не умеют). */
function requireJson(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && !req.is("application/json")) return res.status(415).json({ error: "JSON only" });
  next();
}

const wrap = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

const ALL_STATUSES: OrderStatus[] = [
  "awaiting_payment", "payment_check", "confirmed", "sending", "processing",
  "completed", "failed", "refunded", "customer_refunded", "rejected", "expired",
];

export function adminRouter(): Router {
  const r = express.Router();
  r.use(requireJson);

  // ---------------- вход
  const loginHits = new Map<string, number[]>();
  r.post("/auth/start", (req, res) => {
    const botUsername = getBotUsername();
    if (!botUsername) return res.status(503).json({ error: "Telegram-бот не запущен — вход невозможен" });
    const now = Date.now();
    const hits = (loginHits.get(req.ip ?? "") ?? []).filter((t) => now - t < 60_000);
    if (hits.length >= 10) return res.status(429).json({ error: "Слишком много попыток, подожди минуту" });
    loginHits.set(req.ip ?? "", [...hits, now]);
    const login = startLogin(req.ip ?? "?", req.get("user-agent") ?? "");
    res.json({ requestId: login.requestId, botUrl: `https://t.me/${botUsername}?start=login_${login.code}`, expiresInSec: 300 });
  });

  r.post("/auth/poll", (req, res) => {
    const requestId = String(req.body?.requestId ?? "");
    const result = pollLogin(requestId, req.get("user-agent") ?? "");
    if (result.status === "approved") {
      res.cookie(SESSION_COOKIE, result.sessionToken, { ...cookieBase, maxAge: SESSION_DAYS * 86_400_000 });
      return res.json({ status: "approved" });
    }
    res.json({ status: result.status });
  });

  r.post("/auth/logout", (req, res) => {
    destroySession(readCookie(req, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, cookieBase);
    res.json({ ok: true });
  });

  // ---------------- всё ниже — только для админов
  r.use(requireAdmin);

  r.get("/auth/me", (req, res) => {
    const a = req.admin!;
    res.json({ tgId: a.tg_id, name: a.name, role: a.role });
  });

  r.get(
    "/summary",
    wrap(async (_req, res) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const today = db
        .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS revenue, COALESCE(SUM(cost_usd),0) AS cost FROM orders WHERE status = 'completed' AND finished_at >= ?")
        .get(start.toISOString()) as { n: number; revenue: number; cost: number };
      const counts = Object.fromEntries(
        (db.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").all() as { status: string; n: number }[]).map((r) => [r.status, r.n]),
      );
      const rates = getRates();
      const balance = await donix.balance().catch(() => null);
      res.json({
        donixMode: config.donix.mock ? "test" : "live",
        balance,
        markupPercent: getMarkupPercent(),
        rates,
        today: { orders: today.n, revenue: today.revenue, costUsd: today.cost, profit: Math.round(today.revenue - today.cost * rates.KGS) },
        counts,
      });
    }),
  );

  r.get("/orders", (req, res) => {
    const status = String(req.query.status ?? "");
    const q = String(req.query.q ?? "").trim().toUpperCase();
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (status === "attention") where.push("status IN ('payment_check','confirmed','failed','refunded')");
    else if (ALL_STATUSES.includes(status as OrderStatus)) {
      where.push("status = ?");
      params.push(status);
    }
    if (q) {
      where.push("(id LIKE ? OR fields LIKE ? OR telegram LIKE ? OR CAST(amount AS TEXT) = ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q.toLowerCase()}%`, q);
    }
    const rows = db
      .prepare(`SELECT id FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 200`)
      .all(...params) as { id: string }[];
    res.json(rows.map((r) => adminOrder(getOrder(r.id)!)));
  });

  r.get("/orders/:id", (req, res) => {
    const o = getOrder(req.params.id);
    if (!o) return res.status(404).json({ error: "Заказ не найден" });
    res.json(adminOrder(o));
  });

  r.get("/orders/:id/receipt", (req, res) => {
    const o = getOrder(req.params.id);
    const file = o ? receiptFile(o) : null;
    if (!file || !existsSync(file)) return res.status(404).json({ error: "Чека нет" });
    const ext = file.split(".").pop();
    res.type(ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
    res.set("Cache-Control", "private, max-age=3600");
    res.set("X-Content-Type-Options", "nosniff");
    createReadStream(file).pipe(res);
  });

  const action = (name: string, fn: (id: string) => unknown) =>
    r.post(
      `/orders/:id/${name}`,
      wrap(async (req, res) => {
        if (!getOrder(req.params.id)) throw new UserError("Заказ не найден", 404);
        log.info(`order ${req.params.id}: ${name} by admin ${req.admin!.tg_id} (web)`);
        await fn(req.params.id);
        res.json(adminOrder(getOrder(req.params.id)!));
      }),
    );
  action("confirm", confirmPayment);
  action("reject", rejectPayment);
  action("retry", sendToDonix);
  action("refund", markCustomerRefunded);

  return r;
}
