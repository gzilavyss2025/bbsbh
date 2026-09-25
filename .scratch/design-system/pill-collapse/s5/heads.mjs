// Slice 5 helper: list the card heads on a route (text + any button in them).
//   node .scratch/design-system/pill-collapse/s5/heads.mjs http://localhost:5173 /team/158/games
import { chromium } from '@playwright/test'
const [base, path] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}nointro`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(250) }
await page.waitForTimeout(1500)
console.log(await page.evaluate(() => [...document.querySelectorAll('.thub-card__head, .tstats-card__head')].map((h) => h.textContent.trim().slice(0, 60) + ' | ' + [...h.querySelectorAll('button,a')].map((b) => b.className).join(','))))
await browser.close()
