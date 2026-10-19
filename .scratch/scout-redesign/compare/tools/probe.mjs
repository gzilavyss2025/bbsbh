// Evaluate JS on the live page. node probe.mjs <width> '<js expression returning JSON>'
import { chromium } from 'playwright'
const [w, expr] = process.argv.slice(2)
const url = 'http://localhost:5173/scout/nick-pivetta-601713/jackson-chourio-694192?nointro'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: Number(w), height: 900 } })
const RELAY = /(statsapi\.mlb\.com|baseballsavant\.mlb\.com|img\.mlbstatic\.com|www\.mlbstatic\.com|prod-gameday\.mlbstatic\.com)/
await page.route((u) => RELAY.test(u.host), async (r) => {
  try { const res = await fetch(r.request().url()); const body = Buffer.from(await res.arrayBuffer())
    await r.fulfill({ status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? '', 'access-control-allow-origin': '*' }, body }) } catch { await r.abort() }
})
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(4000)
console.log(JSON.stringify(await page.evaluate(expr), null, 1))
await browser.close()
