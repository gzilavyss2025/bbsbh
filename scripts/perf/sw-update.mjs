// The first launch after a deploy, in the lab (#2986). Hand-run; NOT in CI or `npm test`.
//
//   node scripts/perf/sw-update.mjs <buildA> <buildB> [phone|desktop] [runs]
//
// Make two builds that differ in code (copy dist/ away after each `npm run build`). `vite preview`
// serves build A; launch 1 installs its service worker. It then restarts on
// the same port with build B. Launch 2 is the first launch after the deploy: it waits 8 s, then moves in-app to a
// lazy route (/postseason-history). Launch 3 is the next one. Every launch prints a timeline:
// which build's HTML loaded (the build-commit meta), navigations, 4xx responses, console
// errors, and the final document's FCP/LCP. Phone = 390x844, CPU 4x; desktop = 1440x900, CPU 1x;
// both ~6 Mbps / 150 ms. For a code check, build B with `globalThis.__buildB` / `__lazyB` set
// in src/main.jsx and the lazy page; without them the "code" tag reads A.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
const [A, B, form = 'phone', runsArg = '5'] = process.argv.slice(2)
// `vite preview` serves one saved build; the "deploy" restarts it on the same port with the other.
const port = await new Promise((res) => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => res(port)) }) })
const BASE = `http://localhost:${port}`
const vite = fileURLToPath(new URL('../../node_modules/.bin/vite', import.meta.url))
let server = null
async function serve(dir) {
  if (server) await new Promise((res) => { server.once('exit', res); server.kill() })
  server = spawn(vite, ['preview', '--outDir', dir, '--port', String(port), '--strictPort'], { stdio: 'ignore' })
  while (!(await fetch(BASE).then((r) => r.ok, () => false))) await new Promise((r) => setTimeout(r, 250))
}
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
  const m = await page.evaluate(async () => ({ fcp: Math.round(window.__m.fcp), lcp: Math.round(window.__m.lcp), sw: !!navigator.serviceWorker.controller, caches: (await caches.keys()).join(',') })).catch(() => ({}))
  ev.push(`${at()} end build ${await build(page).catch(() => '?')} (final document FCP ${m.fcp} LCP ${m.lcp}, controlled ${m.sw}, caches ${m.caches})`)
  await page.close(); return ev
}
const results = []
const browser = await chromium.launch({ executablePath: process.env.CLAUDE_CODE_REMOTE ? '/opt/pw-browsers/chromium' : undefined })
for (let i = 0; i < Number(runsArg); i++) {
  await serve(A)
  const ctx = await browser.newContext({ ...(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }), serviceWorkers: 'allow' })
  await ctx.addInitScript(observe)
  await launch(ctx, BASE + '/?nointro') // installs A's worker
  await serve(B)
  const second = await launch(ctx, BASE + '/?nointro', true)
  const third = await launch(ctx, BASE + '/?nointro')
  results.push({ second, third })
  await ctx.close()
}
await browser.close(); server.kill()
console.log(JSON.stringify(results, null, 1))
