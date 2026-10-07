import { chromium } from '/home/user/bbsbh/node_modules/playwright/index.mjs'
const CACHE = '/home/user/bbsbh/node_modules/.cache/innings-console'
const OUT = process.argv[2]
const moments = [['e2', 1, 1, 3], ['pk', 1, 7, 3], ['pkcs', 4, 0, 2]]
const b = await chromium.launch({ executablePath: process.env.CHROME })
for (const opt of ['A', 'B', 'C']) for (const [tag, g, half, n] of moments) {
  const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 })
  await p.addInitScript(([g, half, n]) => { const s = { view: 'H', g, half, n }; for (const k in s) localStorage.setItem('ics2:' + k, JSON.stringify(s[k])) }, [g, half, n])
  await p.goto(`file://${CACHE}/opt-${opt}.html`)
  await p.addStyleTag({ content: '.screen,.scroll{height:auto!important;max-height:none!important;overflow:visible!important}' })
  await p.locator('.phone').first().screenshot({ path: `${OUT}/${opt}-${tag}.png` })
  await p.locator('.slot--out').first().screenshot({ path: `${OUT}/z-${opt}-${tag}.png`, scale: 'device' })
  await p.close()
}
await b.close()
