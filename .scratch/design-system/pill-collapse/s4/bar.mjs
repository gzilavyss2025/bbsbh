// The masthead toggle's club bar colour, and the selected pill's edge against
// it (slice 4): the ground a navy selected capsule has to separate from.
//   node bar.mjs <base> <url>
import { chromium } from '@playwright/test'
import { ratio } from '../../../../src/lib/design/contrastPairings.js'
const [base, url] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto(`${base}${url}?nointro`)
await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(2000)
const el = page.locator('.mastheadpill').first()
await el.click()
await page.waitForTimeout(500)
const c = await el.evaluate((n) => {
  let g = n.parentElement
  while (g && getComputedStyle(g).backgroundColor === 'rgba(0, 0, 0, 0)') g = g.parentElement
  return { pill: getComputedStyle(n).backgroundColor, bar: getComputedStyle(g).backgroundColor }
})
const hex = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('')
console.log(url, c, 'pill vs bar', ratio(hex(c.pill), hex(c.bar)).toFixed(2))
await browser.close()
