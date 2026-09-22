// Walks routes at 390px and records the COMPUTED padding and gap of every
// element, in DOM order.
//
// Run it once on a branch and once with main's stylesheets checked out, then
// diff the two files. For C1 the two had to be IDENTICAL, which is the
// browser-level proof that the sweep moved no rendered pixel. For C2, which
// does move values, the diff is the measurement of what moved and where.
//
//   node .scratch/design-system/prC/walk-computed.mjs branch
//   git checkout origin/main -- src/styles src/tokens
//   node .scratch/design-system/prC/walk-computed.mjs main
//   git checkout HEAD -- src/styles src/tokens
//
// WAIT FOR THE PAGE, NOT FOR A TIMEOUT. The slate loads live game cards, and a
// 2.5s wait reported 184 elements against main's 440 — a load race that reads
// exactly like a real difference. networkidle plus a settle is what made the
// two runs agree.
//
// Needs a dev server; set BASE (default http://localhost:5169) and SHOTS.
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const label = process.argv[2] ?? 'branch'
const BASE = process.env.BASE ?? 'http://localhost:5169'
const ROUTES = [
  ['slate', '/'],
  ['standings', '/standings'],
  ['postseason', '/postseason'],
  ['umpires', '/umpires'],
  ['umpire', '/umpire/lance-barksdale-427013'],
  ['player', '/player/christian-yelich-592885'],
  ['team-hub', '/team/158'],
  ['team-roster', '/team/158/roster'],
  ['salaries', '/salaries'],
  ['about', '/about'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`${m.text()}`.slice(0, 140))
})
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 140)}`))

const out = {}
for (const [key, path] of ROUTES) {
  const before = errors.length
  try {
    await page.goto(`${BASE}${path}?nointro`, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {})
    await page.waitForTimeout(6000)
    const data = await page.evaluate(() => {
      const rows = []
      for (const el of document.querySelectorAll('*')) {
        const s = getComputedStyle(el)
        const v = [
          s.paddingTop,
          s.paddingRight,
          s.paddingBottom,
          s.paddingLeft,
          s.rowGap,
          s.columnGap,
        ].join('|')
        if (v !== '0px|0px|0px|0px|normal|normal') rows.push(`${el.tagName}.${el.className}::${v}`)
      }
      return {
        rows,
        scrollW: document.documentElement.scrollWidth,
        scrollH: document.documentElement.scrollHeight,
      }
    })
    out[key] = data
    console.log(
      `  ${key.padEnd(12)} ${String(data.rows.length).padStart(5)} elements  ` +
        `scrollW ${data.scrollW}${data.scrollW > 390 ? '  <-- OVERFLOW' : ''}  ` +
        `errors ${errors.length - before}`,
    )
  } catch (err) {
    out[key] = { error: String(err).slice(0, 140) }
    console.log(`  ${key.padEnd(12)} FAILED: ${String(err).slice(0, 100)}`)
  }
}

writeFileSync(`${process.env.SHOTS}/walk-${label}.json`, JSON.stringify(out, null, 2))
console.log(`console errors: ${errors.length}`)
for (const e of [...new Set(errors)].slice(0, 8)) console.log(`   ! ${e}`)
await browser.close()
