// Screenshot a canvas board. node cshot.mjs <Main|Desktop> <out.png> <width> [height]
import { chromium } from 'playwright'
const [board = 'Main', out = 'c.png', w = '390', h = '900'] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 2 })
const IMG = {
  '3865170170a01333a1f608dbcce7b499': 'https://img.mlbstatic.com/mlb-photos/image/upload/w_320,q_auto:best/v1/people/601713/headshot/silo/current',
  '2d92f5adfbe4632785df40fe99f53032': 'https://img.mlbstatic.com/mlb-photos/image/upload/w_320,q_auto:best/v1/people/694192/headshot/silo/current',
  '2fa059d4896db4a0cbde8dfb4d4069c9': 'https://www.mlbstatic.com/team-logos/135.svg',
  '03190d3d2cfc02e9b8828d354b536af8': 'https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/2026/right/158_pants_1_2026.png',
  'ee974f1e11ab3ff4c96c7029659d1e38': 'https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/2026/right/158_jersey_1_2026.png',
  'bdafec042efb764a4f4958d5bea5a49d': 'https://www.mlbstatic.com/team-logos/158.svg',
}
await page.route(/\/_blob\//, async (r) => {
  const id = r.request().url().split('/_blob/')[1]
  const src = IMG[id]
  if (!src) return r.fulfill({ status: 204, body: '' })
  try {
    const res = await fetch(src)
    r.fulfill({ status: 200, headers: { 'content-type': res.headers.get('content-type') }, body: Buffer.from(await res.arrayBuffer()) })
  } catch { r.abort() }
})
page.on('pageerror', (e) => console.error('pageerror:', e.message))
await page.goto(`http://localhost:5199/${board}.dc.html`, { waitUntil: 'load' })
await page.waitForTimeout(3500)
await page.screenshot({ path: out, fullPage: true })
const rects = await page.evaluate(() => {
  const o = {}
  for (const id of ['edge', 'pitches', 'zones', 'meet']) { const e = document.getElementById(id); if (e) { const r = e.getBoundingClientRect(); o[id] = { top: Math.round(r.top + scrollY), h: Math.round(r.height), left: Math.round(r.left), w: Math.round(r.width) } } }
  o.docH = document.documentElement.scrollHeight
  return o
})
console.log(JSON.stringify(rects))
console.log('saved', out)
await browser.close()
