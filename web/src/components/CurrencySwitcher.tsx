import { useEffect, useRef, useState } from "react";
import { CURRENCIES, CURRENCY_LIST } from "../lib/currency";
import { useI18n } from "../lib/i18n";
import { useStore } from "../lib/store";

export default function CurrencySwitcher() {
  const { currency, setCurrency } = useStore();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = CURRENCIES[currency];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="currency-switch" ref={ref}>
      <button
        type="button"
        className="currency-switch__toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("cur.label", { name: t(`cur.${current.code}`) })}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current.code}</span>
        <span className="currency-switch__current-symbol">{t(`cur.sym.${current.code}`)}</span>
        <span className="currency-switch__chevron" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="currency-switch__menu" role="listbox" aria-label={t("cur.choose")}>
          {CURRENCY_LIST.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                role="option"
                aria-selected={c.code === currency}
                className={`currency-switch__option ${c.code === currency ? "currency-switch__option--active" : ""}`}
                onClick={() => {
                  setCurrency(c.code);
                  setOpen(false);
                }}
              >
                <span className="currency-switch__code">{c.code}</span>
                <span className="currency-switch__name">{t(`cur.${c.code}`)}</span>
                <span className="currency-switch__symbol">{t(`cur.sym.${c.code}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
