import { chromium } from 'playwright'
const [out, tag] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const day of ['off', 'game']) {
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await p.goto(`http://localhost:5173/.scratch/film-redesign/index.html?day=${day}&nointro`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${out}/${tag}-${day}.png`, fullPage: true })
  console.log(day, errs.slice(0, 3))
  await p.close()
}
await b.close()
