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
        name: 'Tally Baseball',
        short_name: 'Tally',
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
        // and is only ever read from the umpire detail page. Same for
        // game-notes.json — an append-only archive of press-notes PDF links that
        // grows every game day (see scripts/gen-game-notes.mjs).
        // Same for the per-date callouts bundles — since they cover the MiLB
        // levels too each day's file runs ~0.5-1 MB, and the folder holds ~10
        // days of them; only the day being scored is ever read. Same for
        // rookies.json — a debut/rookie-limit row for every player who's ever
        // appeared in MLB (~1.3 MB and growing, see scripts/gen-rookies.mjs /
        // gen-rookies-backfill.mjs).
        globIgnores: [
          '**/data/vs-team-splits.json',
          '**/data/umpires.json',
          '**/data/game-notes.json',
          '**/data/callouts/*.json',
          '**/data/rookies.json',
          // Route-specific snapshots are fetched on demand instead of adding
          // hundreds of KB to every install. The runtime rule below keeps the
          // last successful copy available for offline browsing.
          '**/data/manager-history.json',
          '**/data/umpire-accuracy.json',
          '**/data/game-score.json',
          '**/data/former-teammates.json',
          '**/data/top-prospects.json',
          '**/data/war-history.json',
          '**/data/minors-leaders.json',
          // Every named All-Star since 1933 (~650 KB) — only read from the
          // All-Star Rosters page, see scripts/gen-all-star-rosters.mjs.
          '**/data/all-star-rosters.json',
          // One season-chunked Team Transactions file per season (~2.5 MB,
          // all 30 orgs — see scripts/gen-team-transactions.mjs), only ever
          // read a season at a time from one team's page.
          '**/data/team-transactions/*.json',
          // pdfjs (the What's Brewing PDF parser) is a heavy chunk + worker
          // (~365 KB + 1.3 MB) loaded ONLY when a user opens the Brewers'
          // What's Brewing modal (see src/api/whatsBrewing.js). Keep it out of
          // the app-shell precache so it never lands on the install of a user
          // who never taps it; it's runtime-cached on first use instead (below).
          '**/assets/pdf*',
        ],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Page-specific static snapshots are too large for the app-shell
            // precache. NetworkFirst keeps them fresh online and usable after
            // a successful visit when the user is offline at the park.
            urlPattern: ({ url }) =>
              /^\/data\/(?:manager-history|umpire-accuracy|game-score|former-teammates|top-prospects|war-history|minors-leaders|all-star-rosters)\.json$/.test(
                url.pathname,
              ) || /^\/data\/team-transactions\/\d{4}\.json$/.test(url.pathname),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'bbsbh-static-data',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
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
            // The on-demand rookie-status dataset (excluded from precache
            // above), same rationale as the SPLITS VS TEAM rule — career facts
            // only, no live score, so NetworkFirst is spoiler-safe.
            urlPattern: ({ url }) => url.pathname === '/data/rookies.json',
            handler: 'NetworkFirst',
            method: 'GET',
          },
          {
            // The append-only Game Notes archive (excluded from precache above).
            // NetworkFirst so the fresh daily copy wins online but the lineup-page
            // button still resolves offline from the last good fetch. Just PDF
            // links (title/date/url) — no live score, so this is spoiler-safe.
            urlPattern: ({ url }) => url.pathname === '/data/game-notes.json',
            handler: 'NetworkFirst',
            method: 'GET',
          },
          {
            // The per-date callouts bundles (excluded from precache above).
            // Season aggregates only — spoiler-free — so NetworkFirst is safe:
            // fresh nightly copy when online, last good copy at the park.
            urlPattern: ({ url }) => /^\/data\/callouts\/\d{8}\.json$/.test(url.pathname),
            handler: 'NetworkFirst',
            method: 'GET',
          },
          {
            // pdfjs chunk + worker (excluded from precache above). They're
            // content-hashed and immutable, so CacheFirst: fetched on the first
            // What's Brewing open, then served from cache on later opens (incl.
            // offline). Carries no score — it's a PDF parser, not data.
            urlPattern: ({ url }) => /\/assets\/pdf.*\.(m?js)$/.test(url.pathname),
            handler: 'CacheFirst',
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
