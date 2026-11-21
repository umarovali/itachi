import type { Product } from "../lib/api";
import { useStore } from "../lib/store";

interface Props {
  product: Product;
  active: boolean;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, active, onSelect }: Props) {
  const { priceOf, display } = useStore();
  const price = priceOf(product);
  return (
    <button type="button" className={`product-card ${active ? "product-card--active" : ""}`} onClick={() => onSelect(product)} aria-pressed={active}>
      <span className="product-card__name">{product.name}</span>
      <span className="product-card__price">{price === null ? "…" : display(price)}</span>
      {product.note && <span className="product-card__note">{product.note}</span>}
    </button>
  );
}
