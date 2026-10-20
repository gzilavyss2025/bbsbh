import { chromium } from '/home/user/bbsbh/node_modules/playwright/index.mjs'
const out = process.argv[2]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const v of ['a', 'b']) {
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.goto(`http://localhost:5173/.scratch/film-redesign/newspaper.html?v=${v}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/np-${v}.png`, clip: { x: 0, y: 0, width: 390, height: 900 } })
  console.log(v, await p.evaluate(() => document.fonts.check('14px "Source Sans 3"')))
  await p.close()
}
await b.close()
