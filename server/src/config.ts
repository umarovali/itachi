const str = (name: string, fallback = ""): string => (process.env[name] ?? fallback).trim();
const num = (name: string, fallback: number): number => {
  const v = Number(str(name));
  return Number.isFinite(v) && str(name) !== "" ? v : fallback;
};

export const config = {
  port: num("PORT", 3000),
  publicSiteUrl: str("PUBLIC_SITE_URL", "http://localhost:5173").replace(/\/$/, ""),

  donix: {
    apiKey: str("DONIX_API_KEY"),
    baseUrl: str("DONIX_BASE_URL", "https://donix.org/api/partner/v1").replace(/\/$/, ""),
    webhookSecret: str("DONIX_WEBHOOK_SECRET"),
    /** Нет ключа — работаем с тестовым Donix. */
    get mock(): boolean {
      return this.apiKey === "";
    },
  },

  telegram: {
    token: str("TELEGRAM_BOT_TOKEN"),
  },
  /** Telegram ID владельца — суперадмин назначается автоматически, без /claim. */
  superadminTgId: num("SUPERADMIN_TG_ID", 0),

  defaultMarkupPercent: num("MARKUP_PERCENT", 10),
  orderTtlMinutes: num("ORDER_TTL_MINUTES", 30),
  dbPath: str("DB_PATH", "data/itachi.db"),
  /** Express "trust proxy": loopback (nginx на том же VPS), число хопов или true (Render). */
  trustProxy: ((v: string): boolean | number | string => (v === "true" ? true : /^\d+$/.test(v) ? Number(v) : v))(str("TRUST_PROXY", "loopback")),
};
