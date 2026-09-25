// Console and page errors at a route (slice 4 debugging).
//   node errs.mjs <base> <url>
import { chromium } from '@playwright/test'
const [base, url] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)) })
page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0, 300)))
await page.goto(`${base}${url}${url.includes('?') ? '&' : '?'}nointro`)
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(3000)
console.log('revealsplit', await page.locator('.revealsplit__btn--quiet').count(), 'body', (await page.locator('body').innerText()).slice(0, 200).replace(/\n/g, ' | '))
await browser.close()
