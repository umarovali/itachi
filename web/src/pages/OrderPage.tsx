import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import OrderReceipt from "../components/OrderReceipt";
import { api, type Order } from "../lib/api";

/** /order/ABC123 — статус заказа по номеру. */
export default function OrderPage() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setOrder(null);
    setError("");
    api.getOrder(id).then(setOrder).catch((e: Error) => setError(e.message));
  }, [id]);

  return (
    <div className="order-page page-transition">
      <span className="eyebrow">Статус заказа</span>
      {error && (
        <div className="order-page__error">
          {error}
          <Link className="btn btn--ghost" to="/">
            На главную
          </Link>
        </div>
      )}
      {!order && !error && <div className="status">Загружаю…</div>}
      {order && <OrderReceipt order={order} />}
    </div>
  );
}
