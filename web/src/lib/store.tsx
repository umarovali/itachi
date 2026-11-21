import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Catalog, type Product } from "./api";
import { detectCurrency, formatDisplay, loadSavedCurrency, saveCurrency, type CurrencyCode } from "./currency";

interface StoreValue {
  catalog: Catalog | null;
  catalogError: string;
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  /** Цена товара в сомах (null — каталог ещё не загружен). */
  priceOf: (product: Product) => number | null;
  /** Сумма в сомах → текст для покупателя: «95 сом» или «≈ 1 240 ₸». */
  display: (som: number) => string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => loadSavedCurrency() ?? detectCurrency());

  useEffect(() => {
    api
      .catalog()
      .then(setCatalog)
      .catch(() => setCatalogError("Не удалось загрузить каталог. Обнови страницу или попробуй позже."));
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    saveCurrency(code);
  }, []);

  const priceOf = useCallback((product: Product) => (catalog ? product.priceKgs : null), [catalog]);

  const display = useCallback(
    (som: number) => (catalog ? formatDisplay(som, currency, catalog.rates) : `${som} сом`),
    [catalog, currency],
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
