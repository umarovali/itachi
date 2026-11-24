export class DonixError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, httpStatus: number, message?: string) {
    super(message ?? code);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
