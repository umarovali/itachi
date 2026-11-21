import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Админка живёт по адресу /admin/ (на VPS — тот же домен, что и сайт).
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  server: { port: 5174, proxy: { "/api": "http://localhost:3000" } },
  css: { preprocessorOptions: { scss: { api: "modern-compiler" } } },
});
