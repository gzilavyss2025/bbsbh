// Dev helper: screenshot a URL at 390px. Usage: node shot.mjs outPrefix url [split|viewport] [height]
import { chromium } from 'playwright'
const [out, url, mode = 'split', h = '844'] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: Number(h) }, deviceScaleFactor: 1 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(url, { waitUntil: 'load', timeout: 60000 })
await p.waitForTimeout(3000)
if (mode === 'viewport') {
  await p.screenshot({ path: `${out}.jpg`, type: 'jpeg', quality: 75 })
} else {
  const total = await p.evaluate(() => document.documentElement.scrollHeight)
  const seg = 1100
  for (let i = 0, y = 0; y < total; i++, y += seg) {
    await p.screenshot({ path: `${out}-${i}.jpg`, type: 'jpeg', quality: 75, fullPage: true, clip: { x: 0, y, width: 390, height: Math.min(seg, total - y) } })
  }
  console.log('segments', Math.ceil(total / seg), 'height', total)
}
if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 10).join('\n'))
await b.close()
