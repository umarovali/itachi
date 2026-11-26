import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import SiteHeader from "./components/SiteHeader";
import Snowfall from "./components/Snowfall";
import WinterDecor from "./components/Winter";
import { WINTER_THEME } from "./config";
import { I18nProvider } from "./lib/i18n";
import { StoreProvider } from "./lib/store";
import GamePage from "./pages/GamePage";
import Home from "./pages/Home/Home";
import OrderPage from "./pages/OrderPage";

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <I18nProvider>
    <StoreProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <div className={`page ${WINTER_THEME ? "page--winter" : ""}`}>
          {WINTER_THEME && <WinterDecor />}
          <SiteHeader />
          <main className="site-main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/order/:id" element={<OrderPage />} />
              <Route path="/:slug" element={<GamePage />} />
            </Routes>
          </main>
          <Footer />
        </div>
        {WINTER_THEME && <Snowfall />}
      </BrowserRouter>
    </StoreProvider>
    </I18nProvider>
  );
}
