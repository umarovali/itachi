import { addAdmin, claimSuperadmin, getAdmin, getSuperadmin, isAdmin, isSuperadmin, listAdmins, prepareClaimCode, removeAdmin } from "./admins.ts";
import { decideLogin, destroySessionsOf, findLoginByCode } from "./auth.ts";
import { getMarkupPercent, setMarkupPercent, syncProducts } from "./catalog.ts";
import { config } from "./config.ts";
import { db } from "./db.ts";
import { donix } from "./donix.ts";
import { gameBySlug } from "./games.ts";
import { log } from "./log.ts";
import {
  confirmPayment,
  getOrder,
  listOrders,
  markCustomerRefunded,
  orderEvents,
  ordersNeedingReminder,
  receiptFile,
  rejectPayment,
  saveTgMessages,
  sendToDonix,
  type Order,
  type OrderEvent,
} from "./orders.ts";
import { savePromo, setPromoActive } from "./promos.ts";
import { getRates } from "./rates.ts";
import { readFileSync } from "node:fs";
import { answerCallback, editMessage, esc, sendDocument, sendMessage, sendPhoto, tg, type Keyboard, type TgUpdate } from "./telegram.ts";

let botUsername: string | null = null;
export const getBotUsername = () => botUsername;

const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "—");
const som = (n: number) => `${n.toLocaleString("ru-RU")} сом`;

const STATUS_LINE: Record<Order["status"], string> = {
  awaiting_payment: "🕐 Ждём оплату",
  payment_check: "👀 <b>Покупатель оплатил — проверь банк</b>",
  confirmed: "⏳ Оплата подтверждена, отправляем в Donix",
  sending: "⏳ Отправляем в Donix…",
  processing: "⏳ Donix выполняет заказ",
  completed: "✅ <b>Выполнено</b>",
  failed: "🔴 <b>Donix: ошибка выполнения</b> — повтори или верни деньги",
  refunded: "🔴 <b>Donix вернул заказ</b> — повтори или верни деньги",
  customer_refunded: "💸 Деньги возвращены покупателю",
  rejected: "❌ Оплата не найдена — заказ отклонён",
  expired: "⌛ Не оплачен вовремя",
};

const DONIX_ERRORS: Record<string, string> = {
  insufficient_balance: "На балансе Donix не хватает денег. Пополни баланс и нажми «Повторить».",
  invalid_uid: "Donix не принял ID игрока.",
  product_not_found: "Товар больше недоступен в Donix.",
  unauthorized: "Неверный или отключённый API-ключ Donix!",
  network_error: "Donix не ответил (сеть). Нажми «Повторить».",
};

function orderText(o: Order): string {
  const game = gameBySlug(o.game);
  const fields = Object.entries(o.fields)
    .map(([k, v]) => `${k === "uid" ? "🆔 ID" : k === "server" ? "🌐 Сервер" : esc(k)}: <code>${esc(v)}</code>`)
    .join("\n");
  const lines = [
    `🧾 <b>Заказ #${o.id}</b>`,
    `🎮 ${esc(game?.title ?? o.game)} — <b>${esc(o.product_name)}</b>`,
    fields,
    o.nickname ? `👤 Ник: <b>${esc(o.nickname)}</b>` : "",
    `💰 Сумма: <b>${som(o.amount)}</b>${o.pay_method ? ` → ${esc(o.pay_method)}` : ""}${o.discount_percent ? ` (промокод ${esc(o.promo_code)} −${o.discount_percent}%)` : ""}`,
    o.sender_name ? `🙍 Отправитель: <b>${esc(o.sender_name)}</b>` : "",
    `✈️ Покупатель: ${esc(o.telegram)}`,
    `🕐 Создан ${fmtTime(o.created_at)}${o.paid_at ? ` · оплатил ${fmtTime(o.paid_at)}` : ""}`,
    "",
    STATUS_LINE[o.status],
    o.error ? `⚠️ ${esc(DONIX_ERRORS[o.error] ?? o.error)}` : "",
  ];
  return lines.filter((l, i) => l !== "" || i === 8).join("\n");
}

function orderKeyboard(o: Order): Keyboard {
  switch (o.status) {
    case "awaiting_payment":
    case "payment_check":
    case "expired":
      return [[{ text: "✅ Деньги пришли", callback_data: `ok:${o.id}` }, { text: "❌ Не пришли", callback_data: `no:${o.id}` }]];
    case "rejected":
      return [[{ text: "↩️ Всё-таки пришли", callback_data: `ok:${o.id}` }]];
    case "confirmed":
      return [[{ text: "🔁 Повторить", callback_data: `retry:${o.id}` }, { text: "💸 Вернул деньги", callback_data: `refund:${o.id}` }]];
    case "failed":
    case "refunded":
      return [[{ text: "🔁 Повторить", callback_data: `retry:${o.id}` }, { text: "💸 Вернул деньги", callback_data: `refund:${o.id}` }]];
    default:
      return [];
  }
}

async function toAdmins(text: string, keyboard?: Keyboard): Promise<{ chatId: number; messageId: number }[]> {
  const sent: { chatId: number; messageId: number }[] = [];
  for (const { tg_id: chatId } of listAdmins()) {
    try {
      const m = await sendMessage(chatId, text, keyboard);
      sent.push({ chatId, messageId: m.message_id });
    } catch (e) {
      log.warn(`telegram send to ${chatId} failed`, (e as Error).message);
    }
  }
  return sent;
}

async function sendReceipt(o: Order): Promise<void> {
  const file = receiptFile(o);
  if (!file) return;
  let data: Buffer;
  try {
    data = readFileSync(file);
  } catch {
    return;
  }
  const ext = file.split(".").pop();
  const send = ext === "pdf" ? sendDocument : sendPhoto;
  for (const { tg_id } of listAdmins()) {
    await send(tg_id, data, `receipt-${o.id}.${ext}`, `🧾 Чек к заказу <b>#${o.id}</b> · ${som(o.amount)}\nПроверь перевод в банке — чек можно подделать.`).catch(
      (e: Error) => log.warn(`telegram receipt to ${tg_id} failed`, e.message),
    );
  }
}

async function syncOrderCard(o: Order, forceNew = false): Promise<void> {
  if (forceNew || o.tg_messages.length === 0) {
    const sent = await toAdmins(orderText(o), orderKeyboard(o));
    saveTgMessages(o.id, sent);
    return;
  }
  for (const m of o.tg_messages) {
    try {
      await editMessage(m.chatId, m.messageId, orderText(o), orderKeyboard(o));
    } catch (e) {
      log.warn(`telegram edit ${o.id} failed`, (e as Error).message);
    }
  }
}

async function onOrderEvent(e: OrderEvent): Promise<void> {
  const fresh = getOrder(e.order.id) ?? e.order;
  if (e.kind === "paid") {
    await sendReceipt(fresh);
    return syncOrderCard(fresh);
  }
  if (fresh.tg_messages.length === 0 && ["awaiting_payment", "expired"].includes(fresh.status)) return;
  await syncOrderCard(fresh);
  if (e.kind === "donix_error") {
    await toAdmins(`🚨 <b>Заказ #${fresh.id} не ушёл в Donix</b>\n${esc(DONIX_ERRORS[e.code] ?? e.code)}`);
  }
  if (fresh.status === "failed" || fresh.status === "refunded") {
    await toAdmins(`🚨 <b>Заказ #${fresh.id}: ${fresh.status === "failed" ? "ошибка Donix" : "возврат от Donix"}</b>\nПокупатель заплатил ${som(fresh.amount)} — повтори заказ или верни деньги.`);
  }
}

const HELP = [
  "<b>Команды</b>",
  "/orders — заказы, которые ждут проверки",
  "/problems — заказы с ошибками",
  "/order КОД — карточка заказа",
  "/balance — баланс Donix",
  "/stats — статистика за сегодня",
  "/rates — курсы валют",
  "/markup 12 — поменять наценку (%)",
  "/sync — обновить каталог из Donix",
  "/promo КОД 5 [лимит] — создать промокод на 5%",
  "/promo_off КОД — выключить промокод",
].join("\n");

const SUPER_HELP = [
  "",
  "<b>Суперадмин</b>",
  "/admins — список админов",
  "/addadmin ID [имя] — добавить админа",
  "/deladmin ID — удалить админа",
  "Новый человек может написать боту /start — вам придёт кнопка «Сделать админом».",
].join("\n");

const displayName = (u: { username?: string; first_name?: string; id: number }) => (u.username ? `@${u.username}` : u.first_name || String(u.id));

async function handleCommand(chatId: number, fromId: number, text: string): Promise<void> {
  const [cmdRaw, ...args] = text.trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase().replace(/@.*$/, "");
  const superadmin = isSuperadmin(fromId);
  switch (cmd) {
    case "/start":
    case "/help": {
      const role = superadmin ? "👑 Вы — суперадмин." : "🛡 Вы — админ.";
      await sendMessage(chatId, `Привет! Это бот Itachi Store. ${role}\n${config.donix.mock ? "⚠️ Donix в <b>тестовом</b> режиме.\n" : ""}\n${HELP}${superadmin ? SUPER_HELP : ""}`);
      return;
    }
    case "/admins": {
      if (!superadmin) return void (await sendMessage(chatId, "Только для суперадмина."));
      const list = listAdmins()
        .map((a) => `${a.role === "superadmin" ? "👑" : "🛡"} ${esc(a.name ?? "—")} — <code>${a.tg_id}</code>`)
        .join("\n");
      await sendMessage(chatId, `<b>Админы</b>\n${list}`);
      return;
    }
    case "/addadmin": {
      if (!superadmin) return void (await sendMessage(chatId, "Только для суперадмина."));
      const id = Number(args[0]);
      if (!Number.isSafeInteger(id) || id <= 0) return void (await sendMessage(chatId, "Пример: /addadmin 123456789 Айбек\nID человек узнает, написав боту /start."));
      const r = addAdmin(fromId, id, args.slice(1).join(" ") || null);
      await sendMessage(chatId, r === "ok" ? `✅ Админ <code>${id}</code> добавлен.` : r === "exists" ? "Этот человек уже админ." : "Нет прав.");
      if (r === "ok") await sendMessage(id, `🛡 Вас назначили админом Itachi Store.\n\n${HELP}`).catch(() => {});
      return;
    }
    case "/deladmin": {
      if (!superadmin) return void (await sendMessage(chatId, "Только для суперадмина."));
      const id = Number(args[0]);
      const r = Number.isSafeInteger(id) ? removeAdmin(fromId, id) : "not_found";
      const msg = { ok: `🗑 Админ <code>${id}</code> удалён.`, not_found: "Такого админа нет. Список: /admins", is_superadmin: "Суперадмина удалить нельзя.", forbidden: "Нет прав." };
      await sendMessage(chatId, msg[r]);
      if (r === "ok") {
        destroySessionsOf(id);
        await sendMessage(id, "Вы больше не админ Itachi Store.").catch(() => {});
      }
      return;
    }
    case "/orders": {
      const list = listOrders(["payment_check"], 15);
      if (!list.length) return void (await sendMessage(chatId, "Нет заказов, ждущих проверки 👌"));
      for (const o of list.reverse()) {
        const m = await sendMessage(chatId, orderText(o), orderKeyboard(o));
        saveTgMessages(o.id, [...(getOrder(o.id)?.tg_messages ?? []), { chatId, messageId: m.message_id }]);
      }
      return;
    }
    case "/problems": {
      const list = listOrders(["confirmed", "failed", "refunded"], 15);
      if (!list.length) return void (await sendMessage(chatId, "Проблемных заказов нет 👌"));
      for (const o of list.reverse()) {
        const m = await sendMessage(chatId, orderText(o), orderKeyboard(o));
        saveTgMessages(o.id, [...(getOrder(o.id)?.tg_messages ?? []), { chatId, messageId: m.message_id }]);
      }
      return;
    }
    case "/order": {
      const o = args[0] ? getOrder(args[0].replace(/^#/, "").toUpperCase()) : undefined;
      if (!o) return void (await sendMessage(chatId, "Заказ не найден. Пример: /order K7Q2M9"));
      const m = await sendMessage(chatId, orderText(o), orderKeyboard(o));
      saveTgMessages(o.id, [...o.tg_messages, { chatId, messageId: m.message_id }]);
      return;
    }
    case "/balance": {
      const b = await donix.balance();
      await sendMessage(chatId, `💳 Баланс Donix: <b>${b.amount} ${esc(b.currency)}</b>${config.donix.mock ? " (тестовый)" : ""}`);
      return;
    }
    case "/stats": {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const r = db
        .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS revenue, COALESCE(SUM(cost_usd),0) AS cost FROM orders WHERE status = 'completed' AND finished_at >= ?")
        .get(start.toISOString()) as { n: number; revenue: number; cost: number };
      const pending = (db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'payment_check'").get() as { n: number }).n;
      const costSom = Math.round(r.cost * getRates().KGS);
      await sendMessage(
        chatId,
        [
          "📊 <b>Сегодня</b>",
          `Выполнено заказов: <b>${r.n}</b>`,
          `Выручка: <b>${som(r.revenue)}</b>`,
          `Закупка Donix: ${r.cost.toFixed(2)} $ (≈ ${som(costSom)})`,
          `Прибыль: <b>≈ ${som(r.revenue - costSom)}</b>`,
          `Ждут проверки: ${pending}`,
        ].join("\n"),
      );
      return;
    }
    case "/rates": {
      const r = getRates();
      await sendMessage(
        chatId,
        `💱 <b>Курсы за 1 $</b>\nСом: ${r.KGS}\nРубль: ${r.RUB}\nТенге: ${r.KZT}\nСум: ${r.UZS}\nОбновлено: ${r.updatedAt ? new Date(r.updatedAt).toLocaleString("ru-RU") : "запасные курсы"}\n\nНаценка: <b>${getMarkupPercent()}%</b>`,
      );
      return;
    }
    case "/markup": {
      const v = Number(args[0]?.replace(",", "."));
      if (!Number.isFinite(v) || v < 0 || v > 300) return void (await sendMessage(chatId, `Сейчас наценка ${getMarkupPercent()}%. Пример: /markup 12`));
      setMarkupPercent(v);
      await sendMessage(chatId, `✅ Наценка теперь <b>${v}%</b>. Цены на сайте пересчитаны.`);
      return;
    }
    case "/sync": {
      const r = await syncProducts();
      await sendMessage(chatId, `🔄 Каталог обновлён: ${r.total} товаров, новых ${r.added}, скрыто ${r.disabled}.`);
      return;
    }
    case "/promo": {
      const usage = "Пример: /promo ITACHI5 5 100 — 5% скидки, 100 использований (лимит можно не указывать)";
      if (!args[0] || !args[1]) return void (await sendMessage(chatId, usage));
      try {
        const p = savePromo({ code: args[0], percent: Number(args[1].replace(",", ".")), maxUses: args[2] ? Number(args[2]) : null });
        await sendMessage(chatId, `🎁 Промокод <code>${esc(p.code)}</code>: −${p.percent}%${p.maxUses ? `, ${p.maxUses} использований` : ", без лимита"}`);
      } catch (e) {
        await sendMessage(chatId, `${esc((e as Error).message)}\n${usage}`);
      }
      return;
    }
    case "/promo_off": {
      const n = args[0] ? setPromoActive(args[0], false) : false;
      const code = args[0]?.toUpperCase();
      await sendMessage(chatId, n ? `Промокод ${esc(code)} выключен.` : "Промокод не найден.");
      return;
    }
    default:
      await sendMessage(chatId, HELP);
  }
}

async function handleCallback(q: NonNullable<TgUpdate["callback_query"]>): Promise<void> {
  if (!isAdmin(q.from.id)) return void (await answerCallback(q.id, "Нет доступа", true));
  const [action, id] = (q.data ?? "").split(":");
  if (action === "login_ok" || action === "login_no") {
    const r = decideLogin(id, q.from.id, action === "login_ok");
    const text = {
      ok: action === "login_ok" ? "✅ Вход в админку подтверждён. Вернитесь в браузер." : "🚫 Вход отклонён.",
      expired: "⌛ Запрос на вход устарел. Начните вход заново.",
      done: "Этот запрос уже обработан.",
      forbidden: "Нет доступа.",
    }[r];
    await answerCallback(q.id, r === "ok" ? undefined : text, r !== "ok");
    if (q.message) await editMessage(q.message.chat.id, q.message.message_id, text);
    if (r === "ok") log.info(`admin login ${action === "login_ok" ? "approved" : "rejected"} by ${q.from.id}`);
    return;
  }
  if (action === "addadmin") {
    const [, tgId, ...nameParts] = (q.data ?? "").split(":");
    const name = nameParts.join(":");
    const r = addAdmin(q.from.id, Number(tgId), name || null);
    await answerCallback(q.id, r === "ok" ? "Админ добавлен" : r === "exists" ? "Уже админ" : "Только суперадмин", r !== "ok");
    if (r === "ok") {
      if (q.message) await editMessage(q.message.chat.id, q.message.message_id, `✅ ${esc(name)} (<code>${tgId}</code>) теперь админ.`);
      await sendMessage(Number(tgId), `🛡 Вас назначили админом Itachi Store.\n\n${HELP}`).catch(() => {});
    }
    return;
  }
  const order = id ? getOrder(id) : undefined;
  if (!order) return void (await answerCallback(q.id, "Заказ не найден", true));
  if (q.message && !order.tg_messages.some((m) => m.chatId === q.message!.chat.id && m.messageId === q.message!.message_id)) {
    saveTgMessages(order.id, [...order.tg_messages, { chatId: q.message.chat.id, messageId: q.message.message_id }]);
  }
  const who = q.from.username ? `@${q.from.username}` : q.from.first_name ?? q.from.id;
  switch (action) {
    case "ok":
      await answerCallback(q.id, "Подтверждено, отправляю в Donix…");
      log.info(`order ${id}: payment confirmed by ${who}`);
      await confirmPayment(id);
      return;
    case "no":
      await answerCallback(q.id, "Заказ отклонён");
      log.info(`order ${id}: payment rejected by ${who}`);
      rejectPayment(id);
      return;
    case "retry":
      await answerCallback(q.id, "Повторяю…");
      await sendToDonix(id);
      return;
    case "refund":
      await answerCallback(q.id, "Отмечено: деньги возвращены");
      markCustomerRefunded(id);
      return;
    default:
      await answerCallback(q.id);
  }
}

const announced = new Set<number>();

async function handleStranger(msg: NonNullable<TgUpdate["message"]>): Promise<void> {
  const from = msg.from;
  if (!from) return;
  const name = displayName(from);
  const [cmd = "", code = ""] = (msg.text ?? "").trim().split(/\s+/);

  if (cmd.toLowerCase() === "/claim") {
    const r = claimSuperadmin(from.id, name, code);
    if (r === "ok") return void (await sendMessage(msg.chat.id, `👑 Готово! Вы — суперадмин Itachi Store.\n\n${HELP}${SUPER_HELP}`));
    await sendMessage(msg.chat.id, r === "taken" ? "Суперадмин уже назначен." : "Неверный код.");
    return;
  }

  await sendMessage(msg.chat.id, `Это служебный бот Itachi Store.\nВаш Telegram ID: <code>${from.id}</code>\nПередайте его владельцу магазина, чтобы получить доступ.`);
  const boss = getSuperadmin();
  if (boss && !announced.has(from.id)) {
    announced.add(from.id);
    await sendMessage(boss.tg_id, `👤 ${esc(name)} (<code>${from.id}</code>) написал боту.`, [
      [{ text: "➕ Сделать админом", callback_data: `addadmin:${from.id}:${name.slice(0, 30)}` }],
    ]).catch(() => {});
  }
}

async function handleLoginStart(msg: NonNullable<TgUpdate["message"]>, code: string): Promise<void> {
  if (!getAdmin(msg.from?.id)) {
    await sendMessage(msg.chat.id, `Вход в админку доступен только админам.\nВаш Telegram ID: <code>${msg.from?.id}</code>`);
    return;
  }
  const req = findLoginByCode(code);
  if (!req || req.status !== "pending") return void (await sendMessage(msg.chat.id, "⌛ Ссылка входа устарела. Нажмите «Войти» на сайте ещё раз."));
  await sendMessage(
    msg.chat.id,
    [
      "🔐 <b>Вход в админку Itachi Store</b>",
      `IP: <code>${esc(req.ip)}</code>`,
      `Браузер: ${esc(req.userAgent.slice(0, 120))}`,
      "",
      "Подтвердить? <b>Если это не вы — нажмите «Нет»</b> и никому не пересылайте ссылки входа.",
    ].join("\n"),
    [[{ text: "✅ Да, это я", callback_data: `login_ok:${code}` }, { text: "🚫 Нет", callback_data: `login_no:${code}` }]],
  );
}

async function handleUpdate(u: TgUpdate): Promise<void> {
  if (u.callback_query) return handleCallback(u.callback_query);
  const msg = u.message;
  if (!msg?.text || !msg.from) return;
  const login = msg.text.match(/^\/start\s+login_([A-Za-z0-9]+)$/);
  if (login) return handleLoginStart(msg, login[1]);
  if (!getAdmin(msg.from.id)) return handleStranger(msg);
  await handleCommand(msg.chat.id, msg.from.id, msg.text);
}

export function startBot(): void {
  if (!config.telegram.token) {
    log.warn("TELEGRAM_BOT_TOKEN не задан — бот выключен");
    return;
  }
  prepareClaimCode();

  let queue = Promise.resolve();
  orderEvents.on("event", (e) => {
    queue = queue.then(() => onOrderEvent(e)).catch((err) => log.error("bot event failed", err));
  });

  setInterval(() => {
    for (const o of ordersNeedingReminder()) {
      queue = queue
        .then(() => toAdmins(`⏰ Заказ <b>#${o.id}</b> (${som(o.amount)}) ждёт проверки оплаты уже 10 минут!`))
        .then(() => undefined)
        .catch((err) => log.error("reminder failed", err));
    }
  }, 60_000).unref();

  void (async () => {
    try {
      const me = await tg<{ username: string }>("getMe");
      botUsername = me.username;
      await tg("setMyCommands", {
        commands: [
          { command: "orders", description: "Заказы на проверке" },
          { command: "problems", description: "Заказы с ошибками" },
          { command: "balance", description: "Баланс Donix" },
          { command: "stats", description: "Статистика за сегодня" },
          { command: "rates", description: "Курсы и наценка" },
          { command: "help", description: "Все команды" },
        ],
      });
      log.info(`Telegram-бот @${me.username} запущен`);
    } catch (e) {
      log.error("Telegram: не удалось запустить бота — проверьте токен", (e as Error).message);
      return;
    }
    let offset = 0;
    for (;;) {
      try {
        const updates = await tg<TgUpdate[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] }, 40_000);
        for (const u of updates) {
          offset = u.update_id + 1;
          await handleUpdate(u).catch((e) => log.error("bot update failed", e));
        }
      } catch (e) {
        log.warn("Telegram polling error", (e as Error).message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();
}
