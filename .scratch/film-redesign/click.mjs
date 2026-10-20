import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:5173/.scratch/film-redesign/index.html?nointro', { waitUntil: 'networkidle' })
await p.getByRole('button', { name: 'Scoring plays' }).first().click()
await p.waitForTimeout(300)
await p.screenshot({ path: process.argv[2], fullPage: true })
await b.close()
