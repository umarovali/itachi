import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getProduct, publicCatalog } from "./catalog.ts";
import { config } from "./config.ts";
import { db, nowIso } from "./db.ts";
import { donix, toStatus } from "./donix.ts";
import { gameBySlug } from "./games.ts";
import { log } from "./log.ts";
import { adminRouter } from "./admin-http.ts";
import { applyDonixStatus, attachReceipt, cancelByCustomer, checkPromo, createOrder, getOrder, markPaid, publicOrder, UserError } from "./orders.ts";

// ---------------------------------------------------------------- простая защита от спама

const hits = new Map<string, { count: number; reset: number }>();
function rateLimit(name: string, max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { count: 1, reset: now + windowMs });
    else if (++h.count > max) return res.status(429).json({ error: "Слишком много запросов. Подожди минуту." });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}, 60_000).unref();

const wrap = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

// ---------------------------------------------------------------- вебхук Donix

function verifySignature(raw: Buffer, header: string | undefined): boolean {
  if (!config.donix.webhookSecret || !header) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", config.donix.webhookSecret).update(raw).digest("hex"));
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function handleDonixWebhook(body: unknown): void {
  const b = (body ?? {}) as Record<string, unknown>;
  // Donix повторяет вебхук до 3 раз — обрабатываем каждое событие один раз.
  if (b.order_id || b.external_id) {
    const key = `${b.order_id ?? b.external_id}:${b.status ?? ""}`;
    const fresh = db.prepare("INSERT OR IGNORE INTO webhook_events (key, received_at) VALUES (?, ?)").run(key, nowIso()).changes > 0;
    if (!fresh) return;
  }
  applyDonixStatus({
    externalId: typeof b.external_id === "string" ? b.external_id : undefined,
    donixOrderId: typeof b.order_id === "string" ? b.order_id : undefined,
    status: toStatus(b.status),
    priceUsd: b.price !== undefined && Number.isFinite(Number(b.price)) ? Number(b.price) : undefined,
  });
}

// ---------------------------------------------------------------- приложение

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // За прокси (nginx на VPS, балансировщик Render) — чтобы req.ip был IP покупателя.
  app.set("trust proxy", config.trustProxy);

  // Вебхук — ДО express.json: подпись считается по «сырому» телу.
  app.post("/api/webhooks/donix", express.raw({ type: "*/*", limit: "100kb" }), (req, res) => {
    const raw = req.body as Buffer;
    if (!verifySignature(raw, req.header("x-donix-signature"))) {
      log.warn("Donix webhook: bad signature — ignored");
      return res.status(401).json({ error: "bad signature" });
    }
    try {
      handleDonixWebhook(JSON.parse(raw.toString("utf8")));
    } catch (e) {
      log.error("Donix webhook: bad body", (e as Error).message);
      return res.status(400).json({ error: "bad body" });
    }
    res.json({ ok: true });
  });

  // Чек оплаты — картинка «как есть» (до express.json). Тип проверяется по содержимому.
  app.post(
    "/api/orders/:id/receipt",
    rateLimit("receipt", 10, 10 * 60_000),
    express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "6mb" }),
    (req, res) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new UserError("Прикрепи картинку JPG или PNG");
      res.json(publicOrder(attachReceipt(req.params.id.toUpperCase(), req.body)));
    },
  );

  app.use(express.json({ limit: "20kb" }));

  app.use("/api/admin", adminRouter());

  app.get("/api/health", (_req, res) => res.json({ ok: true, donixMode: config.donix.mock ? "test" : "live" }));

  app.get("/api/catalog", (_req, res) => res.json(publicCatalog()));

  const validateBody = z.object({ game: z.string(), sku: z.string(), fields: z.record(z.string(), z.string().max(64)) });
  app.post(
    "/api/validate",
    rateLimit("validate", 30, 60_000),
    wrap(async (req, res) => {
      const body = validateBody.parse(req.body);
      const game = gameBySlug(body.game);
      const product = getProduct(body.sku);
      const uid = String(body.fields.uid ?? "").trim();
      if (!game || !product || product.game !== game.slug) throw new UserError("Товар не найден");
      if (!uid) throw new UserError("Заполни данные игрока");
      const r = await donix.validate(product.sku, uid, body.fields.server?.trim());
      res.json(r.ok ? { ok: true, nickname: r.nickname ?? null } : { ok: false, error: "Игровой ID не прошёл проверку. Проверь, правильно ли он введён." });
    }),
  );

  app.post("/api/promo/check", rateLimit("promo", 15, 60_000), (req, res) => {
    const code = z.object({ code: z.string().max(40) }).parse(req.body).code;
    const p = checkPromo(code);
    res.json(p ? { ok: true, discountPercent: p.percent } : { ok: false, error: "Промокод не найден или уже использован." });
  });

  const createBody = z.object({
    game: z.string(),
    sku: z.string(),
    fields: z.record(z.string(), z.string().max(64)),
    telegram: z.string().max(40),
    displayCurrency: z.string().max(5),
    promoCode: z.string().max(40).optional(),
  });
  app.post(
    "/api/orders",
    rateLimit("orders", 8, 10 * 60_000),
    wrap(async (req, res) => res.status(201).json(publicOrder(await createOrder(createBody.parse(req.body))))),
  );

  app.get("/api/orders/:id", (req, res) => {
    const o = getOrder(req.params.id.toUpperCase());
    if (!o) return res.status(404).json({ error: "Заказ не найден" });
    res.json(publicOrder(o));
  });

  app.post("/api/orders/:id/paid", rateLimit("paid", 20, 60_000), (req, res) => {
    const body = z.object({ senderName: z.string().min(2).max(60), method: z.string().max(20) }).parse(req.body);
    res.json(publicOrder(markPaid(req.params.id.toUpperCase(), body.senderName, body.method)));
  });

  app.post("/api/orders/:id/cancel", (req, res) => {
    const o = cancelByCustomer(req.params.id.toUpperCase()) ?? getOrder(req.params.id.toUpperCase());
    if (!o) return res.status(404).json({ error: "Заказ не найден" });
    res.json(publicOrder(o));
  });

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // Собранные сайт и админка (npm run build) — тот же домен, что и API.
  const root = join(import.meta.dirname, "..", "..");
  const serveSpa = (prefix: string, dir: string) => {
    if (!existsSync(join(dir, "index.html"))) return;
    app.use(prefix, express.static(dir, { index: false, maxAge: "1h" }));
    app.get(prefix === "/" ? "*" : `${prefix}*`, (_req, res) => res.sendFile(join(dir, "index.html")));
  };
  app.get("/admin", (req, res, next) => (req.path === "/admin" ? res.redirect(301, "/admin/") : next()));
  serveSpa("/admin/", join(root, "admin", "dist"));
  serveSpa("/", join(root, "web", "dist"));

  // Ошибки: понятный текст покупателю, подробности — только в лог.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    if (err instanceof z.ZodError || (err as { type?: string })?.type === "entity.parse.failed")
      return res.status(400).json({ error: "Неверные данные запроса" });
    if ((err as { type?: string })?.type === "entity.too.large") return res.status(413).json({ error: "Файл слишком большой (максимум 6 МБ)" });
    log.error("request failed", err);
    res.status(500).json({ error: "Что-то пошло не так. Попробуй ещё раз или напиши в поддержку." });
  });

  return app;
}
