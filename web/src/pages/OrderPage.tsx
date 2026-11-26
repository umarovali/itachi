import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import OrderReceipt from "../components/OrderReceipt";
import { api, type Order } from "../lib/api";
import { useI18n } from "../lib/i18n";

export default function OrderPage() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setOrder(null);
    setError("");
    api.getOrder(id).then(setOrder).catch((e: Error) => setError(e.message));
  }, [id]);

  return (
    <div className="order-page">
      <span className="eyebrow">{t("order.statusEyebrow")}</span>
      {error && (
        <div className="order-page__error">
          {error}
          <Link className="btn btn--ghost" to="/">
            {t("order.home")}
          </Link>
        </div>
      )}
      {!order && !error && <div className="status">{t("common.loading")}</div>}
      {order && <OrderReceipt order={order} />}
    </div>
  );
}
