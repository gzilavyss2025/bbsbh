// The slice 4 page check (#1131): every page a moved control renders on, at
// 390px and 900px, with ?nointro. For each: page errors, console errors (the
// missing-headshot 404s are left out), horizontal scroll, and how many of the
// control rendered. Run it on main and on the branch, and compare.
//   node pagecheck.mjs <base>
import { chromium } from '@playwright/test'
import { TARGETS } from './targets.mjs'

const base = process.argv[2] || 'http://localhost:5171'
const seen = new Set()
const pages = TARGETS.filter((t) => !t.url.includes('.scratch') && !seen.has(t.url) && seen.add(t.url))
const browser = await chromium.launch()
for (const t of pages) {
  for (const w of [390, 900]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 } })
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push('page: ' + String(e).slice(0, 120)))
    page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 120)) })
    if (t.seed) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, t.seed)
    await page.goto(`${base}${t.url}${t.url.includes('?') ? '&' : '?'}nointro`)
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {})
    await page.waitForTimeout(1200)
    for (const c of t.clicks || []) await page.locator(c).first().click({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(800)
    const n = await page.locator(t.sel.join(', ')).count()
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    console.log(`${w} ${t.url.padEnd(46)} controls ${String(n).padStart(2)}  overflow ${over}px  errors ${errs.length}${errs.length ? ' ' + errs.join(' | ') : ''}`)
    await ctx.close()
  }
}
await browser.close()
