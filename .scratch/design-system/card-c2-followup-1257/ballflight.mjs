import { chromium } from 'file:///C:/Users/gzilavy/bbsbh-card-c2-followup/node_modules/playwright/index.mjs'
const tag = process.argv[2] || 'before'
const port = process.argv[3] || '5171'
const OUT = 'C:/Users/gzilavy/AppData/Local/Temp/claude/C--Users-gzilavy-bbsbh/e72f352d-32e1-4257-8d84-6b3d71989118/scratchpad/shots/'
const b = await chromium.launch()
for (const [w, mode] of [[1200, 'hover'], [390, 'modal']]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, hasTouch: mode === 'modal', isMobile: mode === 'modal' })
  await p.goto(`http://localhost:${port}/07072026/milstl-2/top1?nointro`, { waitUntil: 'networkidle', timeout: 90000 })
  await p.waitForTimeout(2500)
  await p.getByRole('button', { name: 'Rest of half' }).click(); await p.waitForTimeout(1500); await p.getByRole('button', { name: 'See the whole half' }).click(); await p.waitForTimeout(1500)
  let n = await p.locator('.pbp__flightbtn').count()
  console.log(w, 'flightbtns', n)
  if (!n) { console.log(await p.locator('button').allTextContents()); continue }
  const btn = p.locator('.pbp__flightbtn').first()
  await btn.scrollIntoViewIfNeeded()
  if (mode === 'hover') await btn.hover(); else await btn.tap()
  await p.waitForTimeout(800)
  const card = p.locator('.bflight').first()
  const info = await card.evaluate(el => { const cs = getComputedStyle(el); return { cls: el.className, border: cs.borderTopColor, overflow: cs.overflow } })
  console.log(w, JSON.stringify(info))
  const box = await card.boundingBox()
  await p.screenshot({ path: `${OUT}${tag}-bflight-${mode}.png`, clip: { x: Math.max(0, box.x - 16), y: Math.max(0, box.y - 16), width: box.width + 32, height: box.height + 32 } })
  await p.close()
}
await b.close()
