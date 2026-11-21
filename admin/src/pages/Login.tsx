import { useEffect, useRef, useState } from "react";
import { api } from "../api";

type State =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "waiting"; botUrl: string; requestId: string }
  | { kind: "error"; message: string };

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const timer = useRef<number>();

  useEffect(() => () => window.clearInterval(timer.current), []);

  const start = async () => {
    setState({ kind: "starting" });
    // Окно открываем сразу (по клику), иначе браузер заблокирует всплывающее окно.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null; // открытая страница не получит доступа к админке
    try {
      const { requestId, botUrl } = await api.loginStart();
      if (tab) tab.location.href = botUrl;
      setState({ kind: "waiting", botUrl, requestId });
      window.clearInterval(timer.current);
      timer.current = window.setInterval(async () => {
        try {
          const { status } = await api.loginPoll(requestId);
          if (status === "approved") {
            window.clearInterval(timer.current);
            onLoggedIn();
          } else if (status === "rejected" || status === "expired") {
            window.clearInterval(timer.current);
            setState({ kind: "error", message: status === "rejected" ? "Вход отклонён в Telegram." : "Время на вход истекло. Попробуй ещё раз." });
          }
        } catch {
          /* временная ошибка сети — пробуем дальше */
        }
      }, 2000);
    } catch (e) {
      tab?.close();
      setState({ kind: "error", message: (e as Error).message });
    }
  };

  return (
    <div className="login">
      <div className="login__card">
        <span className="login__logo">写</span>
        <h1>
          ITACHI <span>ADMIN</span>
        </h1>
        <p className="login__lead">Вход через Telegram-бота магазина. Доступ есть только у админов.</p>

        {state.kind !== "waiting" && (
          <button className="btn btn--primary btn--wide" onClick={start} disabled={state.kind === "starting"}>
            {state.kind === "starting" ? "Готовлю вход…" : "Войти через Telegram"}
          </button>
        )}

        {state.kind === "waiting" && (
          <div className="login__waiting" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>
              Открой бота и нажми <b>«✅ Да, это я»</b>.
              <br />
              Страница войдёт сама.
            </p>
            <a className="btn btn--ghost btn--wide" href={state.botUrl} target="_blank" rel="noreferrer">
              Открыть бота ещё раз
            </a>
            <button className="btn btn--link" onClick={() => { window.clearInterval(timer.current); setState({ kind: "idle" }); }}>
              Отмена
            </button>
          </div>
        )}

        {state.kind === "error" && <p className="login__error">{state.message}</p>}
      </div>
    </div>
  );
}
