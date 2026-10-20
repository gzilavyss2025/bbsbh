import { chromium } from 'playwright'
const out = process.argv[2]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const day of ['off', 'game']) {
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.goto(`http://localhost:5173/.scratch/film-redesign/index.html?day=${day}&nointro`, { waitUntil: 'networkidle' })
  await p.waitForSelector('.ww-film__people', { timeout: 30000 })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/p-${day}.png`, fullPage: true })
  await p.close()
}
await b.close()
