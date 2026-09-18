import { chromium } from 'playwright'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
const PORT = process.env.E2E_PORT || 5173
const OUT = '.scratch/design-system/prA/shots/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
await page.goto(`http://localhost:${PORT}/team/158?nointro`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
// A heading with body copy under it — the pair the split is supposed to separate.
const el = page.locator('.section__title, h2, .t-section-title').first()
await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); const bb = await el.boundingBox()
const clip = { x: 0, y: Math.max(0, bb.y - 12), width: 390, height: 110 }
writeFileSync(`${OUT}crop-ink-new.png`, await page.screenshot({ clip }))
const h = await page.addStyleTag({ content: ':root { --ink-0: #16222F; }' })
await page.waitForTimeout(350)
writeFileSync(`${OUT}crop-ink-old.png`, await page.screenshot({ clip }))
await h.evaluate((n) => n.remove())
const p2 = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2 })
const img = (f) => 'data:image/png;base64,' + readFileSync(OUT + f).toString('base64')
await p2.setContent(`<body style="margin:0;background:#EDE6D1;font:600 15px system-ui;color:#0F1822">
 <div id=w style="display:inline-block;padding:20px">
 <figure style="margin:0 0 16px"><figcaption style="padding:5px 0">BEFORE &mdash; --ink-0 #16222F</figcaption><img src="${img('crop-ink-old.png')}" style="display:block;width:900px"></figure>
 <figure style="margin:0"><figcaption style="padding:5px 0">AFTER &mdash; --ink-0 #0F1822</figcaption><img src="${img('crop-ink-new.png')}" style="display:block;width:900px"></figure>
 </div></body>`)
await p2.waitForTimeout(400)
writeFileSync(`${OUT}crop-ink-compare.png`, await p2.screenshot({ clip: await p2.locator('#w').boundingBox() }))
console.log('ok')
await browser.close()
