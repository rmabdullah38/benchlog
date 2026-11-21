import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// The service worker caches the app shell so BenchLog opens with no connection at all.
export default defineConfig({
  build: { chunkSizeWarningLimit: 1200 },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "BenchLog",
        short_name: "BenchLog",
        description: "Offline-first lab notebook with hybrid on-device + cloud AI",
        theme_color: "#1f5f8b",
        background_color: "#f6f4ef",
        display: "standalone",
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: "CacheFirst",
            options: { cacheName: "fonts", expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
});
