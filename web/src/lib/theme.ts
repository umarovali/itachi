export type Theme = "light" | "dark";
const KEY = "faapay.theme";

export function getTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#0b0f1a" : "#ffffff");
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
}
