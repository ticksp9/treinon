import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import legacy from "@vitejs/plugin-legacy";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mcpPlugin(),
    // Older iPads/iPhones (iOS 12–15) got a blank page: compile the syntax down and
    // add the missing browser functions for them.
    legacy({
      targets: ['defaults', 'safari >= 12', 'ios >= 12', 'not dead'],
      modernTargets: ['safari >= 12', 'ios >= 12', 'chrome >= 70', 'edge >= 79', 'firefox >= 70'],
      modernPolyfills: true,
    }),
    mode === "development" && componentTagger(),
    VitePWA({
      // the app decides when to reload (never in the middle of a live match): src/lib/pwa-update.ts
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        id: '/',
        name: 'TreinON — O treinador ligado ao jogo',
        short_name: 'TreinON',
        description: 'Jogo ao vivo, treinos, plantéis e gestão do clube — para treinadores de formação e seniores.',
        lang: 'pt-PT',
        categories: ['sports', 'productivity'],
        theme_color: '#1b2230',
        background_color: '#f3f4f7',
        display: 'standalone',
        // 'any' so tablets can use the tactical board in landscape
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit
        navigateFallback: '/index.html',
        // diagnostic page must always come from the network
        navigateFallbackDenylist: [/^\/diag/],
        cleanupOutdatedCaches: true,
        // config.js points the app at its backend (club server); never serve a stale copy
        globIgnores: ['config.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/config.js',
            handler: 'NetworkFirst',
            options: { cacheName: 'treinon-config', networkTimeoutSeconds: 3 },
          },
          // No caching of database (REST) responses in the service worker: the cache is keyed by
          // URL only, so on a shared phone one coach could see another's data. Offline data lives
          // in IndexedDB, separated per user.
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react-router-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
}));
