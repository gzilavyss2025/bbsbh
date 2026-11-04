// First-visit JS/CSS per route, plus entry-CSS coverage on /, for the #2875 audit.
// Serve the build first:  npx vite preview   (port 4173)
// Then:                   node .scratch/bundle-audit/measure-routes.mjs
// Each route gets a fresh browser context (empty cache, service workers blocked,
// so it is a true first visit), a 390x844 viewport, and ?nointro. It waits for
// network idle plus 3 s, then sums every script and stylesheet response from the
// app's own origin. "gzip" is this script's own gzip of each body (vite preview
// serves uncompressed), so it matches scripts/bundle/check-bundle-size.mjs.
// Game data comes live from statsapi.mlb.com; nothing is mocked. The Vercel
// functions under /api/* are not served by vite preview, so those calls 404 and
// the app falls back (copy defaults, no identity overrides).
import { chromium } from 'playwright'
import { gzipSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:4173'
const ROUTES = {
  '/ (slate)': '/',
  'game page (823035, lineup1)': '/07072026/milstl-2/lineup1',
  '/team/158': '/team/158',
  '/player/660271': '/player/660271',
  '/profile': '/profile',
}
const kb = (n) => (n / 1000).toFixed(1)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' })
const out = {}
for (const [label, path] of Object.entries(ROUTES)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const files = []
  const pending = []
  page.on('response', (res) => {
    const url = new URL(res.url())
    if (url.origin !== BASE) return
    const type = res.request().resourceType()
    if (type !== 'script' && type !== 'stylesheet') return
    pending.push(res.body().then((b) => files.push({ file: url.pathname, type, raw: b.length, gzip: gzipSync(b).length })).catch(() => {}))
  })
  const measureCss = label === '/ (slate)'
  if (measureCss) await page.coverage.startCSSCoverage()
  await page.goto(BASE + path + '?nointro', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(3000)
  await Promise.all(pending)
  const sum = (t, k) => files.filter((f) => f.type === t).reduce((s, f) => s + f[k], 0)
  const r = {
    path, js: { n: files.filter((f) => f.type === 'script').length, raw: sum('script', 'raw'), gzip: sum('script', 'gzip') },
    css: { n: files.filter((f) => f.type === 'stylesheet').length, raw: sum('stylesheet', 'raw'), gzip: sum('stylesheet', 'gzip') },
    title: await page.title(),
    h1: (await page.locator('h1').first().textContent({ timeout: 2000 }).catch(() => '')).trim().slice(0, 60),
    files,
  }
  if (measureCss) {
    const cov = await page.coverage.stopCSSCoverage()
    r.cssCoverage = cov.filter((c) => c.url.startsWith(BASE)).map((c) => {
      const used = c.ranges.reduce((s, x) => s + (x.end - x.start), 0)
      return { url: new URL(c.url).pathname, total: c.text.length, used, pct: +(100 * used / c.text.length).toFixed(1) }
    })
    await page.screenshot({ path: new URL('./out/slate-390.png', import.meta.url).pathname })
  }
  out[label] = r
  console.log(`${label.padEnd(30)} JS ${String(r.js.n).padStart(3)} files ${kb(r.js.raw).padStart(7)} kB raw ${kb(r.js.gzip).padStart(6)} kB gz | CSS ${r.css.n} files ${kb(r.css.raw).padStart(6)} raw ${kb(r.css.gzip).padStart(5)} gz | "${r.h1}"`)
  if (r.cssCoverage) for (const c of r.cssCoverage) console.log(`   CSS coverage ${c.url}: ${kb(c.used)} of ${kb(c.total)} kB used (${c.pct}%)`)
  await ctx.close()
}
await browser.close()
writeFileSync(new URL('./out/routes.json', import.meta.url), JSON.stringify(out, null, 1))
