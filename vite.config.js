import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import {
  DEV_DATA_MAX_BODY_BYTES,
  devDataStore,
  resolveStoreFile,
  serializeStore,
} from './scripts/lib/dev-data-stores.mjs'
import {
  DEV_LOGO_COPY_ROUTE,
  DEV_LOGO_MAX_BODY_BYTES,
  DEV_LOGO_ROUTE,
  copyLogoUpload,
  fillWpaArt,
  saveLogoUpload,
} from './scripts/lib/dev-logo-upload.mjs'
import {
  DEV_CUSTOM_MARK_ASSIGN_ROUTE,
  DEV_CUSTOM_MARK_MAX_BODY_BYTES,
  DEV_CUSTOM_MARK_ROUTE,
  assignCustomMark,
  saveCustomMark,
} from './scripts/lib/dev-custom-marks.mjs'
import { writeMonoLogo } from './scripts/lib/mono-logo-art.mjs'
import { describeLogoCaveat } from './src/lib/logoArt.js'

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
// One route on the same mount takes bytes instead of JSON: /__dev/team-logo,
// which writes a curated club mark into public/team-logos/{treatment}/. Its
// destination is resolved the same way — from a numeric team id and a treatment
// KEY, never a path (scripts/lib/dev-logo-upload.mjs). Vite serves public/
// directly in dev, so an uploaded mark is live on the next request. Its sibling
// /__dev/team-logo-copy takes no body at all — `from`/`to` treatment keys ride
// the query string, and the bytes it writes come off whatever `from` already
// has on disk, so reusing one mark across a club's treatments needs no second
// upload.
//
// The route lives under `/__dev/…` rather than `/api/…` because this repo's
// `api/` directory is reserved for the real backend exceptions (OG previews,
// reveal sync, copy — see root CLAUDE.md), which are Vercel edge functions, not
// Vite dev middleware; a shared `/api/` prefix would misleadingly suggest this
// is another one.

// Vercel sets VERCEL_GIT_COMMIT_SHA for every build; `vite dev`/a local
// `vite build` has none, so fall back to the checked-out HEAD. Bridging it
// onto a VITE_-prefixed process.env var is what makes Vite expose it to
// client code as import.meta.env.VITE_BUILD_COMMIT — see src/lib/buildInfo.js,
// which the footer's build indicator reads (root CLAUDE.md's testing note on
// confirming you're looking at the version you just merged).
function resolveBuildCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return ''
  }
}
process.env.VITE_BUILD_COMMIT = resolveBuildCommit()

// Buffer a request body, or answer 413 and give up. Resolves null when nothing
// usable arrived (too large, or the socket went away) — in which case the
// response has already been sent or the connection is gone, and the caller
// must not write to it.
function readBody(req, res, maxBytes) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    let done = false
    req.on('data', (chunk) => {
      if (done) return
      size += chunk.length
      if (size > maxBytes) {
        done = true
        res.statusCode = 413
        res.end('body too large')
        req.destroy()
        resolve(null)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (done) return
      done = true
      resolve(Buffer.concat(chunks))
    })
    req.on('error', () => {
      if (done) return
      done = true
      resolve(null)
    })
  })
}

async function handleStoreSave(req, res, store) {
  const body = await readBody(req, res, DEV_DATA_MAX_BODY_BYTES)
  if (!body) return
  let parsed
  try {
    parsed = JSON.parse(body.toString('utf8') || '{}')
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
}

// The team and treatment ride in the query string because the body is the PNG
// itself. Both are re-resolved server-side against the treatment allowlist and
// teamAbbr — the strings here are only ever compared, never joined into a path.
async function handleLogoUpload(req, res, query) {
  const params = new URLSearchParams(query)
  const teamId = Number(params.get('teamId'))
  const treatment = params.get('treatment') ?? ''
  const bytes = await readBody(req, res, DEV_LOGO_MAX_BODY_BYTES)
  if (!bytes) return
  try {
    const { problem, status, target } = await saveLogoUpload({ teamId, treatment, bytes })
    if (problem) {
      res.statusCode = status ?? 400
      res.end(problem)
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ file: target.file, url: target.url, caveat: describeLogoCaveat(bytes) }))
  } catch (err) {
    res.statusCode = 500
    res.end(err.message)
  }
}

// No body to read — `from`/`to` are both query params, and the bytes come off
// disk server-side, not the request.
async function handleLogoCopy(req, res, query) {
  const params = new URLSearchParams(query)
  const teamId = Number(params.get('teamId'))
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  try {
    const { problem, status, target, caveat } = await copyLogoUpload({ teamId, from, to })
    if (problem) {
      res.statusCode = status ?? 400
      res.end(problem)
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ file: target.file, url: target.url, caveat }))
  } catch (err) {
    res.statusCode = 500
    res.end(err.message)
  }
}

// Rebuild one club's knockout mark from the pins just saved to mono-ink.json.
// No body and no path: a numeric team id is the entire input, the destination
// is a filename built from it inside the generator's own output directory, and
// the bytes are produced by the same scripts/lib/mono-logo-art.mjs the nightly
// generator uses — so the lab can never write art the generator wouldn't.
async function handleMonoLogo(req, res, query) {
  const teamId = Number(new URLSearchParams(query).get('teamId'))
  if (!Number.isInteger(teamId) || teamId <= 0) {
    res.statusCode = 400
    res.end('teamId must be a positive integer')
    return
  }
  try {
    const { problem, file } = await writeMonoLogo(teamId)
    if (problem) {
      res.statusCode = 400
      res.end(problem)
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ file }))
  } catch (err) {
    res.statusCode = 500
    res.end(err.message)
  }
}

const DEV_MONO_LOGO_ROUTE = 'mono-logo'
const DEV_WPA_ART_ROUTE = 'wpa-art'

// Fill a treatment's WPA slot from one of the club's own marks. No body — the
// source is a `kind:id` key from the closed vocabulary src/lib/markSources.js
// defines, resolved server-side to either a CDN fetch or a file already under
// public/team-logos/ (scripts/lib/dev-logo-upload.mjs).
async function handleWpaArt(req, res, query) {
  const params = new URLSearchParams(query)
  try {
    const result = await fillWpaArt({
      teamId: Number(params.get('teamId')),
      treatment: params.get('treatment') ?? '',
      source: params.get('source') ?? '',
    })
    if (result.problem) {
      res.statusCode = result.status ?? 400
      res.end(result.problem)
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = 500
    res.end(err.message)
  }
}

// The recolored-mark library. The SVG markup is the body (it's text, not a
// JSON store), and the team id and display name ride the query string — the
// name is slugified server-side, so nothing from the request reaches the
// filesystem intact (scripts/lib/dev-custom-marks.mjs).
async function handleCustomMark(req, res, query) {
  const params = new URLSearchParams(query)
  const teamId = Number(params.get('teamId'))
  const name = params.get('name') ?? ''
  const body = await readBody(req, res, DEV_CUSTOM_MARK_MAX_BODY_BYTES)
  if (!body) return
  try {
    const result = await saveCustomMark({ teamId, name, svg: body.toString('utf8') })
    if (result.problem) {
      res.statusCode = result.status ?? 400
      res.end(result.problem)
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = 500
    res.end(err.message)
  }
}

// Point a treatment at a library mark, or clear it (an empty slug). No body —
// this writes a pointer, never art.
async function handleCustomMarkAssign(req, res, query) {
  const params = new URLSearchParams(query)
  try {
    const result = await assignCustomMark({
      teamId: Number(params.get('teamId')),
      treatment: params.get('treatment') ?? '',
      slug: params.get('slug') ?? '',
    })
    if (result.problem) {
      res.statusCode = result.status ?? 400
      res.end(result.problem)
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (err) {
    res.statusCode = 500
    res.end(err.message)
  }
}

function devDataSave() {
  return {
    name: 'dev-data-save',
    configureServer(server) {
      server.middlewares.use('/__dev', (req, res) => {
        // `req.url` is the remainder after the mount point, e.g. '/wpa-tuning'
        // or '/team-logo?teamId=140&treatment=alternate'.
        const [routePath, query = ''] = (req.url || '').split('?')
        const key = routePath.replace(/^\/+|\/+$/g, '')
        const isLogo = key === DEV_LOGO_ROUTE
        const isLogoCopy = key === DEV_LOGO_COPY_ROUTE
        const isMonoLogo = key === DEV_MONO_LOGO_ROUTE
        const isCustomMark = key === DEV_CUSTOM_MARK_ROUTE
        const isCustomAssign = key === DEV_CUSTOM_MARK_ASSIGN_ROUTE
        const isWpaArt = key === DEV_WPA_ART_ROUTE
        const isArtRoute =
          isLogo || isLogoCopy || isMonoLogo || isCustomMark || isCustomAssign || isWpaArt
        const store = isArtRoute ? null : devDataStore(key)
        if (!isArtRoute && !store) {
          res.statusCode = 404
          res.end('unknown store')
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('POST only')
          return
        }
        if (isLogo) handleLogoUpload(req, res, query)
        else if (isLogoCopy) handleLogoCopy(req, res, query)
        else if (isMonoLogo) handleMonoLogo(req, res, query)
        else if (isCustomMark) handleCustomMark(req, res, query)
        else if (isCustomAssign) handleCustomMarkAssign(req, res, query)
        else if (isWpaArt) handleWpaArt(req, res, query)
        else handleStoreSave(req, res, store)
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
        // The SPLITS VS TEAM dataset (public/data/vs-team-splits/) is large
        // (~3 MB all told — a career-vs-club line for every active-roster
        // player, sharded one file per club) and refreshed nightly, so it's
        // kept OUT of the app-shell precache to keep the PWA install lean; a
        // game fetches the two clubs it needs on demand and they're
        // runtime-cached instead (see the NetworkFirst rule below). Same for
        // the per-umpire shards (public/data/umpires/ + umpire-accuracy/) — one
        // file per umpire, each growing across the season (every game × 4
        // officials), and a visitor reads the one umpire he tapped. Same for the
        // per-club game-notes shards — an append-only archive of press-notes PDF
        // links that grows every game day (see scripts/gen-game-notes.mjs).
        // Same for the per-game callouts bundles — since they cover the MiLB
        // levels too each day's slate runs ~0.5-1 MB across ~76 files, and the
        // folder holds ~10 days of them; only the game being scored is ever
        // read. Same for the
        // rookie dataset — a debut/rookie-limit row for every player who's ever
        // appeared in MLB (~1.3 MB and growing, see scripts/gen-rookies.mjs /
        // gen-rookies-backfill.mjs). rookies.json there is the generator's
        // MASTER record, never fetched by the app at all; public/data/rookies/
        // holds what is (a compact status map plus id-sharded full records).
        // Both stay out of the install.
        globIgnores: [
          // The curated club marks (~2.5 MB even after compress-logos.mjs,
          // across ~10 treatment directories). One slate shows a handful and
          // one game exactly two, so precaching the whole league's art on
          // every install is pure cost — the same reasoning as the mono
          // knockout SVGs below, 1.5x the bytes. The CacheFirst runtime rule
          // below keeps every mark actually seen available offline.
          '**/team-logos/**',
          '**/data/vs-team-splits/*.json',
          '**/data/umpires/*.json',
          '**/data/game-notes/*.json',
          '**/data/callouts/*/*.json',
          // Same reasoning for the per-date condensed-game index: one small
          // file per slate date, ~6 KB each but one per DAY OF THE SEASON
          // (132 of them by August, and growing every night). A visitor reads
          // the one date they're looking at; precaching the whole season added
          // 133 entries and 782 KiB to the install for nothing.
          '**/data/highlights/day/*.json',
          '**/data/rookies.json',
          '**/data/rookies/**/*.json',
          // Route-specific snapshots are fetched on demand instead of adding
          // hundreds of KB to every install. The runtime rule below keeps the
          // last successful copy available for offline browsing.
          '**/data/manager-history/*.json',
          '**/data/umpire-accuracy/*.json',
          '**/data/former-teammates/*.json',
          '**/data/top-prospects.json',
          '**/data/war-history/*.json',
          '**/data/minors-leaders.json',
          '**/data/career-matchups.json',
          '**/data/postseason-odds.json',
          '**/data/postseason-history.json',
          '**/data/team-score.json',
          '**/data/season-score.json',
          '**/data/milestones.json',
          '**/data/savant-percentiles.json',
          // Every named All-Star since 1933 (~650 KB) — only read from the
          // All-Star Rosters page, see scripts/gen-all-star-rosters.mjs.
          '**/data/all-star-rosters.json',
          // Team Transactions, one file per club per season (~55 KB each; the
          // season's 30 add up past 1.5 MB — see
          // scripts/gen-team-transactions.mjs). A team page reads its own club,
          // one season at a time.
          '**/data/team-transactions/*/*.json',
          // Nightly foul-ball and pitcher-workload aggregates (~170 KB each,
          // refreshed nightly — see scripts/gen-fouls.mjs / gen-workload.mjs);
          // read on demand by the Foul Tracker page, player-page cards, and
          // the lineup pages' bullpen board, so they stay off the install.
          '**/data/fouls.json',
          '**/data/fouls/*.json',
          '**/data/workload.json',
          // Season pitch-type mix per pitcher (~700 KB at a full season's
          // coverage — see scripts/gen-pitch-arsenal.mjs), read on demand by the
          // opposing-starter card's pitch-mix bar and by the player page's
          // "Pitches like" card, which ranks the whole league-wide pool.
          '**/data/pitch-arsenal/*.json',
          '**/data/pitch-arsenal-pool/*.json',
          // Per-team video-highlight archives (scripts/gen-highlights.mjs) —
          // one file per club, each growing all season. A 3-day sample already
          // runs 6-24 KB per team, so a full season lands well past the
          // vs-team-splits threshold when summed across the league, and a
          // user browsing one club's rail needs exactly one of the 30. Read on
          // demand by the Team hub's Games tab and the player page.
          '**/data/highlights/*.json',
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
          // One season-chunked Trade Deadline file per season (~535 KB across
          // seven files — see scripts/gen-team-transactions.mjs's sibling
          // gen-trade-deadline data), read one season at a time from the Trade
          // Deadline page. Exactly the same shape and the same argument as the
          // team-transactions seasons above; it was simply never added.
          // Runtime-cached below.
          '**/data/trade-deadline/*.json',
          // The 1200x630 link-preview card. It is referenced ONLY by absolute
          // URL from index.html's og:image/twitter:image tags, i.e. by social
          // crawlers, which never run a service worker — and no app surface
          // renders it. Precaching it put 85 KB on every install to serve a
          // request that can never come from a page this worker controls.
          '**/og-image.png',
        ],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Page-specific static snapshots are too large for the app-shell
            // precache. NetworkFirst keeps them fresh online and usable after
            // a successful visit when the user is offline at the park.
            urlPattern: ({ url }) =>
              /^\/data\/(?:top-prospects|minors-leaders|all-star-rosters|fouls|workload|career-matchups|postseason-odds|postseason-history|team-score|season-score|milestones|savant-percentiles)\.json$/.test(
                url.pathname,
              ) ||
              // Trade Deadline is season-chunked. The season list itself is the
              // hardcoded SEASONS array in api/tradeDeadline.js, NOT the
              // generated index.json — nothing in the app reads that file today
              // (gen-trade-deadline.mjs still writes it, and its one reader,
              // loadTradeDeadlineIndex, was dead and has been deleted). The
              // `index` arm is kept so a future reader is covered rather than
              // silently uncached; it simply never fires right now.
              /^\/data\/trade-deadline\/(?:index|\d{4})\.json$/.test(url.pathname),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'bbsbh-static-data',
              networkTimeoutSeconds: 3,
              expiration: {
                // Room for one copy of every snapshot the pattern above can
                // match (12 named + the seven trade-deadline files, index
                // included) — an undersized cap here silently evicts one page's
                // data to admit another's.
                //
                // WHOLE-FILE SNAPSHOTS ONLY, and that is what makes the cap
                // safe to state. The per-record shard sets (one file per
                // player bucket, per club, per matchup) belong to the rule
                // below: their namespaces run to hundreds of URLs, so pointing
                // them at a counted cache means browsing a handful of player
                // pages quietly evicts the standings' data — the exact failure
                // this comment warns about, arriving through the back door.
                maxEntries: 32,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
          {
            // The per-record shard sets: one file per player bucket, per club,
            // per matchup, per season-and-club. A reader asks for the ONE
            // record it is showing, so what lands here is what the user
            // actually visited — hundreds of URLs are reachable but only the
            // handful read get stored. Uncounted, like the shard rules below
            // it: an LRU cap sized for a page-snapshot cache would evict a
            // visited page's data on the next player tap.
            urlPattern: ({ url }) =>
              // Career WAR, coaching history, fouls and pitch mix, all bucketed
              // on personId % 100 like the rookie records.
              /^\/data\/(?:war-history|manager-history|fouls|pitch-arsenal)\/\d{2}\.json$/.test(
                url.pathname,
              ) ||
              // One file per MATCHUP, keyed by the two team ids ascending.
              /^\/data\/former-teammates\/\d+-\d+\.json$/.test(url.pathname) ||
              // One slim similarity pool per level.
              /^\/data\/pitch-arsenal-pool\/(?:mlb|aaa)\.json$/.test(url.pathname) ||
              // One video-highlight file per club.
              /^\/data\/highlights\/\d+\.json$/.test(url.pathname) ||
              // Team Transactions: one club, one season.
              /^\/data\/team-transactions\/\d{4}\/(?:index|\d+)\.json$/.test(url.pathname),
            handler: 'NetworkFirst',
            method: 'GET',
            options: { cacheName: 'bbsbh-record-shards', networkTimeoutSeconds: 3 },
          },
          {
            // The one-color club marks (excluded from precache above). Static
            // art that only changes when a club rebrands, and carries no game
            // data at all — CacheFirst, so a revisited team's mark comes off
            // disk and the two marks a game needs survive going offline at the
            // park. teamLogoUrl (teams.js) appends a `?v=` content hash from
            // mono-logo-manifest.json, so this rule matching on `pathname`
            // alone is deliberate — Workbox still keys the cache on the full
            // URL including that query string, so a corrected mark's changed
            // hash is a cache MISS (fresh network fetch) rather than waiting
            // on this rule's own 30-day expiry.
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
            // The curated club marks (excluded from precache above), same
            // static-art rationale as the mono knockouts: CacheFirst so a
            // revisited club's mark comes off disk and survives going offline
            // at the park; an updated upload lands on the next expiry. The
            // cap covers a full league's worth of treatment tiles without
            // letting the cache grow unbounded.
            urlPattern: ({ url }) => /^\/team-logos\//.test(url.pathname),
            handler: 'CacheFirst',
            method: 'GET',
            options: {
              cacheName: 'bbsbh-curated-logos',
              expiration: {
                maxEntries: 180,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            // The on-demand SPLITS VS TEAM shards and their index (excluded
            // from precache above). NetworkFirst so a fresh nightly copy wins
            // when online but the card still works offline from the last good
            // fetch. They carry no live score (career + past-game data only),
            // so this is spoiler-safe — unlike the score feeds below.
            urlPattern: ({ url }) => url.pathname.startsWith('/data/vs-team-splits/'),
            handler: 'NetworkFirst',
            method: 'GET',
          },
          {
            // The on-demand per-umpire shards — his assignment log and his
            // scored game rows — same rationale as the SPLITS VS TEAM rule above.
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/data/umpires/') ||
              url.pathname.startsWith('/data/umpire-accuracy/'),
            handler: 'NetworkFirst',
            method: 'GET',
          },
          {
            // The on-demand rookie status map and record shards (excluded from
            // precache above), same rationale as the SPLITS VS TEAM rule —
            // career facts only, no live score, so NetworkFirst is
            // spoiler-safe.
            urlPattern: ({ url }) => url.pathname.startsWith('/data/rookies/'),
            handler: 'NetworkFirst',
            method: 'GET',
          },
          {
            // The append-only Game Notes archive, one file per club (excluded
            // from precache above). NetworkFirst so the fresh daily copy wins
            // online but the lineup-page button still resolves offline from the
            // last good fetch. Just PDF links (title/date/url) — no live score,
            // so this is spoiler-safe.
            urlPattern: ({ url }) => url.pathname.startsWith('/data/game-notes/'),
            handler: 'NetworkFirst',
            method: 'GET',
          },
          {
            // The per-game callouts bundles, filed by slate date (excluded from
            // precache above). Season aggregates only — spoiler-free — so
            // NetworkFirst is safe: fresh nightly copy when online, last good
            // copy at the park.
            urlPattern: ({ url }) => /^\/data\/callouts\/\d{8}\/\d+\.json$/.test(url.pathname),
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
