import { useEffect, useState } from "react";
import { findGame } from "../data/games";
import { api, type Order, type OrderStatus } from "../lib/api";
import { PAY_CURRENCY, formatMoney } from "../lib/currency";

const formatReceiptDate = (d: Date) =>
  `${d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).replace(/\s?г\.$/, "")} г. в ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;

const STATUS_VIEW: Record<OrderStatus, { title: string; text: string; tone: "ok" | "wait" | "bad" }> = {
  awaiting_payment: { title: "Ждём оплату", text: "Оплати заказ по QR и нажми «Я оплатил»", tone: "wait" },
  payment_check: { title: "Заявка отправлена", text: "Проверяем оплату — это займёт несколько минут", tone: "wait" },
  processing: { title: "Оплата подтверждена", text: "Пополняем аккаунт — обычно 1–5 минут", tone: "wait" },
  completed: { title: "Готово!", text: "Пополнение зачислено на аккаунт", tone: "ok" },
  problem: { title: "Небольшая задержка", text: "Возникла проблема при пополнении — мы уже разбираемся и напишем тебе", tone: "wait" },
  refunded: { title: "Деньги возвращены", text: "Пополнить не получилось, деньги отправлены тебе обратно", tone: "bad" },
  rejected: { title: "Оплата не найдена", text: "Мы не нашли твой перевод. Если ты оплатил — напиши в поддержку", tone: "bad" },
  expired: { title: "Заказ отменён", text: "Время на оплату истекло", tone: "bad" },
};

const FINAL: OrderStatus[] = ["completed", "refunded", "rejected", "expired"];

interface Props {
  order: Order;
  onNew?: () => void;
}

/** Чек заказа с живым статусом (опрашивает сервер, пока заказ не завершён). */
export default function OrderReceipt({ order: initial, onNew }: Props) {
  const [order, setOrder] = useState(initial);
  const game = findGame(order.game);
  const view = STATUS_VIEW[order.status];

  useEffect(() => setOrder(initial), [initial]);

  useEffect(() => {
    if (FINAL.includes(order.status)) return;
    const t = setInterval(() => {
      api.getOrder(order.id).then(setOrder).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [order.id, order.status]);

  return (
    <div className={`order-done order-done--${view.tone}`}>
      <div className="order-done__head">
        <div className="order-done__check" aria-hidden="true">
          {view.tone === "ok" && (
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
          {view.tone === "wait" && <span className="order-done__spinner" />}
          {view.tone === "bad" && (
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          )}
        </div>
        <h3>{view.title}</h3>
        <p role="status" aria-live="polite">
          {view.text}
        </p>
      </div>
      <div className="order-done__number">
        <span>Номер заказа</span>
        <b>#{order.id}</b>
      </div>
      <dl className="order-done__rows">
        <div>
          <dt>Товар</dt>
          <dd>{order.productName}</dd>
        </div>
        <div>
          <dt>Игра</dt>
          <dd>{game?.title ?? order.game}</dd>
        </div>
        {(game?.fields ?? []).map((f) => (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd className="order-done__mono">{order.fields[f.key]}</dd>
          </div>
        ))}
        {order.nickname && (
          <div>
            <dt>Игрок</dt>
            <dd>{order.nickname}</dd>
          </div>
        )}
        <div>
          <dt>Дата</dt>
          <dd>{formatReceiptDate(new Date(order.createdAt))}</dd>
        </div>
      </dl>
      <div className="order-done__total">
        <span>Сумма заказа</span>
        <b>{formatMoney(order.amount, PAY_CURRENCY)}</b>
      </div>
      <p className="order-done__note">
        Сохрани номер заказа. Статус обновляется сам. Вопросы — <a href="https://t.me/itachishop_support" target="_blank" rel="noreferrer">@itachishop_support</a>
      </p>
      {onNew && (
        <button type="button" className="btn btn--primary" onClick={onNew}>
          Новый заказ
        </button>
      )}
    </div>
  );
}
