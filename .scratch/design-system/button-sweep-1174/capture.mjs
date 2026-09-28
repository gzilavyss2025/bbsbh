// Before/after crops for #1174 (the last hand-drawn buttons) and #1151 (the
// club band off kraft), at 390px with ?nointro.
//
//   node .scratch/design-system/button-sweep-1174/capture.mjs before [baseURL]
//   node .scratch/design-system/button-sweep-1174/capture.mjs after  [baseURL]
//
// Seeds two stamps (2026 and 2025, so the Game Log shows its season chips and
// the box score shows the mint strip's mode toggle) and spoils 2026-09-27, so
// the slate's result cards are face up. Writes <phase>/<name>.png and
// <phase>/sheet.json (height, width, fill, ink, edge, radius, font).
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const phase = process.argv[2] || 'before'
const base = process.argv[3] || 'http://localhost:5169'
const out = join(dirname(fileURLToPath(import.meta.url)), phase)
mkdirSync(out, { recursive: true })

const now = Date.now()
const STAMPS = {
  823731: { state: 'on', mode: 'watched', stampedAt: now, updatedAt: now, note: '', date: '2026-09-27', placement: null },
  776244: { state: 'on', mode: 'followed', stampedAt: now - 1e10, updatedAt: now - 1e10, note: '', date: '2025-09-20', placement: null },
}
const GAME = '/09272026/stlmil'
const TARGETS = [
  { name: 'stampstrip-modes', url: `${GAME}/boxscore`, click: '.stampstrip__disclose', sel: '.stampstrip__modes', box: true },
  { name: 'logbook-seasons', url: '/logbook', click: '.stampcard__head', sel: '.logbook__seasons', box: true },
  { name: 'scorecard-switch', url: `${GAME}/scorecard`, sel: '.scpage__bar', box: true },
  { name: 'flipback-toprow', url: '/09272026', sel: '.flipback__topRow', box: true },
  { name: 'flipback-boxbtn', url: '/09272026', sel: '.flipback__door, .flipback__boxbtn' },
  { name: 'flipback-watchbtn', url: '/09272026', sel: '.flipback__watchbtn' },
  { name: 'salaries-band', url: '/salaries', sel: '.sectionhead--band', box: true },
  { name: 'team-band', url: '/team/158/numbers', sel: '.sectionhead--band', box: true },
  { name: 'house-band-winprob', url: `${GAME}/boxscore`, sel: '.sectionhead--house', box: true },
]
const PROPS = ['height', 'width', 'backgroundColor', 'color', 'borderTopColor', 'borderBottomColor', 'borderBottomWidth', 'borderTopWidth', 'borderRadius', 'fontFamily', 'fontSize']

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript((stamps) => {
  localStorage.setItem('bbsbh:stamps', JSON.stringify(stamps))
  localStorage.setItem('bbsbh:spoiledDays', JSON.stringify(['2026-09-27']))
}, STAMPS)
const sheet = {}
for (const t of TARGETS) {
  const page = await ctx.newPage()
  try {
    await page.goto(`${base}${t.url}?nointro`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    if (t.click) {
      await page.locator(t.click).first().click({ timeout: 30000 })
      await page.waitForTimeout(800)
    }
    const loc = page.locator(t.sel).first()
    await loc.waitFor({ state: 'visible', timeout: 30000 })
    await loc.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    const kids = await loc.evaluate((n, [props, box]) => {
      const pick = (el) => {
        const cs = getComputedStyle(el)
        const o = { cls: String(el.className), text: el.textContent.trim().slice(0, 30) }
        for (const p of props) o[p] = cs[p]
        o.rectH = Math.round(el.getBoundingClientRect().height * 10) / 10
        return o
      }
      return box ? [pick(n), ...[...n.querySelectorAll('button, a')].map(pick)] : [pick(n)]
    }, [PROPS, !!t.box])
    sheet[t.name] = kids
    await loc.screenshot({ path: join(out, `${t.name}.png`) })
    console.log('ok', t.name)
  } catch (e) {
    sheet[t.name] = { missing: String(e.message).split('\n')[0] }
    console.log('MISSING', t.name, String(e.message).split('\n')[0])
  }
  await page.close()
}
writeFileSync(join(out, 'sheet.json'), JSON.stringify(sheet, null, 1))
await browser.close()
