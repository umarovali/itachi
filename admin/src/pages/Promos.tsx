import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Promo } from "../api";

const EMPTY = { code: "", percent: "", maxUses: "" };

export default function Promos({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [list, setList] = useState<Promo[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setMsg({ ok: false, text: (e as Error).message });
    },
    [onUnauthorized],
  );

  const load = useCallback(() => api.promos().then(setList).catch(fail), [fail]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const p = await api.savePromo({
        code: form.code,
        percent: Number(form.percent.replace(",", ".")),
        maxUses: form.maxUses.trim() ? Number(form.maxUses) : null,
      });
      setMsg({ ok: true, text: `Промокод ${p.code} сохранён: −${p.percent}%` });
      setForm(EMPTY);
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await load();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="promos">
      <form
        className="promo-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <h2>Новый промокод</h2>
        <label>
          <span>Код</span>
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
            placeholder="ITACHI10"
            maxLength={30}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          <span>Скидка, %</span>
          <input value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} placeholder="10" inputMode="decimal" />
        </label>
        <label>
          <span>Лимит использований</span>
          <input value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value.replace(/\D/g, "") })} placeholder="пусто — без лимита" inputMode="numeric" />
        </label>
        <button type="submit" className="btn btn--primary" disabled={busy || !form.code.trim() || !form.percent.trim()}>
          Сохранить
        </button>
        <small>Если такой код уже есть — у него обновятся скидка и лимит, и он снова включится.</small>
      </form>

      {msg && <div className={`note ${msg.ok ? "note--ok" : "note--bad"}`}>{msg.text}</div>}

      <section className="promo-list" aria-label="Промокоды">
        {list === null && <div className="note">Загрузка…</div>}
        {list?.length === 0 && <div className="note">Промокодов пока нет</div>}
        {list?.map((p) => (
          <div key={p.code} className={`promo-row ${p.active ? "" : "promo-row--off"}`}>
            <b className="mono">{p.code}</b>
            <span className="promo-row__pct">−{p.percent}%</span>
            <span className="promo-row__uses">
              использован {p.used}
              {p.maxUses !== null ? ` из ${p.maxUses}` : " · без лимита"}
            </span>
            <span className={`pill ${p.active && (p.maxUses === null || p.used < p.maxUses) ? "pill--ok" : "pill--muted"}`}>
              {!p.active ? "выключен" : p.maxUses !== null && p.used >= p.maxUses ? "закончился" : "работает"}
            </span>
            <div className="promo-row__actions">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={busy}
                onClick={() => setForm({ code: p.code, percent: String(p.percent), maxUses: p.maxUses === null ? "" : String(p.maxUses) })}
              >
                Изменить
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => run(() => api.setPromoActive(p.code, !p.active))}>
                {p.active ? "Выключить" : "Включить"}
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={busy}
                onClick={() => window.confirm(`Удалить промокод ${p.code}?`) && run(() => api.deletePromo(p.code))}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
