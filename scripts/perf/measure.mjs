// Throttled-phone load measurement (#2906, part of #2905). Hand-run; NOT in CI or `npm test`.
//
//   npm run build && node scripts/perf/measure.mjs [route] [flags]
//
// Starts `vite preview` (on a free port), drives the preinstalled Chromium at 390x844 with
// CPU slowed 4x and ~6 Mbps / 150 ms, loads the route, waits 6 s, then scrolls 30 x 400 px.
// Prints a markdown table (median, min–max over --runs) for pasting into a PR.
//
// Flags: --runs N (5) | --storage empty|warm (empty) | --sw (let the service worker run;
// adds install bytes/count and a second visit) | --sources (list the elements behind
// each layout shift) | --size WxH (desktop at that size, no touch;
// #2986 used 1440x900) | --cpu N (CPU slowdown, 4; 1 = unthrottled) | --date YYYY-MM-DD (the slate for that day) | --wait S (6)
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'

// The cloud container's preinstalled Chromium, as playwright.config.js and scripts/audit/lib.mjs use it.
const CHROMIUM = process.env.CLAUDE_CODE_REMOTE ? '/opt/pw-browsers/chromium' : undefined
const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    runs: { type: 'string', default: '5' },
    storage: { type: 'string', default: 'empty' },
    sw: { type: 'boolean', default: false },
    sources: { type: 'boolean', default: false },
    size: { type: 'string' },
    cpu: { type: 'string', default: '4' },
    date: { type: 'string' },
    wait: { type: 'string', default: '6' },
  },
})
if (!['empty', 'warm'].includes(o.storage)) throw new Error('--storage is empty or warm')
const runs = Number(o.runs)
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs is a whole number, 1 or more')
const cpu = Number(o.cpu)
if (!(cpu >= 1)) throw new Error('--cpu is a slowdown factor, 1 or more')
const size = o.size?.match(/^(\d+)x(\d+)$/)
if (o.size && !size) throw new Error('--size is WIDTHxHEIGHT, e.g. 1440x900')
const desktop = size ? { width: +size[1], height: +size[2] } : null
const wait = Number(o.wait)
if (!(wait >= 0)) throw new Error('--wait is a number of seconds')
const date = o.date && o.date.match(/^(\d{4})-(\d\d)-(\d\d)$/)
if (o.date && (!date || new Date(o.date).toISOString().slice(0, 10) !== o.date)) throw new Error('--date is a real date, YYYY-MM-DD')
if (o.date && positionals[0]) throw new Error('give a route or --date, not both')
const route = positionals[0] ?? (date ? `/${date[2]}${date[3]}${date[1]}?nointro` : '/?nointro')
let BASE

// Runs in the page before any script: collects paint, LCP, layout shifts and long tasks.
// A shift is "scroll" once window.__scrolling is set, otherwise "load".
function observe() {
  const m = (window.__m = { fcp: null, lcp: null, lcpEl: '', shifts: [], longTasks: [] })
  const desc = (n) => {
    if (!n || !n.tagName) return ''
    const c = typeof n.className === 'string' ? n.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
    return n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (c ? '.' + c : '')
  }
  const watch = (type, fn) => {
    try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true }) } catch { /* unsupported */ }
  }
  watch('paint', (e) => { if (e.name === 'first-contentful-paint') m.fcp = e.startTime })
  watch('largest-contentful-paint', (e) => { m.lcp = e.startTime; m.lcpEl = [desc(e.element), e.url && e.url.split('/').pop().slice(0, 40)].filter(Boolean).join(' ') })
  watch('longtask', (e) => m.longTasks.push(e.duration))
  watch('layout-shift', (e) => {
    if (e.hadRecentInput) return
    m.shifts.push({ v: e.value, t: e.startTime, els: e.sources.map((s) => desc(s.node)).filter(Boolean) })
  })
}

// web-vitals CLS: the largest "session window" (shifts under 1 s apart, a window capped at 5 s).
function cls(shifts) {
  let best = 0, cur = 0, first = 0, prev = 0
  for (const { v, t } of shifts) {
    if (cur && t - prev < 1000 && t - first < 5000) cur += v
    else { cur = v; first = t }
    prev = t
    best = Math.max(best, cur)
  }
  return best
}

// One page view. `scroll: false` is a priming load: no scrolling, nothing reported.
async function oneVisit(page, url, scroll = true) {
  const reqs = []
  const onReq = (r) => reqs.push({ type: r.resourceType(), host: new URL(r.url()).host })
  page.on('request', onReq)
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(wait * 1000)
  if (!scroll) { page.off('request', onReq); return null }
  const load = await page.evaluate(() => ({ ...window.__m, els: document.getElementsByTagName('*').length }))
  const loadReqs = reqs.length
  const scrollStart = await page.evaluate(() => performance.now())
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(1000)
  const shifts = await page.evaluate(() => window.__m.shifts)
  page.off('request', onReq)
  const sum = (a) => a.reduce((s, x) => s + x, 0)
  const by = (list, key) => list.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + 1), acc), {})
  const loadList = reqs.slice(0, loadReqs)
  return {
    fcp: load.fcp, lcp: load.lcp, lcpEl: load.lcpEl,
    clsLoad: cls(shifts.filter((x) => x.t < scrollStart)),
    clsScroll: cls(shifts.filter((x) => x.t >= scrollStart)),
    longN: load.longTasks.length, longMs: sum(load.longTasks),
    els: load.els, reqLoad: loadReqs, reqScroll: reqs.length - loadReqs,
    byType: by(loadList, 'type'), byHost: by(loadList, 'host'),
    shifts: shifts.map((x) => ({ ...x, phase: x.t < scrollStart ? 'load' : 'scroll' })),
  }
}

async function swInstall(page) {
  return page.evaluate(async () => {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error('service worker not ready after 30 s')), 30000)),
    ])
    let n = 0, bytes = 0
    for (const k of (await caches.keys()).filter((k) => k.includes('precache'))) {
      for (const r of await (await caches.open(k)).keys()) {
        n++
        bytes += (await (await caches.match(r))?.clone().blob())?.size ?? 0
      }
    }
    return { n, bytes }
  })
}

// CPU and network throttling for one page. (Service-worker traffic is not covered by this.)
async function throttle(ctx, page) {
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (6 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8,
  })
}

async function run(browser) {
  const ctx = await browser.newContext({
    ...(desktop
      ? { viewport: desktop }
      : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }),
    serviceWorkers: o.sw ? 'allow' : 'block',
  })
  await ctx.addInitScript(observe)
  const url = BASE + route
  let install = null
  if (o.sw || o.storage === 'warm') {
    // Prime in its own page, so the measured page opens at the top with no scroll restoration.
    const prime = await ctx.newPage()
    await throttle(ctx, prime)
    await oneVisit(prime, url, false)
    if (o.sw) install = await swInstall(prime)
    await prime.close()
  }
  const page = await ctx.newPage()
  await throttle(ctx, page)
  const r = await oneVisit(page, url)
  await ctx.close()
  return { ...r, install }
}

const port = await new Promise((res, rej) => {
  const srv = createServer().once('error', rej).listen(0, () => { const { port } = srv.address(); srv.close(() => res(port)) })
})
BASE = `http://localhost:${port}`
// Run vite directly (not through npx) so server.kill() stops the preview itself, not a wrapper.
const root = fileURLToPath(new URL('../../', import.meta.url))
const server = spawn(`${root}node_modules/.bin/vite`, ['preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' })
let exited = null
server.on('exit', (code, signal) => { exited = signal ?? code })
try {
  for (let i = 0; ; i++) {
    if (exited !== null) throw new Error(`vite preview exited (${exited}); run \`npm run build\` first`)
    if (await fetch(BASE).then((r) => r.ok, () => false)) break
    if (i >= 60) throw new Error('vite preview did not start in 30 s')
    await new Promise((r) => setTimeout(r, 500))
  }
  const browser = await chromium.launch({ executablePath: CHROMIUM })
  const results = []
  for (let i = 0; i < runs; i++) results.push(await run(browser))
  await browser.close()

  const med = (a) => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2 }
  // A run that lacks a metric (no LCP, say) is left out; none at all prints a dash.
  const fmt = (all, d = 0, u = '') => {
    const a = all.filter(Number.isFinite)
    if (!a.length) return '—'
    const note = a.length < all.length ? ` [${a.length}/${all.length} runs]` : ''
    return `${med(a).toFixed(d)}${u} (${Math.min(...a).toFixed(d)}–${Math.max(...a).toFixed(d)})${note}`
  }
  const col = (f) => results.map(f)
  const mode = o.sw ? 'service worker on, 2nd visit (warm; requests the worker serves are NOT throttled)' : `${o.storage} storage`
  console.log(`**${route}** · ${desktop ? `${desktop.width}×${desktop.height}` : '390×844'}, CPU ${cpu}×, 6 Mbps / 150 ms · ${mode} · ${runs} run(s), median (min–max)\n`)
  console.log('| Metric | Value |\n| --- | --- |')
  const rows = [
    ['FCP', fmt(col((r) => r.fcp), 0, ' ms')],
    ['LCP', fmt(col((r) => r.lcp), 0, ' ms')],
    ['LCP element', [...new Set(col((r) => r.lcpEl))].join(' · ') || '—'],
    ['CLS on load', fmt(col((r) => r.clsLoad), 3)],
    ['CLS during scroll', fmt(col((r) => r.clsScroll), 3)],
    ['Long tasks (count)', fmt(col((r) => r.longN))],
    ['Long tasks (total)', fmt(col((r) => r.longMs), 0, ' ms')],
    ['Elements', fmt(col((r) => r.els))],
    ['Requests on load', fmt(col((r) => r.reqLoad))],
    ['Extra requests while scrolling', fmt(col((r) => r.reqScroll))],
  ]
  if (o.sw) rows.push(['SW precache (files)', fmt(col((r) => r.install?.n))], ['SW precache (KB)', fmt(col((r) => r.install && r.install.bytes / 1024))])
  for (const [k, v] of rows) console.log(`| ${k} | ${v} |`)
  const last = results.at(-1)
  const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')
  console.log(`\nRequests by type (last run): ${top(last.byType)}\nRequests by host (last run): ${top(last.byHost)}`)
  if (o.sources) {
    console.log('\nLayout shifts (last run):')
    for (const s of last.shifts) console.log(`- ${s.phase} ${s.v.toFixed(4)}: ${s.els.join(', ') || '(no source)'}`)
  }
} finally {
  server.kill()
}
