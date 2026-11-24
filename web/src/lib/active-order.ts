const KEY = "itachi.activeOrder";

export function saveActiveOrder(game: string, id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ game, id }));
  } catch {}
}

export function loadActiveOrder(game: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { game?: string; id?: string } | null;
    return v?.game === game && typeof v.id === "string" ? v.id : null;
  } catch {
    return null;
  }
}

export function clearActiveOrder(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
