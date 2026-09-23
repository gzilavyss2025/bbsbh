// Is the text of a figure tag centred in its pill? (#1131 slice 2)
//
//   SLICE=2 node centre.mjs before http://localhost:5172
//   SLICE=2 node centre.mjs after  http://localhost:5173
//   python centre.py            (reads s2/centre/, prints the table)
//
// For each mono tag, at dpr 1, 2 and 3: a screenshot of the tag plus a 3px
// margin, and the tag's own box (fractional CSS px, from the DOM), its border
// widths, its fill and its ink. centre.py finds the glyph ink inside the
// pill's inner box (inside the border) and compares the two centres. It
// measures against the pill's own FILL colour, not white: the page is paper.
//
// The browser snaps text to whole device pixels, so a sub-pixel (em) nudge
// changes nothing; the fix, when one is needed, is a whole-pixel padding-top.
// Where the text lands also depends on the tag's own fractional position on
// the page, so each tag is sampled up to N times (N=8), at the different
// positions its copies happen to sit at.
//
//   CSS='.tlead__level { padding-top: 2px }' SLICE=2 node centre.mjs trial http://localhost:5173
// injects a style before measuring, to try a fix without editing a file.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const phase = process.argv[2] || 'after'
const base = process.argv[3] || 'http://localhost:5173'
const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, `s${process.env.SLICE || '2'}`, 'centre', phase)
mkdirSync(out, { recursive: true })

const REVEAL_BOX = { 'bbsbh:boxreveal:777747': '1' }
const TARGETS = [
  { name: 'wiredock-count', url: '/09222026', sel: '.wiredock__count' },
  { name: 'winprob-chip', url: '/05272025/bosmil/boxscore', seed: REVEAL_BOX, sel: '.winprob__ledger-chip' },
  { name: 'tlead-level', url: '/leaders/org/158', sel: '.tlead__level' },
  { name: 'affiliate-level', url: '/team/158/minors', sel: '.thub-affiliate__level' },
  { name: 'prospect-top', url: '/team/158/minors', sel: '.prospecttable__top' },
]
// The display-face tags, for comparison (DISPLAY=1): the pill's own base type,
// which slice 1 signed off, on the hosts slice 2 moved.
const DISPLAY_TARGETS = [
  { name: 'mound-avail', url: '/player/trevor-megill-656730', sel: '.moundcard__avail' },
  { name: 'cbk-badge', url: '/team/109/numbers', sel: '.cbk__badge' },
  { name: 'scorebug', url: '/fouls', sel: '.scorebug__result' },
  { name: 'team-hub-level', url: '/team/556', sel: '.team-hub__level' },
  { name: 'flipback-scenario', url: '/09222026', seed: { 'bbsbh:spoiledDays': '["2026-09-22"]' }, sel: '.flipback__pill--scenario' },
]
if (process.env.DISPLAY) TARGETS.splice(0, TARGETS.length, ...DISPLAY_TARGETS)
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null

const browser = await chromium.launch()
const rows = []
for (const t of TARGETS.filter((x) => !ONLY || ONLY.includes(x.name))) {
  for (const dpr of [1, 2, 3]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr })
    const page = await ctx.newPage()
    if (t.seed) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, t.seed)
    await page.goto(`${base}${t.url}?nointro`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(800)
    if (process.env.CSS) await page.addStyleTag({ content: process.env.CSS })
    const all = page.locator(t.sel)
    const count = Math.min(await all.count(), +(process.env.N || 8))
    for (let i = 0; i < count; i++) {
    const el = all.nth(i)
    if (!(await el.isVisible())) continue
    await el.scrollIntoViewIfNeeded()
    await el.evaluate((n) => window.scrollBy(0, n.getBoundingClientRect().top - 300))
    await page.waitForTimeout(150)
    const m = await el.evaluate((n) => {
      const r = n.getBoundingClientRect()
      const cs = getComputedStyle(n)
      return {
        top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        bt: parseFloat(cs.borderTopWidth), bb: parseFloat(cs.borderBottomWidth),
        pt: cs.paddingTop, pb: cs.paddingBottom,
        fill: cs.backgroundColor, ink: cs.color, text: n.textContent.trim(),
      }
    })
    const clip = { x: Math.floor(m.left) - 3, y: Math.floor(m.top) - 3 }
    clip.width = Math.ceil(m.right) + 3 - clip.x
    clip.height = Math.ceil(m.bottom) + 3 - clip.y
    const file = `${t.name}@${dpr}x-${i}.png`
    await page.screenshot({ path: join(out, file), clip })
    rows.push({ name: t.name, dpr, i, file, clip, ...m })
    }
    console.log(t.name.padEnd(16), `${dpr}x`, count, 'sampled')
    await ctx.close()
  }
}
await browser.close()
writeFileSync(join(out, 'boxes.json'), JSON.stringify(rows, null, 2))
console.log('wrote', out)
