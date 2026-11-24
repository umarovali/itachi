export type Role = "superadmin" | "admin";

export interface Me {
  tgId: number;
  name: string | null;
  role: Role;
}

export interface Promo {
  code: string;
  percent: number;
  maxUses: number | null;
  used: number;
  active: boolean;
  createdAt: string;
}

export type RawStatus =
  | "awaiting_payment"
  | "payment_check"
  | "confirmed"
  | "sending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded"
  | "customer_refunded"
  | "rejected"
  | "expired";

export interface AdminOrder {
  id: string;
  rawStatus: RawStatus;
  game: string;
  productName: string;
  fields: Record<string, string>;
  nickname: string | null;
  amount: number;
  basePrice: number;
  discountPercent: number;
  promoCode: string | null;
  displayCurrency: string;
  telegram: string;
  sku: string;
  costUsd: number;
  senderName: string | null;
  payMethod: string | null;
  donixOrderId: string | null;
  error: string | null;
  hasReceipt: boolean;
  receiptKind: "image" | "pdf" | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  confirmedAt: string | null;
  finishedAt: string | null;
}

export interface Summary {
  donixMode: "test" | "live";
  balance: { amount: number; currency: string } | null;
  markupPercent: number;
  rates: Record<string, number>;
  today: { orders: number; revenue: number; costUsd: number; profit: number };
  counts: Partial<Record<RawStatus, number>>;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/admin${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Нет связи с сервером", 0);
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ApiError(data?.error ?? `Ошибка ${res.status}`, res.status);
  return data as T;
}

export const api = {
  me: () => request<Me>("/auth/me"),
  loginStart: () => request<{ requestId: string; botUrl: string; expiresInSec: number }>("/auth/start", {}),
  loginPoll: (requestId: string) => request<{ status: "pending" | "approved" | "rejected" | "expired" }>("/auth/poll", { requestId }),
  logout: () => request<{ ok: true }>("/auth/logout", {}),
  summary: () => request<Summary>("/summary"),
  orders: (status: string, q: string) => request<AdminOrder[]>(`/orders?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`),
  action: (id: string, action: "confirm" | "reject" | "retry" | "refund") => request<AdminOrder>(`/orders/${encodeURIComponent(id)}/${action}`, {}),
  promos: () => request<Promo[]>("/promos"),
  savePromo: (p: { code: string; percent: number; maxUses: number | null }) => request<Promo>("/promos", p),
  setPromoActive: (code: string, active: boolean) => request<Promo>(`/promos/${encodeURIComponent(code)}/active`, { active }),
  deletePromo: (code: string) => request<{ ok: true }>(`/promos/${encodeURIComponent(code)}/delete`, {}),
  setMarkup: (percent: number) => request<{ markupPercent: number }>("/markup", { percent }),
  receiptUrl: (id: string) => `/api/admin/orders/${encodeURIComponent(id)}/receipt`,
};
