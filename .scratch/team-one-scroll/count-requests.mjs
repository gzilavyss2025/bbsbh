// Count the DATA requests a team-hub route fires, cold and after a full scroll.
//
// This reproduces ADR-0034's headline measurement (192 on the old one-scroll
// page, 24 after the tabs) with one method, so every number in scope.md
// compares against every other one. Same instrument as the e2e suite uses:
// `page.on('request')`, filtered to the two things that cost a round trip —
// statsapi.mlb.com, and the precomputed /data/*.json files. Images, fonts,
// JS chunks and the video CDN are NOT counted: the ADR's number is about the
// data layer, and a dev server's module graph is not a production one.
//
// Phone viewport (iPhone 13), `?nointro` on every URL, per CLAUDE.md.
//
//   node .scratch/team-one-scroll/count-requests.mjs                  # the default set
//   node .scratch/team-one-scroll/count-requests.mjs /team/158        # one route
//   PORT=5172 node .scratch/team-one-scroll/count-requests.mjs        # another worktree's slot
//
// statsapi needs the Bash sandbox OFF.

import { chromium, devices } from '@playwright/test'

const PORT = Number(process.env.PORT) || 5173
const BASE = `http://localhost:${PORT}`
// A count is final when the page has fired NO data request for this long —
// not after a fixed wait. A fixed window is not reproducible here: on a dev
// server that has not compiled the route yet, the same page reads 25 cold /
// 64 scrolled on one run and 39 / 39 on the next, because the wait expires
// mid-fan-out rather than after it (the trap e2e/fixtures.js documents,
// issue #1095). Quiet-period waiting moves the boundary off the clock and
// onto the page. Every route is also loaded once, uncounted, before it is
// measured, so no compile is ever charged to a number.
const QUIET_MS = Number(process.env.QUIET_MS) || 3000
const QUIET_CAP_MS = Number(process.env.QUIET_CAP_MS) || 45_000

const DEFAULT_ROUTES = [
  '/team/158', '/team/158/roster', '/team/158/games', '/team/158/numbers',
  '/team/158/contracts', '/team/158/minors',
  '/team/556', '/team/572', '/team/249',
]

function classify(url) {
  const u = new URL(url)
  if (u.hostname === 'statsapi.mlb.com') return 'statsapi'
  if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && /^\/data\/.+\.json$/.test(u.pathname)) return 'static'
  return null
}

// Resolve once the page has gone QUIET_MS without a data request, or when
// QUIET_CAP_MS has passed overall (a page that never settles still yields a
// number, and the caller is told).
async function waitForQuiet(page, lastAt) {
  const start = Date.now()
  for (;;) {
    const idle = Date.now() - lastAt.at
    if (idle >= QUIET_MS) return false
    if (Date.now() - start >= QUIET_CAP_MS) return true
    await page.waitForTimeout(250)
  }
}

async function measure(browser, route) {
  const context = await browser.newContext({ ...devices['iPhone 13'], browserName: 'chromium' })
  const page = await context.newPage()
  const seen = []
  const lastAt = { at: Date.now() }
  page.on('request', (r) => {
    const kind = classify(r.url())
    if (kind) {
      seen.push({ kind, url: r.url() })
      lastAt.at = Date.now()
    }
  })

  const url = `${BASE}${route}${route.includes('?') ? '&' : '?'}nointro`
  await page.goto(url, { waitUntil: 'commit' })
  // The route's lazy chunk has to be DRAWN before anything is counted, or the
  // compile is charged to the measurement (e2e/fixtures.js, issue #1095).
  await page.waitForFunction(() => !document.querySelector('.loader--route'), null, { timeout: 30_000 })
  lastAt.at = Date.now()
  const coldCapped = await waitForQuiet(page, lastAt)
  const cold = seen.length
  const coldStats = seen.filter((s) => s.kind === 'statsapi').length

  // Then walk the whole page, the way a reader does, and let anything
  // deferred behind an IntersectionObserver fire.
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.75))
    await page.waitForTimeout(250)
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  lastAt.at = Date.now()
  const fullCapped = await waitForQuiet(page, lastAt)

  const full = seen.length
  const fullStats = seen.filter((s) => s.kind === 'statsapi').length
  const height = await page.evaluate(() => document.body.scrollHeight)
  const cards = await page.evaluate(() => document.querySelectorAll('.team-hub > .thub-card, .team-hub > section, .team-hub > .ctr, .team-hub > div[class*=card]').length)
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll('.teamtabs__btn')]
      .map((b) => b.textContent.trim()),
  )
  await context.close()
  return { route, cold, coldStats, full, fullStats, height, cards, tabs, seen, capped: coldCapped || fullCapped }
}

const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES
const browser = await chromium.launch()
const rows = []
for (const route of routes) {
  // Uncounted warm-up: compiles the lazy route chunk and primes vite's
  // transform cache, so the measured pass is not racing a build.
  await measure(browser, route)
  const r = await measure(browser, route)
  rows.push(r)
  console.log(
    `${r.route.padEnd(24)} cold ${String(r.cold).padStart(3)} (statsapi ${String(r.coldStats).padStart(3)})` +
      `  scrolled ${String(r.full).padStart(3)} (statsapi ${String(r.fullStats).padStart(3)})` +
      `  px ${String(r.height).padStart(6)}  cards ${String(r.cards).padStart(2)}  tabs [${r.tabs.join(' ')}]` +
      (r.capped ? '  !! never went quiet' : ''),
  )
}
await browser.close()

if (process.env.DETAIL) {
  for (const r of rows) {
    console.log(`\n--- ${r.route} ---`)
    const counts = new Map()
    for (const s of r.seen) {
      const key = s.kind === 'static'
        ? new URL(s.url).pathname.replace(/\/\d+\.json$/, '/{id}.json')
        : new URL(s.url).pathname.replace(/\/\d+/g, '/{id}')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    for (const [k, v] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)
  }
}

// UNION=1 answers the question the per-route numbers cannot: what does it cost
// to see EVERYTHING this club has today, and how much of that is paid twice?
// A tab pays for its own copy of the schedule, the standings, the roster and
// the leader pool; one page pays for each once.
if (process.env.UNION) {
  const all = rows.flatMap((r) => r.seen.map((s) => s.url))
  const uniq = new Set(all)
  console.log(`\nUNION over ${rows.length} routes`)
  console.log(`  requests fired in total : ${all.length}`)
  console.log(`  distinct URLs           : ${uniq.size}`)
  console.log(`  paid more than once     : ${all.length - uniq.size}`)
  const dupes = new Map()
  for (const u of all) dupes.set(u, (dupes.get(u) ?? 0) + 1)
  console.log('  the repeats:')
  for (const [u, n] of [...dupes].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 14)) {
    console.log(`    ×${n}  ${u.replace('https://statsapi.mlb.com', '').slice(0, 120)}`)
  }
}
