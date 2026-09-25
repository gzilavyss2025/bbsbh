// Quick look: which of a few selectors render at a URL (slice 4 route finding).
//   node peek.mjs <base> <url> <sel,sel,...> [seedJSON] [clicks,...]
import { chromium } from '@playwright/test'
const [base, url, sels, seed, clicks] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
if (seed) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, JSON.parse(seed))
await page.goto(`${base}${url}${url.includes('?') ? '&' : '?'}nointro`)
await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(3000)
for (const c of (clicks || '').split(',').filter(Boolean)) { await page.locator(c).first().click(); await page.waitForTimeout(2000) }
for (const s of sels.split(',')) console.log(s, await page.locator(s).count())
await browser.close()
