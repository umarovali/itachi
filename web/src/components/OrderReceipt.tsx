import { useEffect, useState } from "react";
import { findGame } from "../data/games";
import { api, type Order, type OrderStatus } from "../lib/api";
import { PAY_CURRENCY, formatMoney } from "../lib/currency";
import { trText, useI18n } from "../lib/i18n";

const formatReceiptDate = (d: Date, locale: string) =>
  d.toLocaleString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

const TONES: Record<OrderStatus, "ok" | "wait" | "bad"> = {
  awaiting_payment: "wait",
  payment_check: "wait",
  processing: "wait",
  completed: "ok",
  problem: "wait",
  refunded: "bad",
  rejected: "bad",
  expired: "bad",
};

const FINAL: OrderStatus[] = ["completed", "refunded", "rejected", "expired"];

interface Props {
  order: Order;
  onNew?: () => void;
}

export default function OrderReceipt({ order: initial, onNew }: Props) {
  const [order, setOrder] = useState(initial);
  const game = findGame(order.game);
  const { t, locale } = useI18n();
  const view = { title: t(`st.${order.status}.title`), text: t(`st.${order.status}.text`), tone: TONES[order.status] };

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
        <span>{t("order.number")}</span>
        <b>#{order.id}</b>
      </div>
      <dl className="order-done__rows">
        <div>
          <dt>{t("order.item")}</dt>
          <dd>{order.productName}</dd>
        </div>
        <div>
          <dt>{t("order.game")}</dt>
          <dd>{game?.title ?? order.game}</dd>
        </div>
        {(game?.fields ?? []).map((f) => (
          <div key={f.key}>
            <dt>{trText(f.label)}</dt>
            <dd className="order-done__mono">{order.fields[f.key]}</dd>
          </div>
        ))}
        {order.nickname && (
          <div>
            <dt>{t("order.player")}</dt>
            <dd>{order.nickname}</dd>
          </div>
        )}
        <div>
          <dt>{t("order.date")}</dt>
          <dd>{formatReceiptDate(new Date(order.createdAt), locale)}</dd>
        </div>
      </dl>
      <div className="order-done__total">
        <span>{t("order.total")}</span>
        <b>{formatMoney(order.amount, PAY_CURRENCY)}</b>
      </div>
      <p className="order-done__note">
        {t("order.note")} <a href="https://t.me/faapay_support" target="_blank" rel="noreferrer">@faapay_support</a>
      </p>
      {onNew && (
        <button type="button" className="btn btn--primary" onClick={onNew}>
          {t("order.new")}
        </button>
      )}
    </div>
  );
}
