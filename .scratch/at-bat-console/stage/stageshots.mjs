import { chromium } from '/home/user/bbsbh/node_modules/playwright/index.mjs'
const PAGE = 'file:///home/user/bbsbh/node_modules/.cache/innings-console/stage.html'
const OUT = process.argv[2]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
async function open(v, g, half, n, sheet) {
  const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 })
  await p.addInitScript(([g, half, n]) => { const s = { view: 'H', g, half, n }; for (const k in s) localStorage.setItem('ics2:' + k, JSON.stringify(s[k])) }, [g, half, n])
  await p.goto(`${PAGE}#${v}`)
  await p.addStyleTag({ content: '.screen,.scroll{height:auto!important;max-height:none!important;overflow:visible!important}' })
  if (sheet) await p.click('[data-sheet="runners"]')
  return p
}
const at = (p, ms) => p.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms }), ms)
const moments = [['dav', 5, 1, 3, 7400], ['hr', 0, 11, 4, 4400]]
for (const v of ['v1', 'v2', 'v3']) for (const [tag, g, half, n, end] of moments) {
  const p = await open(v, g, half, n)
  for (let t = 0, i = 0; t <= end; t += 100, i++) { await at(p, t); await p.locator('[data-stage]').screenshot({ path: `${OUT}/f-${v}-${tag}-${String(i).padStart(3, '0')}.png` }) }
  await at(p, end + 2000)
  await p.locator('.phone').first().screenshot({ path: `${OUT}/phone-${v}-${tag}.png` })
  await p.close()
}
// sealed (before the half's first tap) and the runners sheet
let p = await open('v1', 5, 1, 0); await p.locator('.phone').first().screenshot({ path: `${OUT}/phone-sealed.png` }); await p.close()
p = await open('v1', 0, 11, 4, true); await at(p, 99999); await p.locator('.phone').first().screenshot({ path: `${OUT}/phone-runners-sheet.png` }); await p.close()
await b.close()
