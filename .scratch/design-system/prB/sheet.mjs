// Compose the crops from wraps.mjs into two contact sheets small enough to
// read in one go. Old (11px) beside new (12px), one row per case.
import { chromium } from 'playwright'
import { writeFileSync, readFileSync, readdirSync } from 'node:fs'

const OUT = '.scratch/design-system/prB/wrapshots/'
const names = [...new Set(readdirSync(OUT)
  .filter((f) => f.endsWith('-new.png'))
  .map((f) => f.replace('-new.png', '')))]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 1 })
const img = (f) => 'data:image/png;base64,' + readFileSync(OUT + f).toString('base64')

const cell = (n) => `
  <figure style="margin:0 0 18px">
    <figcaption style="font:700 14px system-ui;padding:0 0 6px">${n}</figcaption>
    <div style="display:flex;gap:14px;align-items:flex-start">
      <div><div style="font:600 11px system-ui;opacity:.65;padding-bottom:3px">11px — before</div>
        <img src="${img(n + '-old.png')}" style="display:block;max-width:470px;border:1px solid #CBC1A7"></div>
      <div><div style="font:600 11px system-ui;opacity:.65;padding-bottom:3px">12px — after</div>
        <img src="${img(n + '-new.png')}" style="display:block;max-width:470px;border:1px solid #CBC1A7"></div>
    </div>
  </figure>`

const half = Math.ceil(names.length / 2)
for (const [n, group] of [[1, names.slice(0, half)], [2, names.slice(half)]]) {
  await page.setContent(`<body style="margin:0;background:#EDE6D1;color:#0F1822">
    <div id="w" style="display:inline-block;padding:20px">
      <h1 style="font:700 18px system-ui;margin:0 0 16px">Labels that gained a line (${n} of 2)</h1>
      ${group.map(cell).join('')}
    </div></body>`)
  await page.waitForTimeout(800)
  writeFileSync(`${OUT}sheet-${n}.png`, await page.screenshot({ clip: await page.locator('#w').boundingBox() }))
  console.log(`sheet-${n}.png —`, group.join(', '))
}
await browser.close()
