// The slice 2 page check (#1131): every page a moved tag renders on, at 390px
// and 900px, with ?nointro. For each: console errors, page errors, horizontal
// scroll, and how many of the tag rendered.
//   node pagecheck.mjs [baseURL]
import { chromium } from '@playwright/test'

const base = process.argv[2] || 'http://localhost:5173'
const REVEAL = { 'bbsbh:reveal:777747': '19' }
const PAGES = [
  { url: '/player/christian-yelich-592885', sel: '.contractcard__regime' },
  { url: '/player/jacob-misiorowski-694819', sel: '.contractcard__regime' },
  { url: '/player/freddy-peralta-642547', sel: '.contractcard__regime' },
  { url: '/salaries', sel: 'body' },
]

const browser = await chromium.launch()
let bad = 0
for (const w of [390, 900]) {
  for (const pg of PAGES) {
    const page = await browser.newPage({ viewport: { width: w, height: 844 } })
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)) })
    page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`))
    if (pg.seed) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, pg.seed)
    await page.goto(`${base}${pg.url}?nointro`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {})
    await page.waitForTimeout(1000)
    if (pg.arms) {
      const tab = page.locator('role=tab[name=/arms/i]')
      if (await tab.count()) await tab.first().click()
      else await page.locator('.refbar__chip', { hasText: /arms/i }).first().click()
      await page.waitForTimeout(1500)
    }
    if (pg.focus) {
      const links = page.locator('button.plink')
      for (let i = 0; i < 6; i++) {
        await links.nth(i).focus()
        await page.waitForTimeout(2500)
        if (await page.locator(pg.sel).count()) break
      }
    }
    for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(120) }
    await page.waitForTimeout(600)
    const n = await page.locator(pg.sel).count()
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const ok = !errors.length && scroll <= 0 && n > 0
    if (!ok) bad += 1
    console.log(`${ok ? 'ok ' : 'BAD'} ${w}px ${pg.url.padEnd(50)} tags=${n} hscroll=${scroll}${errors.length ? ` errors=${JSON.stringify(errors)}` : ''}`)
    await page.close()
  }
}
await browser.close()
console.log(bad ? `${bad} page(s) need a look` : 'every page clean')
