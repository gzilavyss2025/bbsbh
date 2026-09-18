// GROUND TRUTH for the --fs-caption split: walk real routes, find every element
// rendering at 11px, and read the face the BROWSER resolved for it. A static
// read of the stylesheet cannot do this — 122 of the 793 rules inherit their
// family from an ancestor, which only the DOM knows.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
const PORT = process.env.E2E_PORT || 5173
const ROUTES = [
  '/game/823035', '/game/823035/away', '/game/823035/home', '/game/823035/innings',
  '/game/823035/box', '/game/823035/scorecard', '/game/778442', '/game/777877',
  '/design-lab', '/identity-lab', '/animation-lab', '/logos', '/first-scorebook',
  '/player/677651', '/player/669203', '/umpire/1', '/postseason-history',
  '/all-star-legacy', '/leaders/aplus', '/postseason-leaders', '/awards',
  '/', '/standings', '/leaders', '/salaries', '/umpires', '/attendance',
  '/prospects', '/farm-system-rankings', '/rehab', '/awards', '/milestones',
  '/trade-deadline', '/logbook', '/first-scorebook', '/photos', '/fouls',
  '/run-value', '/situational-records', '/abs-challenges', '/doubleheaders',
  '/pace-of-play', '/bullpen-availability', '/postseason-race', '/all-star-rosters',
  '/team/158', '/team/158/roster', '/team/158/schedule', '/team/158/stats',
  '/team/158/transactions', '/team/158/contracts', '/more', '/about', '/aaa',
]
const FACE = (f) => {
  const s = (f || '').toLowerCase()
  if (s.includes('barlow')) return 'display'
  if (s.includes('jetbrains') || s.includes('mono')) return 'mono'
  if (s.includes('lora') || s.includes('georgia')) return 'read'
  if (s.includes('source sans')) return 'body'
  return 'other:' + s.slice(0, 24)
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const seen = new Map() // class -> {face, routes:Set, text}
for (const r of ROUTES) {
  try {
    await page.goto(`http://localhost:${PORT}${r}?nointro`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2200)
    const found = await page.evaluate(() => {
      const out = []
      for (const e of document.querySelectorAll('*')) {
        const s = getComputedStyle(e)
        if (Math.abs(parseFloat(s.fontSize) - 11) > 0.01) continue
        const cls = (typeof e.className === 'string' ? e.className : '').trim()
        out.push({ cls: cls || e.tagName.toLowerCase(), fam: s.fontFamily, txt: (e.textContent || '').trim().slice(0, 40), len: (e.textContent||'').trim().length })
      }
      return out
    })
    for (const f of found) {
      const key = f.cls
      if (!seen.has(key)) seen.set(key, { face: FACE(f.fam), routes: new Set(), txt: f.txt, maxLen: f.len })
      const rec = seen.get(key)
      rec.routes.add(r)
      if (f.len > rec.maxLen) { rec.maxLen = f.len; rec.txt = f.txt }
    }
    process.stdout.write('.')
  } catch (e) { process.stdout.write('x') }
}
console.log('')
const rows = [...seen].map(([cls, v]) => ({ cls, face: v.face, routes: [...v.routes].length, maxLen: v.maxLen, txt: v.txt }))
rows.sort((a, b) => a.face.localeCompare(b.face) || b.maxLen - a.maxLen)
const by = {}
for (const r of rows) by[r.face.split(':')[0]] = (by[r.face.split(':')[0]] || 0) + 1
console.log('distinct 11px class signatures seen rendering, by face:', by)
writeFileSync('.scratch/design-system/prB/rendered-11px-2.json', JSON.stringify(rows, null, 1))
console.log('\nBODY face, longest text first — the "running copy" candidates:')
console.log(rows.filter(r => r.face === 'body' || r.face === 'read').slice(0, 30)
  .map(r => `  ${String(r.maxLen).padStart(4)}ch  ${r.face.padEnd(5)}  ${r.cls.slice(0, 44).padEnd(46)} ${JSON.stringify(r.txt).slice(0,44)}`).join('\n'))
await browser.close()
