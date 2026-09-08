import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev convenience: `VITE_API_URL=/api npm run dev` routes API calls through
// Vite's server-side proxy, so local dev can talk to the deployed API without
// tripping its origin allow-list. Build/preview are unaffected (they use the
// absolute URL from .env.production).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://wwvgn3hxjl.execute-api.us-east-1.amazonaws.com",
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api/, ""),
      },
    },
  },
});
