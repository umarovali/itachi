import { useEffect, useRef, useState } from "react";
import { LANGS, useI18n } from "../lib/i18n";
import Flag from "./Flag";

export default function LangSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === lang)!;

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
    <div className="currency-switch lang-switch" ref={ref}>
      <button type="button" className="currency-switch__toggle" aria-haspopup="listbox" aria-expanded={open} aria-label={`${t("lang.label")}: ${current.native}`} onClick={() => setOpen((v) => !v)}>
        <Flag lang={lang} />
        <span>{current.short}</span>
        <span className="currency-switch__chevron" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="currency-switch__menu" role="listbox" aria-label={t("lang.label")}>
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === lang}
                className={`currency-switch__option ${l.code === lang ? "currency-switch__option--active" : ""}`}
                onClick={() => { setLang(l.code); setOpen(false); }}
              >
                <Flag lang={l.code} size={22} />
                <span className="currency-switch__name">{l.native}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
