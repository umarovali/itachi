import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { tr, useI18n } from "./i18n";
import { api, type Catalog, type Product } from "./api";
import { detectCurrency, formatDisplay, loadSavedCurrency, saveCurrency, type CurrencyCode } from "./currency";

interface StoreValue {
  catalog: Catalog | null;
  catalogError: boolean;
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  priceOf: (product: Product) => number | null;
  display: (som: number) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n(); // пересоздаём display при смене языка (символ валюты)
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => loadSavedCurrency() ?? detectCurrency());

  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch(() => setCatalogError(true));
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    saveCurrency(code);
  }, []);

  const priceOf = useCallback((product: Product) => (catalog ? product.priceKgs : null), [catalog]);

  const display = useCallback(
    (som: number) => (catalog ? formatDisplay(som, currency, catalog.rates) : `${som} ${tr("cur.sym.KGS")}`),
    [catalog, currency, lang],
  );

  const value = useMemo(
    () => ({ catalog, catalogError, currency, setCurrency, priceOf, display }),
    [catalog, catalogError, currency, setCurrency, priceOf, display],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore вне StoreProvider");
  return ctx;
}
