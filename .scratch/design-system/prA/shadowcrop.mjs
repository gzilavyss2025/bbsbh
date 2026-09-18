// Enlarged before/after of --shadow-raised on a PAPER surface: the wire dock's
// bottom sheet, which sits at the rail detent on the slate. Its top edge is
// where a bottom sheet's shadow falls, so the crop is that edge, at 3x.
import { chromium } from 'playwright'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
const PORT = process.env.E2E_PORT || 5173
const OUT = '.scratch/design-system/prA/shots/'
mkdirSync(OUT, { recursive: true })
const OLD = '0 2px 4px rgba(22,34,47,0.10), 0 8px 24px rgba(22,34,47,0.10)'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
await page.goto(`http://localhost:${PORT}/?nointro`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const el = page.locator('.wiredock__sheet').first()
const bb = await el.boundingBox()
if (!bb) { console.log('wiredock sheet not present'); await browser.close(); process.exit(0) }
// The top edge of the sheet plus the page above it, where the shadow lands.
const clip = { x: bb.x, y: Math.max(0, bb.y - 40), width: Math.min(bb.width, 390), height: 78 }
console.log('sheet box', bb, '\nclip', clip)
writeFileSync(`${OUT}crop-sheet-new.png`, await page.screenshot({ clip }))
const h = await page.addStyleTag({ content: `:root { --shadow-raised: ${OLD}; }` })
await page.waitForTimeout(400)
writeFileSync(`${OUT}crop-sheet-old.png`, await page.screenshot({ clip }))
await h.evaluate((n) => n.remove())

// Compose vertically, in a viewport wide enough to hold the enlargement.
const page2 = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 })
const img = (f) => 'data:image/png;base64,' + readFileSync(OUT + f).toString('base64')
await page2.setContent(`<body style="margin:0;background:#EDE6D1;font:600 15px system-ui;color:#0F1822">
  <div id="w" style="display:inline-block;padding:20px">
    <figure style="margin:0 0 18px"><figcaption style="padding:6px 0">BEFORE &mdash; 0 2px 4px .10, 0 8px 24px .10</figcaption>
      <img src="${img('crop-sheet-old.png')}" style="display:block;width:900px;image-rendering:auto"></figure>
    <figure style="margin:0"><figcaption style="padding:6px 0">AFTER &mdash; 0 3px 6px .16, 0 12px 28px .14</figcaption>
      <img src="${img('crop-sheet-new.png')}" style="display:block;width:900px"></figure>
  </div></body>`)
await page2.waitForTimeout(500)
const wb = await page2.locator('#w').boundingBox()
writeFileSync(`${OUT}crop-sheet-compare.png`, await page2.screenshot({ clip: wb }))
console.log('wrote crop-sheet-compare.png')
await browser.close()
