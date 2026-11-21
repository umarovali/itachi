/** Ошибка от Donix с кодом из документации: insufficient_balance, invalid_uid, product_not_found … */
export class DonixError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, httpStatus: number, message?: string) {
    super(message ?? code);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
