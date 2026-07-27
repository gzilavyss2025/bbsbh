import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFile } from 'node:fs/promises'
import {
  DEV_DATA_MAX_BODY_BYTES,
  devDataStore,
  resolveStoreFile,
  serializeStore,
} from './scripts/lib/dev-data-stores.mjs'

// Dev-only save endpoint for the curation surfaces — the Team Identity Lab
// (/identity-lab) and the Uniform Names page — writing straight back to the
// committed store each one edits. This app has no backend anywhere else: every
// other page is a static PWA reading statsapi.mlb.com or a committed JSON file
// directly, so this is the one deliberate exception, and it's scoped as
// narrowly as possible. `configureServer` only runs under `vite dev` (never
// `vite build`/`vite preview`, and never bundled into the client), so it is
// absent from the deployed app entirely — one of the four independent isolation
// layers ADR-0029 records.
//
// A request POSTs the WHOLE store (every page sends its full up-to-date object,
// not a single-row patch) to /__dev/{key}, where `key` must be an own property
// of the DEV_DATA_STORES allowlist — the security boundary. The request never
// supplies a path, only a key; the destination comes from the allowlist's own
// literal. The file it writes is the same one the app imports/fetches back, so
// a save takes effect immediately, no restart needed.
//
// The route lives under `/__dev/…` rather than `/api/…` because this repo's
// `api/` directory is reserved for the real backend exceptions (OG previews,
// reveal sync, copy — see root CLAUDE.md), which are Vercel edge functions, not
// Vite dev middleware; a shared `/api/` prefix would misleadingly suggest this
// is another one.
function devDataSave() {
  return {
    name: 'dev-data-save',
    configureServer(server) {
      server.middlewares.use('/__dev', (req, res) => {
        // `req.url` is the remainder after the mount point, e.g. '/wpa-tuning'.
        const key = (req.url || '').split('?')[0].replace(/^\/+|\/+$/g, '')
        const store = devDataStore(key)
        if (!store) {
          res.statusCode = 404
          res.end('unknown store')
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        let body = ''
        let tooLarge = false
        req.on('data', (chunk) => {
          if (tooLarge) return
          body += chunk
          if (Buffer.byteLength(body) > DEV_DATA_MAX_BODY_BYTES) {
            tooLarge = true
            res.statusCode = 413
            res.end('body too large')
            req.destroy()
          }
        })
        req.on('end', async () => {
          if (tooLarge) return
          let parsed
          try {
            parsed = JSON.parse(body || '{}')
          } catch (err) {
            res.statusCode = 400
            res.end(`invalid JSON: ${err.message}`)
            return
          }
          const problem = store.validate(parsed)
          if (problem) {
            res.statusCode = 400
            res.end(problem)
            return
          }
          try {
            await writeFile(resolveStoreFile(store), serializeStore(parsed))
            res.statusCode = 200
            res.end('ok')
          } catch (err) {
            res.statusCode = 500
            res.end(err.message)
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
// Multi-agent dev ports: 5173/4173 stay the default (other tooling may
// reference them) and 5169-5172/4169-4172 are reserved exclusively for this
// repo's numbered `dev:2..5` / `preview:2..5` scripts (package.json) — the
// sibling repo tally-nfl owns 5174-5178/4174-4178 instead, see its
// CLAUDE.md's "Reserved dev ports" section. strictPort stays on
// deliberately: with several agents/worktrees possibly running dev servers
// on this repo at once, a silent auto-increment would let one agent quietly
// reuse a port another agent is already bound to instead of failing loudly.
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
    devDataSave(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/tally-baseball-mark-180.png'],
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
          // Nightly foul-ball and pitcher-workload aggregates (~170 KB each,
          // refreshed nightly — see scripts/gen-fouls.mjs / gen-workload.mjs);
          // read on demand by the Foul Tracker page, player-page cards, and
          // the lineup pages' bullpen board, so they stay off the install.
          '**/data/fouls.json',
          '**/data/workload.json',
          // The precomputed one-color club marks (~150 files, ~1.7 MB all
          // told — scripts/gen-mono-logos.mjs). One game shows exactly two of
          // them, so precaching the whole league's art on every install would
          // be pure cost; the CacheFirst rule below keeps the ones actually
          // seen available offline.
          '**/data/logos/mono/*.svg',
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
              /^\/data\/(?:manager-history|umpire-accuracy|game-score|former-teammates|top-prospects|war-history|minors-leaders|all-star-rosters|fouls|workload)\.json$/.test(
                url.pathname,
              ) || /^\/data\/team-transactions\/\d{4}\.json$/.test(url.pathname),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'bbsbh-static-data',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 14,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
          {
            // The one-color club marks (excluded from precache above). Static
            // art that only changes when a club rebrands, and carries no game
            // data at all — CacheFirst, so a revisited team's mark comes off
            // disk and the two marks a game needs survive going offline at the
            // park. A rebrand lands on the next expiry.
            urlPattern: ({ url }) => /^\/data\/logos\/mono\/\d+\.svg$/.test(url.pathname),
            handler: 'CacheFirst',
            method: 'GET',
            options: {
              cacheName: 'bbsbh-team-marks',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60,
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
            urlPattern: ({ url }) =>
              url.hostname === 'open-meteo.com' || url.hostname.endsWith('.open-meteo.com'),
            handler: 'NetworkOnly',
            method: 'GET',
          },
        ],
      },
    }),
  ],
})
