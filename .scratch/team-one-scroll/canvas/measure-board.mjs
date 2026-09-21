// Measures an artboard's own markup in a browser, so a figure printed ON a
// board is one the board actually produces. The jump-bar table said "measured,
// not assumed" while its pill widths were computed from a per-character rate,
// and the drawing clipped where the arithmetic said it fitted.
//
//   MSYS_NO_PATHCONV=1 node .scratch/team-one-scroll/canvas/measure-board.mjs P2-Jump.dc.html ".jump__row"
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const [name, sel = '.jump__row'] = process.argv.slice(2)
const src = readFileSync(join(HERE, 'project', name), 'utf8')
  .replace('<script src="./support.js"></script>', '')
  .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
  .replace(/<\/?x-dc>/g, '').replace(/<\/?helmet>/g, '')

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.setContent(src, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
console.log(JSON.stringify(await page.evaluate((s) => [...document.querySelectorAll(s)].map((row) => ({
  room: Math.round(row.parentElement.clientWidth),
  pills: Math.round(row.scrollWidth),
  each: [...row.children].map((c) => [c.textContent.trim(), Math.round(c.getBoundingClientRect().width)]),
})), sel), null, 1))
await browser.close()
