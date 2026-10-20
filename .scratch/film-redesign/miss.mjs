import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto('http://localhost:5173/.scratch/film-redesign/index.html?nostarter=1&nointro', { waitUntil: 'networkidle' })
await p.waitForSelector('.ww-film__grid--pit', { timeout: 30000 })
await p.waitForTimeout(1000)
await p.locator('.ww-film__card').first().screenshot({ path: process.argv[2] })
await b.close()
