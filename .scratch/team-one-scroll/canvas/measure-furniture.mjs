// WHAT THE BAND SYSTEM COSTS A PAGE IN HEIGHT, measured on the drawing rather
// than added up from the spec. The cards are a known sum; everything else on
// the page — the seams, the band heads, the sub-head, the jump bar, the gaps
// between cards — is the furniture, and the floor pays for it out of a much
// smaller page than Milwaukee does.
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CARDS = { 675: 7110, 249: 11332, 158: 17594 }
const SETS = {
  675: ['P2-Page-675.dc.html'],
  158: ['P2-Page-158-1.dc.html', 'P2-Page-158-2.dc.html', 'P2-Page-158-3.dc.html'],
}
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

for (const [club, names] of Object.entries(SETS)) {
  let total = 0
  for (const name of names) {
    const src = readFileSync(join(HERE, 'project', name), 'utf8')
      .replace('<script src="./support.js"></script>', '')
      .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
      .replace(/<\/?x-dc>/g, '').replace(/<\/?helmet>/g, '')
      .replace(/(<div style="width:390px;height:)\d+(px)/, '$1auto')
    await page.setContent(src, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    // The legend, the jump bar and the "continues" caption are BOARD devices,
    // not page furniture, so they come off before the comparison.
    total += await page.evaluate(() => {
      const body = document.querySelector('.pagebody').getBoundingClientRect().height
      const off = ['.legend', '.jumpstuck', '.cap']
        .flatMap((s) => [...document.querySelectorAll(s)])
        .filter((el) => el.closest('.card') === null)
        .reduce((a, el) => a + el.getBoundingClientRect().height, 0)
      return body - off
    })
  }
  const cards = CARDS[club]
  console.log(`${club}: page ${Math.round(total)}px · cards ${cards} · furniture ${Math.round(total - cards)}px` +
    ` (${((total - cards) / cards * 100).toFixed(1)}% of the cards)`)
}
await browser.close()
