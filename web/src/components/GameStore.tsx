import { GemCluster } from "./Icons";
import { WinterHero } from "./Winter";
import { useEffect, useMemo, useState } from "react";
import type { Game } from "../data/games";
import { PAY_LINK, PAY_METHOD_ID } from "../data/payment-methods";
import { clearActiveOrder, loadActiveOrder, saveActiveOrder } from "../lib/active-order";
import { api, type Order, type Product } from "../lib/api";
import { PAY_CURRENCY, formatMoney } from "../lib/currency";
import { trText, useI18n } from "../lib/i18n";
import { useStore } from "../lib/store";
import OrderReceipt from "./OrderReceipt";
import ProductCard from "./ProductCard";
import ReceiptPicker from "./ReceiptPicker";
import Stepper from "./Stepper";

const TELEGRAM_RE = /^@[A-Za-z0-9_]{5,32}$/;

function useCountdown(until: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const left = Math.max(0, new Date(until).getTime() - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { expired: left === 0, text: `${m}:${String(s).padStart(2, "0")}` };
}

type Validation = { state: "idle" } | { state: "checking" } | { state: "ok"; nickname: string; key: string } | { state: "error"; message: string };

export default function GameStore({ game }: { game: Game }) {
  const { catalog, catalogError, currency, priceOf, display } = useStore();
  const { t, lang } = useI18n();

  const gameProducts = useMemo(() => catalog?.products.filter((p) => p.game === game.slug) ?? [], [catalog, game.slug]);
  const groups = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of gameProducts) {
      const key = trText(game.groupLabels[p.type] ?? "Товары");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()];
  }, [gameProducts, game.groupLabels, lang]);

  const [selected, setSelected] = useState<Product | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [telegram, setTelegram] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState("");
  const [validation, setValidation] = useState<Validation>({ state: "idle" });
  const [step, setStep] = useState(1);
  const [order, setOrder] = useState<Order | null>(null);
  const [senderName, setSenderName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const countdown = useCountdown(step === 2 ? order?.expiresAt : undefined);

  useEffect(() => {
    resetForm();
    const savedId = loadActiveOrder(game.slug);
    if (!savedId) return;
    let alive = true;
    api
      .getOrder(savedId)
      .then((o) => {
        if (!alive) return;
        if (o.status === "awaiting_payment" && new Date(o.expiresAt).getTime() > Date.now()) {
          setOrder(o);
          setStep(2);
        } else if (o.status !== "expired") {
          setOrder(o);
          setStep(3);
        } else clearActiveOrder();
      })
      .catch(() => clearActiveOrder());
    return () => {
      alive = false;
    };
  }, [game.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const fieldsKey = game.fields.map((f) => (fields[f.key] ?? "").trim()).join("|");
  const fieldsFilled = game.fields.every((f) => (fields[f.key] ?? "").trim());
  const validated = validation.state === "ok" && validation.key === fieldsKey;

  const basePrice = selected ? priceOf(selected) : null;
  const finalPrice = basePrice !== null ? Math.round(basePrice * (1 - (promo?.percent ?? 0) / 100)) : null;

  const updateField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  const checkPlayer = async () => {
    if (!fieldsFilled) return setValidation({ state: "error", message: t("err.fillPlayer") });
    setValidation({ state: "checking" });
    try {
      const sku = (selected ?? gameProducts[0])?.sku;
      if (!sku) return setValidation({ state: "error", message: t("err.catalogWait") });
      const res = await api.validatePlayer(game.slug, sku, fields);
      setValidation(res.ok && res.nickname ? { state: "ok", nickname: res.nickname, key: fieldsKey } : { state: "error", message: res.error ?? t("err.idNotFound") });
    } catch (e) {
      setValidation({ state: "error", message: (e as Error).message || t("err.checkFailed") });
    }
  };

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoMsg(t("checking"));
    const res = await api.checkPromo(code).catch((e: Error) => ({ ok: false, error: e.message, discountPercent: 0 }));
    if (res.ok && res.discountPercent) {
      setPromo({ code, percent: res.discountPercent });
      setPromoMsg(t("promo.ok", { p: res.discountPercent }));
    } else {
      setPromo(null);
      setPromoMsg(res.error ?? t("promo.fail"));
    }
  };

  const goToPayment = async () => {
    if (!selected) return setStatus(t("err.selectItem"));
    if (!fieldsFilled) return setStatus(t("err.fillPlayer"));
    if (!validated) return setStatus(t("err.pressCheck"));
    if (!TELEGRAM_RE.test(telegram.trim())) return setStatus(t("err.telegram"));
    setStatus("");
    setBusy(true);
    try {
      const created = await api.createOrder({
        game: game.slug,
        sku: selected.sku,
        fields,
        telegram: telegram.trim(),
        displayCurrency: currency,
        promoCode: promo?.code,
      });
      setOrder(created);
      saveActiveOrder(game.slug, created.id);
      setStep(2);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmPaid = async () => {
    if (!order) return;
    if (!order.hasReceipt) return setStatus(t("err.receipt"));
    if (senderName.trim().length < 2) return setStatus(t("err.sender"));
    setStatus("");
    setBusy(true);
    try {
      setOrder(await api.markPaid(order.id, senderName.trim(), PAY_METHOD_ID));
      setStep(3);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    if (order) await api.cancelOrder(order.id).catch(() => {});
    reset();
  };

  function reset() {
    clearActiveOrder();
    resetForm();
  }

  function resetForm() {
    setSelected(null);
    setFields({});
    setTelegram("");
    setPromoCode("");
    setPromo(null);
    setPromoMsg("");
    setValidation({ state: "idle" });
    setStep(1);
    setOrder(null);
    setSenderName("");
    setStatus("");
  }

  const foreign = currency !== PAY_CURRENCY;

  return (
    <div className={`game-store game-store--${game.accent}`}>
      <section className="game-store__hero">
        <div className="game-store__copy">
          <span className="eyebrow">FaaPay / {game.shortTitle}</span>
          <h1>
            {t("gs.title").split("{game}").flatMap((part, i) => (i === 0 ? [part] : [<span key={i}>{game.title}</span>, part]))}
          </h1>
          <p>{trText(game.description)} {t("gs.desc")}</p>
        </div>
        <GemCluster />
        <WinterHero />
      </section>

      <section className="game-store__catalog">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t("nav.catalog")}</span>
            <h2>{t("catalog.pick")}</h2>
          </div>
          <span className="game-store__count">{t("catalog.count", { n: gameProducts.length })}</span>
        </div>
        {catalogError && <div className="status status--warn">{t("catalog.error")}</div>}
        {!catalog && !catalogError && <div className="status">{t("catalog.loading")}</div>}
        {groups.map(([title, items]) => (
          <div className="game-store__group" key={title}>
            <h3>{title}</h3>
            <div className="game-store__grid">
              {items.map((product) => (
                <ProductCard
                  key={product.sku}
                  product={product}
                  active={selected?.sku === product.sku}
                  onSelect={(p) => {
                    if (step !== 1) return;
                    setSelected(p);
                    setStatus("");
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="game-store__order" id="checkout">
        <div className="section-head">
          <div>
            <span className="eyebrow">Checkout</span>
            <h2>{t("checkout.title")}</h2>
          </div>
        </div>
        <Stepper current={step} />

        {step === 1 && (
          <>
            <div className="order-summary">
              {selected ? (
                <>
                  <strong>{selected.name}</strong>
                  <span>
                    {basePrice === null || finalPrice === null ? "…" : promo ? (
                      <>
                        <s>{display(basePrice)}</s> <b>{display(finalPrice)}</b>
                      </>
                    ) : (
                      display(basePrice)
                    )}
                  </span>
                </>
              ) : (
                <span>{t("none")}</span>
              )}
            </div>

            <div className="order-form">
              {game.fields.map((field) => (
                <label key={field.key}>
                  <span>{trText(field.label)}</span>
                  <input
                    value={fields[field.key] ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    placeholder={trText(field.placeholder)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              ))}

              <div className="player-check">
                <button type="button" className="btn btn--ghost" onClick={checkPlayer} disabled={validation.state === "checking" || !fieldsFilled}>
                  {validation.state === "checking" ? t("checking") : t("check")}
                </button>
                {validated && validation.state === "ok" && (
                  <span className="player-check__ok">
                    ✓ {t("player")} <b>{validation.nickname}</b>
                  </span>
                )}
                {validation.state === "ok" && !validated && <span className="player-check__warn">{t("changed")}</span>}
                {validation.state === "error" && <span className="player-check__warn">{validation.message}</span>}
              </div>

              <label>
                <span>{t("promo.label")}</span>
                <div className="promo-row">
                  <input
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      setPromo(null);
                      setPromoMsg("");
                    }}
                    placeholder={t("promo.ph")}
                    autoComplete="off"
                  />
                  <button type="button" className="btn btn--ghost" onClick={applyPromo} disabled={!promoCode.trim()}>
                    OK
                  </button>
                </div>
              </label>
              <label>
                <span>
                  Telegram <em>{t("tg.required")}</em>
                </span>
                <input
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value.replace(/\s/g, ""))}
                  placeholder="@username"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={33}
                />
              </label>
              {promoMsg && <div className={`status ${promo ? "status--ok" : "status--warn"}`}>{promoMsg}</div>}

              <button type="button" className="btn btn--primary" onClick={goToPayment} disabled={busy}>
                {busy ? t("btn.creating") : t("btn.toPay")}
              </button>
            </div>
          </>
        )}

        {step === 2 && order && (
          <div className="payment-box">
            <p>{t("pay.instr")}</p>
            <div className="payment-box__amount">{formatMoney(order.amount, PAY_CURRENCY)}</div>
            {foreign && <div className="payment-box__approx">{display(order.amount)}</div>}
            <div className="payment-box__notice">
              <b>{t("pay.exact")}</b>{t("pay.exactRest")}
              {foreign && <> {t("pay.foreign")}</>}
            </div>

            <a className="btn btn--primary payment-box__pay" href={PAY_LINK} target="_blank" rel="noreferrer">
              {t("pay.btn", { amount: formatMoney(order.amount, PAY_CURRENCY) })}
            </a>
            <small className="payment-box__hint">{t("pay.hint")}</small>

            {countdown && (
              <div className={`payment-box__timer ${countdown.expired ? "payment-box__timer--expired" : ""}`}>
                {countdown.expired ? t("pay.expired") : <>{t("pay.within")} <b>{countdown.text}</b></>}
              </div>
            )}

            <ReceiptPicker
              key={order.id}
              alreadyUploaded={order.hasReceipt}
              disabled={busy || countdown?.expired}
              upload={async (image) => {
                const updated = await api.uploadReceipt(order.id, image);
                setOrder(updated);
                setStatus("");
              }}
            />

            <label className="payment-box__sender">
              <span>{t("sender.label")}</span>
              <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder={t("sender.ph")} autoComplete="off" maxLength={60} />
            </label>

            <button type="button" className="btn btn--primary" onClick={confirmPaid} disabled={busy || countdown?.expired}>
              {busy ? t("pay.sending") : t("pay.paid")}
            </button>
            <button type="button" className="btn btn--ghost" onClick={cancelOrder} disabled={busy}>
              {t("pay.cancel")}
            </button>
          </div>
        )}

        {step === 3 && order && <OrderReceipt order={order} onNew={reset} />}

        {status && <div className="status status--warn">{status}</div>}
      </section>
    </div>
  );
}
