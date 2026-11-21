import { startBot } from "./bot.ts";
import { syncProducts } from "./catalog.ts";
import { config } from "./config.ts";
import { setMockWebhookHandler } from "./donix-mock.ts";
import { createApp, handleDonixWebhook } from "./http.ts";
import { log } from "./log.ts";
import { expireOrders, pollStuckOrders } from "./orders.ts";
import { refreshRates } from "./rates.ts";

const every = (ms: number, fn: () => unknown) => setInterval(() => Promise.resolve().then(fn).catch((e) => log.error("job failed", e)), ms);

async function main() {
  log.info(`Donix: ${config.donix.mock ? "ТЕСТОВЫЙ режим (нет DONIX_API_KEY)" : `боевой режим → ${config.donix.baseUrl}`}`);
  if (!config.donix.mock && !config.donix.webhookSecret) log.warn("DONIX_WEBHOOK_SECRET не задан — вебхуки Donix будут отклоняться");
  if (config.donix.mock) setMockWebhookHandler((body) => handleDonixWebhook(body));

  await refreshRates();
  await syncProducts().catch((e) => log.error("catalog sync failed — проверьте DONIX_API_KEY / DONIX_BASE_URL", e.message ?? e));

  every(60 * 60_000, refreshRates); // курсы — раз в час
  every(30 * 60_000, syncProducts); // каталог — раз в 30 минут
  every(60_000, expireOrders); // неоплаченные заказы
  every(2 * 60_000, pollStuckOrders); // запасной путь, если вебхук не дошёл

  createApp().listen(config.port, () => log.info(`API запущен: http://localhost:${config.port}`));
  startBot();
}

void main();
