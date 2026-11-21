import { Link } from "react-router-dom";
import CurrencySwitcher from "./CurrencySwitcher";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="site-header__brand" to="/" aria-label="Itachi Store — на главную">
        <span className="site-header__logo">写</span>
        <span className="site-header__wordmark">ITACHI <b>STORE</b></span>
      </Link>
      <CurrencySwitcher />
    </header>
  );
}
