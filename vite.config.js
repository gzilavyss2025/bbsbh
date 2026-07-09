import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Scorebook Helper',
        short_name: 'Scorebook',
        description:
          'Spoiler-safe second-screen companion for scoring baseball games by hand.',
        theme_color: '#1B2A3A',
        background_color: '#F6EFDC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Offline app shell. API responses are network-first so we never
        // serve a stale (and possibly spoiler-revealing) score from cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        // The SPLITS VS TEAM dataset (public/data/vs-team-splits.json) is large
        // (~3 MB — a career-vs-club line for every active-roster player) and
        // refreshed nightly, so it's kept OUT of the app-shell precache to keep
        // the PWA install lean; it's fetched on demand and runtime-cached
        // instead (see the NetworkFirst rule below). Same treatment for
        // umpires.json — it grows across the season (every game × 4 officials)
        // and is only ever read from the umpire detail page.
        globIgnores: ['**/data/vs-team-splits.json', '**/data/umpires.json'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // The on-demand SPLITS VS TEAM dataset (excluded from precache
            // above). NetworkFirst so a fresh nightly copy wins when online but
            // the card still works offline from the last good fetch. It carries
            // no live score (career + past-game data only), so this is
            // spoiler-safe — unlike the score feeds below.
            urlPattern: ({ url }) => url.pathname === '/data/vs-team-splits.json',
            handler: 'NetworkFirst',
            method: 'GET',
          },
          {
            // The on-demand umpire-season dataset, same rationale as the
            // SPLITS VS TEAM rule above.
            urlPattern: ({ url }) => url.pathname === '/data/umpires.json',
            handler: 'NetworkFirst',
            method: 'GET',
          },
          {
            urlPattern: ({ url }) => url.hostname === 'statsapi.mlb.com',
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            // Outdoor weather (see api/weather.js). Never cached so an "actual
            // at first pitch" reading stays live, same as the score endpoints.
            urlPattern: ({ url }) => url.hostname.endsWith('open-meteo.com'),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            // Bluesky game buzz (see api/buzz.js). Score-revealing post text —
            // never cache it, same stale-spoiler rationale as the score feeds.
            urlPattern: ({ url }) => url.hostname === 'api.bsky.app',
            handler: 'NetworkOnly',
            method: 'GET',
          },
        ],
      },
    }),
  ],
})
