import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Me } from "./api";
import Login from "./pages/Login";
import Orders from "./pages/Orders";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "guest" | "in" | "offline">("loading");

  const check = useCallback(() => {
    api
      .me()
      .then((m) => {
        setMe(m);
        setState("in");
      })
      .catch((e: ApiError) => setState(e.status === 401 ? "guest" : "offline"));
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const logout = async () => {
    await api.logout().catch(() => {});
    setMe(null);
    setState("guest");
  };

  if (state === "loading") return <div className="center-note">Загрузка…</div>;
  if (state === "offline")
    return (
      <div className="center-note">
        Сервер недоступен. <button className="btn btn--ghost" onClick={check}>Повторить</button>
      </div>
    );
  if (state === "guest" || !me) return <Login onLoggedIn={check} />;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo">写</span>
          <span className="topbar__wordmark">
            ITACHI <b>ADMIN</b>
          </span>
        </div>
        <nav className="topbar__nav" aria-label="Разделы">
          <span className="topbar__link topbar__link--active">Заказы</span>
          <span className="topbar__link topbar__link--soon" title="Скоро">Товары</span>
          <span className="topbar__link topbar__link--soon" title="Скоро">Промокоды</span>
          {me.role === "superadmin" && <span className="topbar__link topbar__link--soon" title="Скоро">Админы</span>}
        </nav>
        <div className="topbar__me">
          <span className="topbar__role">{me.role === "superadmin" ? "👑 Суперадмин" : "🛡 Админ"}</span>
          <span className="topbar__name">{me.name ?? me.tgId}</span>
          <button className="btn btn--ghost btn--sm" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>
      <main className="content">
        <Orders onUnauthorized={() => setState("guest")} />
      </main>
    </div>
  );
}
