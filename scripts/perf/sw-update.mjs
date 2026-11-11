// The first launch after a deploy, in the lab (#2986). Hand-run; NOT in CI or `npm test`.
//
//   node scripts/perf/sw-update.mjs <buildA> <buildB> [phone|desktop] [runs]
//
// Make two builds that differ in code (copy dist/ away after each `npm run build`). A tiny
// static server serves build A; launch 1 installs its service worker. The server then serves
// build B. Launch 2 is the first launch after the deploy: it waits 8 s, then moves in-app to a
// lazy route (/postseason-history). Launch 3 is the next one. Every launch prints a timeline:
// which build's HTML loaded (the build-commit meta), navigations, 4xx responses, console
// errors, and the final document's FCP/LCP. Phone = 390x844, CPU 4x; desktop = 1440x900, CPU 1x;
// both ~6 Mbps / 150 ms. For a code check, build B with `globalThis.__buildB` / `__lazyB` set
// in src/main.jsx and the lazy page; without them the "code" tag reads A.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'
import { chromium } from 'playwright'
const [A, B, form = 'phone', runsArg = '5'] = process.argv.slice(2)
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' }
let root = A
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname)
  let f = path.resolve(root, '.' + p)
  if (f !== path.resolve(root) && !f.startsWith(path.resolve(root) + path.sep)) { s.writeHead(403); return s.end() } // nothing outside the build
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    if (path.extname(p) && p !== '/') { s.writeHead(404); return s.end() }
    f = path.join(root, 'index.html')
  }
  s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': p.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache' })
  fs.createReadStream(f).pipe(s)
})
await new Promise((res) => srv.listen(0, '127.0.0.1', res))
const BASE = `http://127.0.0.1:${srv.address().port}`
const phone = form === 'phone'
async function throttle(ctx, page) {
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: phone ? 4 : 1 })
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 6 * 1024 * 1024 / 8, uploadThroughput: 1.5 * 1024 * 1024 / 8 })
}
const observe = () => {
  const m = (window.__m = { fcp: null, lcp: null })
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.name === 'first-contentful-paint') m.fcp = e.startTime })).observe({ type: 'paint', buffered: true }) } catch { /* unsupported */ }
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { m.lcp = e.startTime })).observe({ type: 'largest-contentful-paint', buffered: true }) } catch { /* unsupported */ }
}
const build = (page) => page.evaluate(() => document.querySelector('meta[name=build-commit]')?.content?.slice(0, 8) + (globalThis.__buildB ? ' (B code)' : ' (A code)'))
async function launch(ctx, url, lazy) {
  const page = await ctx.newPage(); await throttle(ctx, page)
  const t0 = Date.now(); const ev = []; const at = () => Date.now() - t0
  page.on('response', (r) => { if (r.status() >= 400) ev.push(`${at()} HTTP ${r.status()} ${r.url().replace(BASE, '')}`) })
  page.on('requestfailed', (r) => ev.push(`${at()} FAILED ${r.url().replace(BASE, '').slice(0, 80)} ${r.failure()?.errorText}`))
  page.on('console', (c) => { if (c.type() === 'error') ev.push(`${at()} console ${c.text().slice(0, 120)}`) })
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) ev.push(`${at()} NAV ${f.url().replace(BASE, '')}`) })
  // Read the build id from the HTML response itself, not the live DOM: a recovery reload can
  // replace the document before an evaluate would run, and tag the old load with the new build.
  page.on('response', async (r) => {
    if (r.request().resourceType() !== 'document') return
    const t = at()
    const html = await r.text().catch(() => '')
    ev.push(`${t} HTML build ${html.match(/name="build-commit" content="([0-9a-f]{0,8})/)?.[1] ?? '?'}${r.fromServiceWorker() ? ' (from the service worker)' : ''}`)
  })
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(8000)
  if (lazy) {
    ev.push(`${at()} -> in-app move to /postseason-history`)
    await page.evaluate(() => { history.pushState({}, '', '/postseason-history'); dispatchEvent(new PopStateEvent('popstate')) }).catch((e) => ev.push('eval ' + e.message))
    await page.waitForTimeout(8000)
    ev.push(`${at()} after move: lazyB=${await page.evaluate(() => !!globalThis.__lazyB).catch(() => '?')} text=${(await page.evaluate(() => document.body.innerText.slice(0, 100)).catch(() => '?')).replace(/\s+/g, ' ')}`)
  }
  const m = await page.evaluate(() => ({ fcp: Math.round(window.__m.fcp), lcp: Math.round(window.__m.lcp), sw: !!navigator.serviceWorker.controller })).catch(() => ({}))
  ev.push(`${at()} end build ${await build(page).catch(() => '?')} (final document FCP ${m.fcp} LCP ${m.lcp}, controlled ${m.sw})`)
  await page.close(); return ev
}
const results = []
const browser = await chromium.launch({ executablePath: process.env.CLAUDE_CODE_REMOTE ? '/opt/pw-browsers/chromium' : undefined })
for (let i = 0; i < Number(runsArg); i++) {
  root = A
  const ctx = await browser.newContext({ ...(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }), serviceWorkers: 'allow' })
  await ctx.addInitScript(observe)
  const first = await launch(ctx, BASE + '/?nointro')
  root = B
  const second = await launch(ctx, BASE + '/?nointro', true)
  const third = await launch(ctx, BASE + '/?nointro')
  results.push({ first, second, third })
  await ctx.close()
}
await browser.close(); srv.close()
console.log(JSON.stringify(results, null, 1))
