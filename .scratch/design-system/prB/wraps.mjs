// The 10 label classes that gained a second line when their rule went 11px ->
// 12px. Crop each one old and new, stacked, so the call is made by eye rather
// than from a line count.
//
// Run: E2E_PORT=5173 node .scratch/design-system/prB/wraps.mjs
import { chromium } from 'playwright'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'

const PORT = process.env.E2E_PORT || 5173
const OUT = '.scratch/design-system/prB/wrapshots/'
mkdirSync(OUT, { recursive: true })
const OLD = ':root { --fs-label: 11px; --fs-small: 11px; }'

const CASES = [
  { name: 'dirhd__label', route: '/standings', sel: '.dirhd__label' },
  { name: 'tradecard__cutline', route: '/trade-deadline', sel: '.tradecard__cutline' },
  { name: 'allstarlegacy__leaderyears', route: '/all-star-legacy', sel: '.allstarlegacy__leaderyears' },
  { name: 'slab__label', route: '/pace-of-play', sel: '.slab__label' },
  { name: 'allstarlegacy__honoreeyears', route: '/all-star-legacy', sel: '.allstarlegacy__honoreeyears' },
  { name: 'hlclip__title', route: '/team/158', sel: '.hlclip__title' },
  { name: 'first-scorebook-small', route: '/first-scorebook', sel: 'small' },
  { name: 'fouls-th', route: '/fouls', sel: 'th' },
  { name: 'plink-rehab', route: '/rehab', sel: '.plink' },
  { name: 'aboutfigs__k', route: '/about', sel: '.aboutfigs__k' },
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
const made = []

for (const c of CASES) {
  try {
    await page.goto(`http://localhost:${PORT}${c.route}?nointro`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2400)
    // Pick the instance that actually wraps at the new size.
    const idx = await page.evaluate(([sel]) => {
      const els = [...document.querySelectorAll(sel)]
      for (let i = 0; i < els.length; i++) {
        const e = els[i]
        const s = getComputedStyle(e)
        const r = document.createRange(); r.selectNodeContents(e)
        const tops = new Set()
        for (const rect of r.getClientRects()) if (rect.width > 0) tops.add(Math.round(rect.top))
        if (tops.size > 1 && !s.whiteSpace.includes('nowrap')) return i
      }
      return els.length ? 0 : -1
    }, [c.sel])
    if (idx < 0) { console.log(`  ${c.name}: not found on ${c.route}`); continue }
    const el = page.locator(c.sel).nth(idx)
    await el.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    const bb = await el.boundingBox()
    if (!bb) { console.log(`  ${c.name}: no box`); continue }
    const pad = 16
    const clip = {
      x: Math.max(0, bb.x - pad), y: Math.max(0, bb.y - pad),
      width: Math.min(390 - Math.max(0, bb.x - pad), bb.width + pad * 2),
      height: Math.min(200, bb.height + pad * 2),
    }
    writeFileSync(`${OUT}${c.name}-new.png`, await page.screenshot({ clip }))
    const h = await page.addStyleTag({ content: OLD })
    await page.waitForTimeout(450)
    writeFileSync(`${OUT}${c.name}-old.png`, await page.screenshot({ clip }))
    await h.evaluate((n) => n.remove())
    made.push({ ...c, w: clip.width })
    console.log(`  ${c.name}: shot (${Math.round(clip.width)}x${Math.round(clip.height)})`)
  } catch (e) {
    console.log(`  ${c.name}: ${e.message.split('\n')[0]}`)
  }
}

// One contact sheet: each case, old above new.
const p2 = await browser.newPage({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 2 })
const img = (f) => 'data:image/png;base64,' + readFileSync(OUT + f).toString('base64')
const cells = made.map((c) => `
  <figure style="margin:0 0 20px;break-inside:avoid">
    <figcaption style="font:700 14px system-ui;padding:0 0 6px">${c.name} &mdash; ${c.route}</figcaption>
    <div style="display:flex;gap:14px;align-items:flex-start">
      <div><div style="font:600 11px system-ui;opacity:.7;padding-bottom:3px">11px</div>
        <img src="${img(c.name + '-old.png')}" style="display:block;width:${Math.min(520, c.w * 1.5)}px;border:1px solid #CBC1A7"></div>
      <div><div style="font:600 11px system-ui;opacity:.7;padding-bottom:3px">12px</div>
        <img src="${img(c.name + '-new.png')}" style="display:block;width:${Math.min(520, c.w * 1.5)}px;border:1px solid #CBC1A7"></div>
    </div>
  </figure>`).join('')
await p2.setContent(`<body style="margin:0;background:#EDE6D1;color:#0F1822">
  <div id="w" style="display:inline-block;padding:22px">
    <h1 style="font:700 19px system-ui;margin:0 0 18px">--fs-caption split: every label that gained a line</h1>
    ${cells}
  </div></body>`)
await p2.waitForTimeout(900)
writeFileSync(`${OUT}contact-sheet.png`, await p2.screenshot({ clip: await p2.locator('#w').boundingBox() }))
console.log('\nwrote contact-sheet.png with', made.length, 'cases')
await browser.close()
