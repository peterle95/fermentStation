import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { pwaManifest } from "./src/platform/pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon-64.png",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
        "new-design/*",
        "fonts/unique/*",
      ],
      manifest: pwaManifest,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // screenshots/: output of `npm run screenshots`; its index.html would otherwise trigger full reloads.
      ignored: ["**/src-tauri/target/**", "**/screenshots/**"],
    },
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "tools/**"],
  },
});
