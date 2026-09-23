// Page errors and horizontal overflow at 390px on every route the handoff lists.
import { chromium } from '@playwright/test'
const base = process.argv[2] || 'http://localhost:5173'
const ROUTES = [
  '/', '/team/158', '/player/christian-yelich-592885', '/player/christian-yelich-592885/history',
  '/09222026/tbnyy/lineup1', '/09222026/tbnyy/top1', '/09202026/milbal/top1', '/09202026/milbal/boxscore',
  '/09202026/milbal/scorecard', '/umpires', '/profile', '/logbook', '/design-lab', '/all-star-rosters',
  '/all-star-legacy',
]
const b = await chromium.launch()
for (const r of ROUTES) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
  await p.goto(`${base}${r}?nointro`)
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(700)
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`${over > 0 ? 'OVERFLOW ' + over + 'px' : 'ok'}  ${r}${errs.length ? '  ERR ' + errs.join(' | ') : ''}`)
  await p.close()
}
await b.close()
