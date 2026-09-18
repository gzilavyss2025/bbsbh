// .dirhd in its real context: a kraft tab, the section name beside it in
// pencil, and a rule running to the right edge. 30 of the 60 label wraps are
// this one rule, so it gets looked at whole rather than cropped to the words.
import { chromium } from 'playwright'
import { writeFileSync, readFileSync } from 'node:fs'

const PORT = process.env.E2E_PORT || 5173
const OUT = '.scratch/design-system/prB/wrapshots/'
const OLD = ':root { --fs-label: 11px; --fs-small: 11px; }'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${PORT}/standings?nointro`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

// The whole menu block the headings live in, not one heading.
const el = page.locator('.dirhd').first()
await el.scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
const bb = await el.boundingBox()
const clip = { x: 0, y: Math.max(0, bb.y - 20), width: 390, height: 330 }

writeFileSync(`${OUT}dirhd-ctx-new.png`, await page.screenshot({ clip }))
const h = await page.addStyleTag({ content: OLD })
await page.waitForTimeout(450)
writeFileSync(`${OUT}dirhd-ctx-old.png`, await page.screenshot({ clip }))
await h.evaluate((n) => n.remove())

const p2 = await browser.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1 })
const img = (f) => 'data:image/png;base64,' + readFileSync(OUT + f).toString('base64')
await p2.setContent(`<body style="margin:0;background:#EDE6D1;color:#0F1822">
  <div id="w" style="display:inline-block;padding:18px">
    <div style="display:flex;gap:18px">
      <div><div style="font:700 13px system-ui;padding-bottom:6px">11px — before</div>
        <img src="${img('dirhd-ctx-old.png')}" style="display:block;width:430px;border:1px solid #CBC1A7"></div>
      <div><div style="font:700 13px system-ui;padding-bottom:6px">12px — after</div>
        <img src="${img('dirhd-ctx-new.png')}" style="display:block;width:430px;border:1px solid #CBC1A7"></div>
    </div>
  </div></body>`)
await p2.waitForTimeout(700)
writeFileSync(`${OUT}dirhd-context.png`, await p2.screenshot({ clip: await p2.locator('#w').boundingBox() }))
console.log('wrote dirhd-context.png')
await browser.close()
