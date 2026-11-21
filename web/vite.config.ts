import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Когда появится сервер (server/), запросы /api пойдут на него.
    proxy: { "/api": "http://localhost:3000" },
  },
  css: { preprocessorOptions: { scss: { api: "modern-compiler" } } },
});
