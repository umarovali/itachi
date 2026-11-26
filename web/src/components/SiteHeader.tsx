import { Link, NavLink } from "react-router-dom";
import CurrencySwitcher from "./CurrencySwitcher";
import LangSwitcher from "./LangSwitcher";
import ThemeToggle from "./ThemeToggle";
import { useI18n } from "../lib/i18n";
import { IconGrid, IconHeadset, IconHome, IconSend } from "./Icons";

const CHANNEL = "https://t.me/+CupXqM_28Bc4Njky";
const SUPPORT = "https://t.me/faapay_support";

export default function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="site-header">
      <Link className="site-header__brand" to="/" aria-label={t("aria.home")}>
        <span className="site-header__name">
          <span className="site-header__wordmark">FaaPay</span>
          <span className="site-header__tag">{t("tagline")}</span>
        </span>
      </Link>

      <nav className="site-header__nav" aria-label={t("aria.menu")}>
        <NavLink to="/" end className={({ isActive }) => `site-header__link ${isActive ? "is-active" : ""}`}>
          <IconHome size={18} /> {t("nav.home")}
        </NavLink>
        <Link to="/#games" className="site-header__link"><IconGrid size={18} /> {t("nav.catalog")}</Link>
        <a href={SUPPORT} target="_blank" rel="noreferrer" className="site-header__link"><IconHeadset size={18} /> {t("nav.support")}</a>
      </nav>

      <div className="site-header__actions">
        <ThemeToggle />
        <LangSwitcher />
        <CurrencySwitcher />
        <a className="site-header__tg" href={CHANNEL} target="_blank" rel="noreferrer" aria-label={t("aria.channel")}>
          <IconSend size={17} /> <span>Telegram</span>
        </a>
      </div>
    </header>
  );
}
