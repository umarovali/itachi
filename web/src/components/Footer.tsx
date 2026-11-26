import { useI18n } from "../lib/i18n";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div>
        FaaPay © {new Date().getFullYear()} <span>•</span> Digital Game Store
      </div>
      <div className="site-footer__support">
        🛟 {t("footer.support")}{" "}
        <a href="https://t.me/faapay_support" target="_blank" rel="noreferrer">@faapay_support</a>,{" "}
        <a href="https://t.me/saliev_09" target="_blank" rel="noreferrer">@saliev_09</a>
      </div>
      <a className="site-footer__channel" href="https://t.me/+CupXqM_28Bc4Njky" target="_blank" rel="noreferrer">
        🎁 {t("footer.channel")}
      </a>
    </footer>
  );
}
