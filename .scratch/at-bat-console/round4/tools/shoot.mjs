// Shoots the round-4 mocks: node tools/shoot.mjs OUTDIR d s v [extra] — four widths.
// The viewport grows to the page's full height so the fixed bottom bar lands
// at the foot of the page, where a reader scrolls to it.
import { chromium } from '/home/user/bbsbh/node_modules/playwright/index.mjs'
const [,, out, d, s, v, extra = ''] = process.argv
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
for (const [w, h] of [[390, 763], [820, 1180], [1180, 820], [1440, 900]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true })
  p.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 200)))
  await p.goto(`http://localhost:5173/.scratch/at-bat-console/round4/mock/index.html?nointro&d=${d}&s=${s}&v=${v}${extra}`, { waitUntil: 'load' })
  await p.waitForSelector('#r4stage .rolling', { timeout: 30000 })
  await p.waitForTimeout(3500)
  const full = await p.evaluate(() => document.documentElement.scrollHeight)
  if (full > h) { await p.setViewportSize({ width: w, height: full }); await p.waitForTimeout(800) }
  const name = `${out}/d${d}-${s}-${v}${extra ? '-sheet' : ''}-${w}.png`
  await p.screenshot({ path: name, fullPage: true })
  const bad = await p.evaluate(() => [...document.querySelectorAll('#r4stage *')].filter((el) => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'hidden').length + ' clipped-x; page overflow ' + (document.documentElement.scrollWidth - innerWidth))
  console.log(name, full, bad)
  await p.close()
}
await b.close()
