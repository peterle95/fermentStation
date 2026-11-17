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
    // The App integration tests drive the whole UI through many awaited interactions; the slowest
    // ("reflects edited cadence and pauses and resumes checks…") takes 5-8 s alone and longer when the
    // files run in parallel, so vitest's 5 s default made a plain `npm test` fail on timing alone.
    testTimeout: 30_000,
    exclude: [...configDefaults.exclude, "tools/**"],
  },
});
