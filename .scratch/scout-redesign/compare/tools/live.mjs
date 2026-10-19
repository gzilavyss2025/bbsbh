// Live scout page: full-page shot plus section rects. node live.mjs <out-prefix> <width> [height]
import { chromium } from 'playwright'
import fs from 'node:fs'
const [prefix, w = '390', h = '844'] = process.argv.slice(2)
const url = new URL('/scout/nick-pivetta-601713/jackson-chourio-694192', 'http://localhost:5173')
url.searchParams.set('nointro', '')
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 2 })
const RELAY = /(statsapi\.mlb\.com|baseballsavant\.mlb\.com|img\.mlbstatic\.com|www\.mlbstatic\.com|prod-gameday\.mlbstatic\.com)/
await page.route((u) => RELAY.test(u.host), async (r) => {
  try {
    const res = await fetch(r.request().url(), { method: r.request().method(), headers: { accept: r.request().headers().accept ?? '*/*' } })
    const body = Buffer.from(await res.arrayBuffer())
    const headers = Object.fromEntries([...res.headers].filter(([k]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(k)))
    headers['access-control-allow-origin'] = '*'
    await r.fulfill({ status: res.status, headers, body })
  } catch { await r.abort() }
})
page.on('pageerror', (e) => console.error('pageerror:', e.message))
await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(4000)
// Walk the page so every in-view gate fires, then come back for the full-page shot.
const total = await page.evaluate(() => document.documentElement.scrollHeight)
for (let y = 0; y < total; y += 300) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(250) }
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(2500)
await page.screenshot({ path: `${prefix}-full.png`, fullPage: true })
const rects = await page.evaluate(() => {
  const out = {}
  for (const id of ['scout-edge', 'scout-pitches', 'scout-where', 'scout-meet']) {
    const e = document.getElementById(id); if (!e) continue
    const r = e.getBoundingClientRect(); out[id] = { top: Math.round(r.top + scrollY), h: Math.round(r.height), left: Math.round(r.left), w: Math.round(r.width) }
  }
  out.docH = document.documentElement.scrollHeight
  return out
})
for (const [id, r] of Object.entries(rects)) {
  if (!r.top) continue
  await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, r.top - 70))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${prefix}-vp-${id}.png` })
}
fs.writeFileSync(`${prefix}-rects.json`, JSON.stringify(rects, null, 1))
console.log(JSON.stringify(rects))
await browser.close()
