// The regression class this slice can cause, and the only one worth hunting:
// 422 label rules went 11px -> 12px, so text that used to fit its box may now
// clip, wrap, or push a page sideways. A screenshot pass will not find that on
// 50 routes; a measurement will.
//
// Three checks per route, all at phone width, and all of them A/B'd against the
// OLD sizes injected back over the page, so "it overflows" is only reported
// when the old size did not.
//
//   1. horizontal page scroll  — documentElement.scrollWidth > clientWidth
//   2. clipped text            — scrollWidth > clientWidth on an element whose
//                                overflow is hidden and whose text is one line
//   3. line-count growth       — an element that fitted on N lines and now
//                                needs N+1
//
// Run: E2E_PORT=5173 node .scratch/design-system/prB/overflow.mjs
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const PORT = process.env.E2E_PORT || 5173
const ROUTES = [
  '/', '/standings', '/leaders', '/salaries', '/umpires', '/attendance',
  '/prospects', '/farm-system-rankings', '/rehab', '/awards', '/milestones',
  '/trade-deadline', '/logbook', '/first-scorebook', '/photos', '/fouls',
  '/run-value', '/situational-records', '/abs-challenges', '/doubleheaders',
  '/pace-of-play', '/bullpen-availability', '/postseason-race', '/all-star-rosters',
  '/postseason-history', '/all-star-legacy', '/postseason-leaders', '/more', '/about',
  '/team/158', '/team/158/roster', '/team/158/schedule', '/team/158/stats',
  '/team/158/transactions', '/team/158/contracts',
  '/game/823035', '/game/823035/away', '/game/823035/home', '/game/823035/innings',
  '/game/823035/box', '/game/823035/scorecard', '/game/778442', '/game/777877',
  '/player/677651', '/player/669203', '/aaa', '/design-lab',
]

// The sizes as they were before the split, injected back at the top of the
// cascade. --fs-label carried the 422; --fs-small the 52.
const OLD = `:root { --fs-label: 11px; --fs-small: 11px; }`

// Measure once. Returns a map keyed by a stable element signature.
const MEASURE = () => {
  const out = {}
  const doc = document.documentElement
  out['@page'] = { sw: doc.scrollWidth, cw: doc.clientWidth }
  let i = 0
  for (const e of document.querySelectorAll('*')) {
    const s = getComputedStyle(e)
    const size = parseFloat(s.fontSize)
    if (!(size >= 10 && size <= 14)) continue
    const txt = (e.textContent || '').trim()
    if (!txt) continue
    const cls = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/)[0] || e.tagName
    const key = `${cls}#${i++}`
    // Count LINE BOXES, not scrollHeight/lineHeight -- the derived count moves
    // with padding when the font size changes and reports a wrap on an element
    // carrying `white-space: nowrap`, which cannot wrap at all. A Range over
    // the element's own contents yields one client rect per rendered line, so
    // this is the real answer.
    let lines = 0
    try {
      const rng = document.createRange()
      rng.selectNodeContents(e)
      const tops = new Set()
      for (const rect of rng.getClientRects()) if (rect.width > 0 || rect.height > 0) tops.add(Math.round(rect.top))
      lines = tops.size
    } catch { lines = 0 }
    out[key] = {
      size, kids: e.childElementCount, nowrap: s.whiteSpace.includes('nowrap'),
      sw: e.scrollWidth, cw: e.clientWidth,
      sh: e.scrollHeight, ch: e.clientHeight,
      lines,
      hidden: s.overflowX === 'hidden' || s.overflow === 'hidden' || s.textOverflow === 'ellipsis',
      txt: txt.slice(0, 40),
    }
  }
  return out
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const findings = []

for (const r of ROUTES) {
  try {
    await page.goto(`http://localhost:${PORT}${r}?nointro`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2200)
    const now = await page.evaluate(MEASURE)
    const h = await page.addStyleTag({ content: OLD })
    await page.waitForTimeout(500)
    const before = await page.evaluate(MEASURE)
    await h.evaluate((n) => n.remove())

    // page-level sideways scroll that the old sizes did not cause
    const pn = now['@page'], pb = before['@page']
    if (pn.sw > pn.cw && pb.sw <= pb.cw) {
      findings.push({ route: r, kind: 'page-scroll', detail: `${pb.sw}px -> ${pn.sw}px against ${pn.cw}px viewport` })
    }

    for (const [k, a] of Object.entries(now)) {
      if (k === '@page') continue
      const b = before[k]
      if (!b) continue // the signature moved; not comparable, so not reported
      if (a.hidden && a.sw > a.cw + 1 && b.sw <= b.cw + 1) {
        findings.push({ route: r, kind: 'clipped', el: k, detail: `${b.sw}/${b.cw} -> ${a.sw}/${a.cw}`, txt: a.txt })
      } else if (a.lines > b.lines && a.lines > 0 && b.lines > 0 && !a.nowrap && a.kids === 0 && a.size !== b.size) {
        // Leaf elements only, and only where THIS element's own size moved --
        // a container growing because a child grew is the same finding twice.
        const kind = a.size >= 13 ? 'extra-line-copy' : 'extra-line-label'
        findings.push({ route: r, kind, el: k, detail: `${b.size}px ${b.lines}ln -> ${a.size}px ${a.lines}ln`, txt: a.txt })
      }
    }
    process.stdout.write(findings.length ? '!' : '.')
  } catch {
    process.stdout.write('x')
  }
}

console.log('\n')
if (!findings.length) {
  console.log('No new clipping, no new wrapping, no new sideways scroll across', ROUTES.length, 'routes.')
} else {
  const byKind = {}
  for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1
  console.log(findings.length, 'finding(s):', byKind, '\n')
  for (const f of findings.slice(0, 60)) {
    console.log(`  ${f.kind.padEnd(11)} ${f.route.padEnd(28)} ${(f.el || '').padEnd(30)} ${f.detail}${f.txt ? '  ' + JSON.stringify(f.txt) : ''}`)
  }
}
writeFileSync('.scratch/design-system/prB/overflow-findings.json', JSON.stringify(findings, null, 1))
await browser.close()
