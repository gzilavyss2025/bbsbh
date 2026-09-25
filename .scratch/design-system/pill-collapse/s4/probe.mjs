// Slice 4 probe (#1131): for each control, does it render at this route, how
// tall is it, and what GROUND does it sit on (the nearest ancestor with a fill)?
// The ground decides outline vs paper: an outline control is see-through, so
// it matches the old paper chip only where the ground IS paper-2.
//   node .scratch/design-system/pill-collapse/s4/probe.mjs http://localhost:5173
import { chromium } from '@playwright/test'
import { TARGETS } from './targets.mjs'

const base = process.argv[2] || 'http://localhost:5173'
const browser = await chromium.launch()
for (const t of TARGETS) {
  const ctx = await browser.newContext({ viewport: { width: t.w || 390, height: 844 } })
  const page = await ctx.newPage()
  if (t.seed) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, t.seed)
  const sep = t.url.includes('?') ? '&' : '?'
  try {
    await page.goto(`${base}${t.url}${sep}nointro`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(800)
    if (t.click) { await page.locator(t.click).first().click(); await page.waitForTimeout(800) }
    for (const c of t.clicks || []) { await page.locator(c).first().click(); await page.waitForTimeout(800) }
    if (t.type) { await page.locator(t.type[0]).first().fill(t.type[1]); await page.waitForTimeout(2500) }
    let found = null
    for (const s of t.sel) {
      const loc = page.locator(s)
      const n = await loc.count()
      if (n) { found = { s, n, el: loc.nth(t.nth || 0) }; break }
    }
    if (!found) { console.log('MISSING', t.name, t.url); await ctx.close(); continue }
    const info = await found.el.evaluate((n) => {
      const cs = getComputedStyle(n)
      let g = n.parentElement
      while (g && ['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(g).backgroundColor)) g = g.parentElement
      const r = n.getBoundingClientRect()
      return { h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10, fill: cs.backgroundColor, ink: cs.color, edge: cs.borderTopColor, ground: g ? getComputedStyle(g).backgroundColor : 'none', groundEl: g ? g.tagName.toLowerCase() + '.' + String(g.className).split(' ')[0] : '' }
    })
    console.log('ok', t.name.padEnd(22), found.s, 'x' + found.n, JSON.stringify(info))
  } catch (e) { console.log('ERR', t.name, String(e).slice(0, 140)) }
  await ctx.close()
}
await browser.close()
