import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During dev, the React app runs on Vite (5173) and proxies API calls to the
// Node simulation server (8787). In production the same Node server serves the
// built client from dist/.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2020",
    outDir: "dist",
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
      "/unsubscribe": "http://localhost:8787",
    },
  },
});
