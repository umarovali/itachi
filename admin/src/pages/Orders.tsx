import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type AdminOrder, type RawStatus, type Summary } from "../api";

const GAME_TITLES: Record<string, string> = {
  "free-fire": "Free Fire",
  pubg: "PUBG Mobile",
  "mobile-legends": "Mobile Legends",
  roblox: "Roblox",
  "genshin-impact": "Genshin Impact",
  "standoff-2": "Standoff 2",
};
const FIELD_LABELS: Record<string, string> = { uid: "ID игрока", server: "Сервер" };

const STATUS: Record<RawStatus, { label: string; tone: "wait" | "warn" | "ok" | "bad" | "muted" }> = {
  awaiting_payment: { label: "Ждём оплату", tone: "muted" },
  payment_check: { label: "Проверить оплату", tone: "warn" },
  confirmed: { label: "Не ушёл в Donix", tone: "bad" },
  sending: { label: "Отправляется", tone: "wait" },
  processing: { label: "Donix выполняет", tone: "wait" },
  completed: { label: "Выполнен", tone: "ok" },
  failed: { label: "Ошибка Donix", tone: "bad" },
  refunded: { label: "Возврат Donix", tone: "bad" },
  customer_refunded: { label: "Деньги возвращены", tone: "muted" },
  rejected: { label: "Оплата не найдена", tone: "muted" },
  expired: { label: "Истёк", tone: "muted" },
};

const DONIX_ERRORS: Record<string, string> = {
  insufficient_balance: "На балансе Donix не хватает денег — пополни и нажми «Повторить».",
  invalid_uid: "Donix не принял ID игрока.",
  product_not_found: "Товар больше недоступен в Donix.",
  unauthorized: "Неверный API-ключ Donix.",
  network_error: "Donix не ответил — нажми «Повторить».",
};

const FILTERS: { id: string; label: string }[] = [
  { id: "attention", label: "Требуют внимания" },
  { id: "", label: "Все" },
  { id: "awaiting_payment", label: "Ждут оплату" },
  { id: "processing", label: "В работе" },
  { id: "completed", label: "Выполнены" },
  { id: "rejected", label: "Отклонены" },
];

const som = (n: number) => `${n.toLocaleString("ru-RU")} сом`;
const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

type Action = "confirm" | "reject" | "retry" | "refund";
const ACTIONS: Partial<Record<RawStatus, { action: Action; label: string; kind: "primary" | "danger" | "ghost"; confirm?: string }[]>> = {
  payment_check: [
    { action: "confirm", label: "✅ Деньги пришли", kind: "primary" },
    { action: "reject", label: "❌ Не пришли", kind: "danger", confirm: "Отклонить заказ? Покупатель увидит «Оплата не найдена»." },
  ],
  awaiting_payment: [{ action: "confirm", label: "✅ Деньги пришли", kind: "primary", confirm: "Покупатель ещё не нажал «Я оплатил». Точно подтвердить?" }],
  expired: [{ action: "confirm", label: "✅ Деньги всё-таки пришли", kind: "primary", confirm: "Заказ истёк. Точно подтвердить оплату?" }],
  rejected: [{ action: "confirm", label: "↩️ Всё-таки пришли", kind: "primary", confirm: "Подтвердить оплату отклонённого заказа?" }],
  confirmed: [
    { action: "retry", label: "🔁 Повторить", kind: "primary" },
    { action: "refund", label: "💸 Вернул деньги", kind: "ghost", confirm: "Отметить, что деньги возвращены покупателю?" },
  ],
  failed: [
    { action: "retry", label: "🔁 Повторить", kind: "primary" },
    { action: "refund", label: "💸 Вернул деньги", kind: "ghost", confirm: "Отметить, что деньги возвращены покупателю?" },
  ],
  refunded: [
    { action: "retry", label: "🔁 Повторить", kind: "primary" },
    { action: "refund", label: "💸 Вернул деньги", kind: "ghost", confirm: "Отметить, что деньги возвращены покупателю?" },
  ],
};

export default function Orders({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [filter, setFilter] = useState("attention");
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([api.orders(filter, query), api.summary()]);
      setOrders(list);
      setSummary(sum);
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setError((e as Error).message);
    }
  }, [filter, query, onUnauthorized]);

  useEffect(() => {
    const t = window.setTimeout(load, query ? 300 : 0);
    const every = window.setInterval(load, 10_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(every);
    };
  }, [load, query]);

  const opened = orders?.find((o) => o.id === openId) ?? null;
  const attention = (summary?.counts.payment_check ?? 0) + (summary?.counts.confirmed ?? 0) + (summary?.counts.failed ?? 0) + (summary?.counts.refunded ?? 0);

  return (
    <div className="orders">
      {summary && (
        <section className="stats" aria-label="Сводка">
          <div className="stat">
            <span>Donix</span>
            <b>{summary.balance ? `${summary.balance.amount} ${summary.balance.currency}` : "—"}</b>
            <small>{summary.donixMode === "test" ? "⚠️ тестовый режим" : "боевой режим"}</small>
          </div>
          <div className="stat">
            <span>Сегодня выполнено</span>
            <b>{summary.today.orders}</b>
            <small>выручка {som(summary.today.revenue)}</small>
          </div>
          <div className="stat">
            <span>Прибыль сегодня</span>
            <b>≈ {som(summary.today.profit)}</b>
            <small>наценка {summary.markupPercent}%</small>
          </div>
          <div className={`stat ${attention ? "stat--alert" : ""}`}>
            <span>Требуют внимания</span>
            <b>{attention}</b>
            <small>1 $ = {summary.rates.KGS?.toFixed(2)} сом</small>
          </div>
        </section>
      )}

      <section className="toolbar">
        <div className="tabs" role="tablist" aria-label="Фильтр заказов">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={`tab ${filter === f.id ? "tab--active" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
              {f.id === "attention" && attention > 0 && <span className="tab__badge">{attention}</span>}
            </button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Поиск: номер, ID игрока, @telegram, сумма" value={query} onChange={(e) => setQuery(e.target.value)} />
      </section>

      {error && <div className="note note--bad">{error}</div>}
      {!orders && !error && <div className="note">Загрузка…</div>}
      {orders && orders.length === 0 && <div className="note">{filter === "attention" ? "Всё под контролем — ничего не ждёт 👌" : "Заказов нет"}</div>}

      {orders && orders.length > 0 && (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <button className={`order-row ${openId === o.id ? "order-row--open" : ""}`} onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                <span className="order-row__id">#{o.id}</span>
                <span className="order-row__product">
                  <b>{o.productName}</b>
                  <small>{GAME_TITLES[o.game] ?? o.game}</small>
                </span>
                <span className="order-row__amount">{som(o.amount)}</span>
                <span className={`pill pill--${STATUS[o.rawStatus].tone}`}>{STATUS[o.rawStatus].label}</span>
                <span className="order-row__time">{time(o.paidAt ?? o.createdAt)}</span>
              </button>
              {opened?.id === o.id && <OrderDetails order={opened} onChanged={load} onUnauthorized={onUnauthorized} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderDetails({ order: o, onChanged, onUnauthorized }: { order: AdminOrder; onChanged: () => void; onUnauthorized: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const run = async (a: { action: Action; confirm?: string }) => {
    if (a.confirm && !window.confirm(a.confirm)) return;
    setBusy(true);
    setMsg("");
    try {
      await api.action(o.id, a.action);
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="details">
      <div className="details__grid">
        <dl className="details__info">
          {Object.entries(o.fields).map(([k, v]) => (
            <div key={k}>
              <dt>{FIELD_LABELS[k] ?? k}</dt>
              <dd className="mono">{v}</dd>
            </div>
          ))}
          <div>
            <dt>Ник</dt>
            <dd>{o.nickname ?? "—"}</dd>
          </div>
          <div>
            <dt>Сумма к оплате</dt>
            <dd>
              <b>{som(o.amount)}</b>
              {o.payMethod && ` → ${o.payMethod === "obank" ? "O!Bank" : o.payMethod === "elkart" ? "Элкарт" : o.payMethod}`}
              {o.promoCode && ` · промокод ${o.promoCode} −${o.discountPercent}%`}
            </dd>
          </div>
          <div>
            <dt>Отправитель</dt>
            <dd>{o.senderName ?? "—"}</dd>
          </div>
          <div>
            <dt>Покупатель</dt>
            <dd>
              <a href={`https://t.me/${o.telegram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">
                {o.telegram}
              </a>
              {o.displayCurrency !== "KGS" && <small> · смотрел цены в {o.displayCurrency}</small>}
            </dd>
          </div>
          <div>
            <dt>Закупка Donix</dt>
            <dd>
              {o.costUsd} $ · <span className="mono">{o.sku}</span>
            </dd>
          </div>
          <div>
            <dt>Время</dt>
            <dd>
              создан {time(o.createdAt)}
              {o.paidAt && ` · оплатил ${time(o.paidAt)}`}
              {o.confirmedAt && ` · подтверждён ${time(o.confirmedAt)}`}
              {o.finishedAt && ` · завершён ${time(o.finishedAt)}`}
            </dd>
          </div>
          {o.donixOrderId && (
            <div>
              <dt>Donix ID</dt>
              <dd className="mono">{o.donixOrderId}</dd>
            </div>
          )}
        </dl>

        <div className="details__receipt">
          {o.hasReceipt ? (
            <button className="receipt" onClick={() => setZoom(true)} aria-label="Открыть чек крупно">
              <img src={api.receiptUrl(o.id)} alt={`Чек заказа ${o.id}`} loading="lazy" />
            </button>
          ) : (
            <div className="receipt receipt--empty">Чек не прикреплён</div>
          )}
          <small>Сверь сумму {som(o.amount)} в банке — скриншот можно подделать.</small>
        </div>
      </div>

      {o.error && <div className="note note--bad">⚠️ {DONIX_ERRORS[o.error] ?? o.error}</div>}
      {msg && <div className="note note--bad">{msg}</div>}

      {ACTIONS[o.rawStatus] && (
        <div className="details__actions">
          {ACTIONS[o.rawStatus]!.map((a) => (
            <button key={a.action} className={`btn btn--${a.kind}`} disabled={busy} onClick={() => run(a)}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div className="lightbox" role="dialog" aria-label="Чек" onClick={() => setZoom(false)}>
          <img src={api.receiptUrl(o.id)} alt={`Чек заказа ${o.id}`} />
        </div>
      )}
    </div>
  );
}
