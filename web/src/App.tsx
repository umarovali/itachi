import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import SiteHeader from "./components/SiteHeader";
import { StoreProvider } from "./lib/store";
import GamePage from "./pages/GamePage";
import Home from "./pages/Home/Home";
import OrderPage from "./pages/OrderPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <div className="page">
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
      </BrowserRouter>
    </StoreProvider>
  );
}
