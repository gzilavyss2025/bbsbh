// Slice 4 keyboard and routing check (#1131). For a toggle: Tab reaches it
// with a visible ring, Space flips aria-pressed, Enter flips it back. For a
// one-of-many filter (`single`): Space selects one, and Enter on the first
// selects that one and clears the other. For the
// records link: a click routes on the client (a marker set on window survives,
// so the page did not reload), and Enter on a focused chip follows it too.
//   node keys.mjs <base>
import { chromium } from '@playwright/test'
const base = process.argv[2] || 'http://localhost:5171'
const STAMPS = {
  'bbsbh:stamps': JSON.stringify({
    823035: { state: 'on', stampedAt: 1783468800000, date: '2026-07-07' },
    777747: { state: 'on', stampedAt: 1748390400000, date: '2025-05-27' },
  }),
}
const TOGGLES = [
  ['/07072026/milstl-2/lineup1', '.mastheadpill'],
  ['/09222026', '.slate-filterbar__chip', { 'bbsbh:spoiledDays': '["2026-09-22"]' }],
  ['/player/jacob-misiorowski-694819/analytics', '.cmdmap__chip >> nth=1', null, true],
  ['/team/158/minors', '.depthpos >> nth=1', null, true],
  ['/first-scorebook', '.scorebookstory__filters .pill >> nth=1', null, true],
  ['/logbook/stats', '.logbookstats__levels .pill >> nth=1', STAMPS, true],
  ['/logbook', '.stampsheet__levels .pill >> nth=1', STAMPS, true],
]
const browser = await chromium.launch()
let bad = 0
const open = async (url, seed) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  if (seed) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, seed)
  await page.goto(`${base}${url}${url.includes('?') ? '&' : '?'}nointro`)
  await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return page
}
for (const [url, sel, seed, single] of TOGGLES) {
  const page = await open(url, seed)
  const el = page.locator(sel).first()
  await el.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  const ring = await el.evaluate((n) => document.activeElement === n && n.matches(':focus-visible') && getComputedStyle(n).outlineStyle === 'solid')
  const a0 = await el.getAttribute('aria-pressed')
  await page.keyboard.press('Space'); await page.waitForTimeout(1500)
  const a1 = await el.getAttribute('aria-pressed')
  let a2
  let ok
  if (single) {
    const next = page.locator(sel.replace('nth=1', 'nth=0')).first()
    await next.focus()
    await page.keyboard.press('Enter'); await page.waitForTimeout(400)
    a2 = [await el.getAttribute('aria-pressed'), await next.getAttribute('aria-pressed')]
    ok = ring && a0 === 'false' && a1 === 'true' && a2[0] === 'false' && a2[1] === 'true'
  } else {
    await page.keyboard.press('Enter'); await page.waitForTimeout(400)
    a2 = await el.getAttribute('aria-pressed')
    ok = ring && a0 !== null && a1 !== a0 && a2 === a0
  }
  if (!ok) bad += 1
  console.log(ok ? 'ok ' : 'BAD', url, sel, { ring, a0, a1, a2 })
  await page.close()
}
{
  const url = '/situational-records?metric=scored-first'
  const page = await open(url)
  await page.evaluate(() => { window.__noReload = 1 })
  const link = page.locator('.trrank__related a:not([aria-current])').first()
  const href = await link.getAttribute('href')
  await link.click(); await page.waitForTimeout(1500)
  const kept = await page.evaluate(() => window.__noReload === 1)
  const current = await page.locator('.trrank__related a[aria-current="page"]').getAttribute('href')
  const chip2 = page.locator('.trrank__related a:not([aria-current])').first()
  const href2 = await chip2.getAttribute('href')
  await chip2.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(1500)
  const kept2 = await page.evaluate(() => window.__noReload === 1)
  const current2 = await page.locator('.trrank__related a[aria-current="page"]').getAttribute('href')
  const ok = kept && current === href && kept2 && current2 === href2
  if (!ok) bad += 1
  console.log(ok ? 'ok ' : 'BAD', 'records link', { clickRouted: kept, current, href, enterRouted: kept2, current2, href2 })
  await page.close()
}
await browser.close()
console.log(bad ? `${bad} BAD` : 'all ok')
process.exitCode = bad ? 1 : 0
