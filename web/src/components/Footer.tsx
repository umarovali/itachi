export default function Footer() {
  return (
    <footer className="site-footer">
      <div>
        Itachi Store © {new Date().getFullYear()} <span>•</span> Digital Game Store
      </div>
      <div className="site-footer__support">
        🛟 Поддержка 24/7:{" "}
        <a href="https://t.me/itachishop_support" target="_blank" rel="noreferrer">@itachishop_support</a>,{" "}
        <a href="https://t.me/saliev_09" target="_blank" rel="noreferrer">@saliev_09</a>
      </div>
      <a className="site-footer__channel" href="https://t.me/+CupXqM_28Bc4Njky" target="_blank" rel="noreferrer">
        🎁 Всякие розыгрыши промокоды тут !
      </a>
    </footer>
  );
}
