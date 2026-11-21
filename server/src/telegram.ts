/** Минимальный клиент Telegram Bot API (без сторонних библиотек). */
import { config } from "./config.ts";

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}
export type Keyboard = InlineButton[][];

export interface TgUpdate {
  update_id: number;
  message?: { message_id: number; chat: { id: number }; from?: { id: number; username?: string }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number; username?: string; first_name?: string };
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
}

export class TelegramError extends Error {}

export async function tg<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 20_000): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${config.telegram.token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new TelegramError(`${method}: ${data.description}`);
  return data.result as T;
}

export const sendMessage = (chatId: number, text: string, keyboard?: Keyboard) =>
  tg<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });

export const editMessage = (chatId: number, messageId: number, text: string, keyboard?: Keyboard) =>
  tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  }).catch((e: Error) => {
    if (!e.message.includes("message is not modified")) throw e;
  });

/** Отправить картинку (чек) из файла. */
export async function sendPhoto(chatId: number, data: Buffer, filename: string, caption: string): Promise<{ message_id: number }> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("photo", new Blob([new Uint8Array(data)]), filename);
  const res = await fetch(`https://api.telegram.org/bot${config.telegram.token}/sendPhoto`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
  const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!json.ok) throw new TelegramError(`sendPhoto: ${json.description}`);
  return json.result!;
}

export const answerCallback = (id: string, text?: string, alert = false) => tg("answerCallbackQuery", { callback_query_id: id, text, show_alert: alert });

/** Экранирование для parse_mode=HTML — данные покупателя всегда прогоняем через это. */
export const esc = (s: unknown): string => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
