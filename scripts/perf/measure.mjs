// Throttled-phone load measurement (#2906, part of #2905). Hand-run; NOT in CI or `npm test`.
//
//   npm run build && node scripts/perf/measure.mjs [route] [flags]
//
// Starts `vite preview` (port 4173), drives the preinstalled Chromium at 390x844 with
// CPU slowed 4x and ~6 Mbps / 150 ms, loads the route, waits 6 s, then scrolls 30 x 400 px.
// Prints a markdown table (median, min–max over --runs) for pasting into a PR.
//
// Flags: --runs N (5) | --storage empty|warm (empty) | --sw (let the service worker run;
// adds install bytes/count and a second visit) | --sources (list the elements behind
// each layout shift) | --date YYYY-MM-DD (the slate for that day) | --wait S (6)
// Set CHROME_PATH to a Chrome binary when the Playwright in node_modules wants a build that is not installed.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'

const { chromium } = createRequire(import.meta.url)('playwright')
const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    runs: { type: 'string', default: '5' },
    storage: { type: 'string', default: 'empty' },
    sw: { type: 'boolean', default: false },
    sources: { type: 'boolean', default: false },
    date: { type: 'string' },
    wait: { type: 'string', default: '6' },
  },
})
if (!['empty', 'warm'].includes(o.storage)) throw new Error('--storage is empty or warm')
const runs = Math.max(1, Number(o.runs))
const date = o.date && o.date.match(/^(\d{4})-(\d\d)-(\d\d)$/)
if (o.date && !date) throw new Error('--date is YYYY-MM-DD')
const route = positionals[0] ?? (date ? `/${date[2]}${date[3]}${date[1]}?nointro` : '/?nointro')
const BASE = 'http://localhost:4173'

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
  watch('largest-contentful-paint', (e) => { m.lcp = e.startTime; m.lcpEl = desc(e.element) + (e.url ? ' ' + e.url.split('/').pop().slice(0, 40) : '') })
  watch('longtask', (e) => m.longTasks.push(e.duration))
  watch('layout-shift', (e) => {
    if (e.hadRecentInput) return
    m.shifts.push({ v: e.value, phase: window.__scrolling ? 'scroll' : 'load', els: e.sources.map((s) => desc(s.node)) })
  })
}

async function oneVisit(page, cdp, url, wait) {
  const reqs = []
  const onReq = (r) => reqs.push({ type: r.resourceType(), host: new URL(r.url()).host })
  page.on('request', onReq)
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(wait * 1000)
  const load = await page.evaluate(() => ({ ...window.__m, els: document.getElementsByTagName('*').length }))
  const loadReqs = reqs.length
  await page.evaluate(() => { window.__scrolling = true })
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(1000)
  const end = await page.evaluate(() => window.__m.shifts)
  page.off('request', onReq)
  const sum = (a) => a.reduce((s, x) => s + x, 0)
  const by = (list, key) => list.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + 1), acc), {})
  const loadList = reqs.slice(0, loadReqs)
  return {
    fcp: load.fcp, lcp: load.lcp, lcpEl: load.lcpEl,
    clsLoad: sum(end.filter((s) => s.phase === 'load').map((s) => s.v)),
    clsScroll: sum(end.filter((s) => s.phase === 'scroll').map((s) => s.v)),
    longN: load.longTasks.length, longMs: sum(load.longTasks),
    els: load.els, reqLoad: loadReqs, reqScroll: reqs.length - loadReqs,
    byType: by(loadList, 'type'), byHost: by(loadList, 'host'),
    shifts: end,
  }
}

async function swInstall(page) {
  return page.evaluate(async () => {
    await navigator.serviceWorker.ready
    let n = 0, bytes = 0
    for (const k of await caches.keys()) {
      for (const r of await (await caches.open(k)).keys()) {
        n++
        bytes += (await (await caches.match(r))?.clone().blob())?.size ?? 0
      }
    }
    return { n, bytes }
  })
}

async function run(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    serviceWorkers: o.sw ? 'allow' : 'block',
  })
  await ctx.addInitScript(observe)
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (6 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8,
  })
  const url = BASE + route
  let install = null
  if (o.sw || o.storage === 'warm') {
    await oneVisit(page, cdp, url, Number(o.wait)) // priming load
    if (o.sw) install = await swInstall(page)
  }
  const r = await oneVisit(page, cdp, url, Number(o.wait))
  await ctx.close()
  return { ...r, install }
}

const server = spawn('npx', ['vite', 'preview'], { stdio: 'ignore' })
try {
  for (let i = 0; i < 60; i++) {
    if (await fetch(BASE).then((r) => r.ok, () => false)) break
    if (i === 59) throw new Error('vite preview did not start; run `npm run build` first')
    await new Promise((r) => setTimeout(r, 500))
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH })
  const results = []
  for (let i = 0; i < runs; i++) results.push(await run(browser))
  await browser.close()

  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)] }
  const fmt = (a, d = 0, u = '') => `${med(a).toFixed(d)}${u} (${Math.min(...a).toFixed(d)}–${Math.max(...a).toFixed(d)})`
  const col = (f) => results.map(f)
  const mode = `${o.storage} storage${o.sw ? ', service worker on (2nd visit)' : ''}`
  console.log(`**${route}** · 390×844, CPU 4×, 6 Mbps / 150 ms · ${mode} · ${runs} run(s), median (min–max)\n`)
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
  if (o.sw) rows.push(['SW precache (files)', fmt(col((r) => r.install.n))], ['SW precache (KB)', fmt(col((r) => r.install.bytes / 1024))])
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
