// Click through states and shoot one element. node state.mjs <canvas|live> <width> <out.png> <click1|click2|...>
// Clicks are button texts, scoped to the Where section.
import { chromium } from 'playwright'
const [side, w, out, clicks = ''] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: Number(w), height: 1000 }, deviceScaleFactor: 2 })
const RELAY = /(statsapi\.mlb\.com|baseballsavant\.mlb\.com|img\.mlbstatic\.com|www\.mlbstatic\.com|prod-gameday\.mlbstatic\.com)/
const IMG = {
  '3865170170a01333a1f608dbcce7b499': 'https://img.mlbstatic.com/mlb-photos/image/upload/w_320,q_auto:best/v1/people/601713/headshot/silo/current',
  '2d92f5adfbe4632785df40fe99f53032': 'https://img.mlbstatic.com/mlb-photos/image/upload/w_320,q_auto:best/v1/people/694192/headshot/silo/current',
  '03190d3d2cfc02e9b8828d354b536af8': 'https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/2026/right/158_pants_1_2026.png',
  'ee974f1e11ab3ff4c96c7029659d1e38': 'https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/2026/right/158_jersey_1_2026.png',
}
await page.route((u) => RELAY.test(u.host) || u.pathname.startsWith('/_blob/'), async (r) => {
  let src = r.request().url()
  const u = new URL(src)
  if (u.pathname.startsWith('/_blob/')) { src = IMG[u.pathname.slice(7)]; if (!src) return r.fulfill({ status: 204, body: '' }) }
  try { const res = await fetch(src); const body = Buffer.from(await res.arrayBuffer())
    await r.fulfill({ status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? '', 'access-control-allow-origin': '*' }, body }) } catch { await r.abort() }
})
const url = side === 'canvas' ? 'http://localhost:5199/Main.dc.html' : 'http://localhost:5173/scout/nick-pivetta-601713/jackson-chourio-694192?nointro'
await page.goto(url, { waitUntil: side === 'canvas' ? 'load' : 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3500)
const SEC = process.env.SEC || 'where'
const sel = side === 'canvas' ? (SEC === 'where' ? '#zones' : '#pitches') : (SEC === 'where' ? '#scout-where' : '#scout-pitches')
for (const c of clicks.split('|').filter(Boolean)) {
  await page.locator(sel).getByRole('button', { name: c, exact: false }).first().click()
  await page.waitForTimeout(500)
}
await page.waitForTimeout(800)
await page.locator(sel).scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
await page.locator(sel).screenshot({ path: out })
console.log('saved', out)
await browser.close()
