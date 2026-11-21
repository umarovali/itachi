import obankQr from "../assets/obank-qr.jpg";
import elkartQr from "../assets/elkart-qr.jpg";

export interface PaymentMethod {
  id: string;
  label: string;
  qr: string;
}

/**
 * Куда покупатель платит. Оплата всегда в сомах; из других стран тоже можно —
 * банк покупателя сам конвертирует по своему курсу.
 * Позже это будет настраиваться в админке.
 */
export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "obank", label: "O!Bank", qr: obankQr },
  { id: "elkart", label: "Элкарт", qr: elkartQr },
];
