// Screenshot a scout route in the container's Chromium (#2319 slices).
//
// The cloud container's Chromium cannot reach statsapi.mlb.com or Baseball
// Savant through the proxy (the page shows "Couldn't load this pair"), but
// Node can. So this routes every request to those hosts through Node's fetch
// and hands the answer back to the page. TLS stays verified on the Node side.
//
// Run from the repo root while `npm run dev` serves on 5173:
//   node .scratch/scout-redesign/shot.mjs <route> <out.png> [width] [height]
//   node .scratch/scout-redesign/shot.mjs "/scout/nick-pivetta-601713/jackson-chourio-694192" /tmp/scout.png 390
// `?nointro` is added for you. Width defaults to 390 (phone); use 1280 for desktop.
import { chromium } from 'playwright'

const [route = '/scout/nick-pivetta-601713/jackson-chourio-694192', out = 'scout.png', w = '390', h = '844'] = process.argv.slice(2)
const url = new URL(route, 'http://localhost:5173')
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
  } catch {
    await r.abort()
  }
})
page.on('pageerror', (e) => console.error('pageerror:', e.message))
await page.goto(url.href, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3000)
await page.screenshot({ path: out, fullPage: true })
console.log('saved', out)
await browser.close()
