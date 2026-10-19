// Screenshots of the wireframe: phone (390) and wide (1280), off day and game day.
import { chromium } from 'playwright'
const out = process.argv[2]
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())
for (const [w, tag] of [[390, 'phone'], [1280, 'wide']]) for (const day of ['off', 'game']) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: w < 500 ? 2 : 1 })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  await p.goto(`http://localhost:5173/.scratch/ws-scouting/index.html?day=${day}&nointro`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  await p.screenshot({ path: `${out}/ws-${day}-${tag}.png`, fullPage: true })
  console.log(day, tag, errs.slice(0, 3))
  await p.close()
}
await b.close()
