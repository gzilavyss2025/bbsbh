// Contact sheet for the #1131 Pill collapse, one slice at a time.
//
//   node .scratch/design-system/pill-collapse/capture.mjs before http://localhost:5170
//   node .scratch/design-system/pill-collapse/capture.mjs after  http://localhost:5171
//   SLICE=2 node .scratch/design-system/pill-collapse/capture.mjs before http://localhost:5172
//
// Slice 1 writes before/ and after/; slice N writes sN/before/ and sN/after/,
// so a later slice never overwrites an earlier slice's evidence. OUT=<folder>
// overrides the output folder (a smoke test, or a scratch run). A slice 2
// target can also take: `w` (its own viewport width), `seed` (localStorage
// entries set before the load, for a tag that renders only after a reveal),
// `click` (a tab to open first), `focus` (a PlayerLink to focus, for the hover
// card) and `scroll` (wheel down first, for a card that mounts on sight).
//
// Adapted from ../button-collapse/capture.mjs. A tag has no states, so each
// target is one 2x crop at rest (two, when a page shows a second variant worth
// seeing) plus its computed box, in sheet.json and sheet.md. Each target lists
// its old selector first and its new one second: the first that resolves wins,
// and the table records which. The "after" run uses the same target names, so
// each pair compares file for file.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const phase = process.argv[2] || 'before'
const base = process.argv[3] || 'http://localhost:5170'
const here = dirname(fileURLToPath(import.meta.url))
const SLICE = process.env.SLICE || '1'
const out = process.env.OUT || (SLICE === '1' ? join(here, phase) : join(here, `s${SLICE}`, phase))
mkdirSync(out, { recursive: true })

const W = process.env.W ? +process.env.W : 390
const TARGETS_1 = [
  { name: 'milestone', url: '/09222026/tbnyy/lineup1', sel: ['.milestonepill', 'span.pill[style*="accent-primary"]'] },
  { name: 'rookie', url: '/team/121/roster', sel: ['.rookiepill', '.pill:has(.rookie__full)'] },
  { name: 'prospect-trade', url: '/trade-deadline/2026', sel: ['.prospectpill', '.prospect__tag'] },
  { name: 'prospect-movedup', url: '/higha/10122026', sel: ['.movedup .prospectpill', '.movedup .prospect__tag'] },
  { name: 'tier', url: '/umpires', sel: ['.tierpill', '.tier__tag'] },
  { name: 'tier-2', url: '/umpires', nth: 3, sel: ['.tierpill', '.tier__tag'] },
  { name: 'rank-roster', url: '/team/158/roster', sel: ['.rankchip', '.rank__tag'] },
  { name: 'rank-good', url: '/standings', sel: ['.rankchip--good', '.rank__tag--good'] },
  { name: 'rank-bad', url: '/standings', sel: ['.rankchip--bad', '.rank__tag--bad'] },
  { name: 'rank-plain', url: '/standings', sel: ['.rankchip:not(.rankchip--good):not(.rankchip--bad)', '.rank__tag:not(.rank__tag--good):not(.rank__tag--bad)'] },
  { name: 'leaguerank', url: '/player/jacob-misiorowski-694819', sel: ['.leaguerank__chip', '.leaguerank .pill'] },
  { name: 'awards', url: '/player/christian-yelich-592885', sel: ['.awards__chip', '.awards .pill'] },
  { name: 'simlike', url: '/player/christian-yelich-592885/analytics', sel: ['.simlike__term'] },
  { name: 'simlike-muted', url: '/player/christian-yelich-592885/analytics', sel: ['.simlike__term--muted'] },
  { name: 'cthist-fuzzy', url: '/player/christian-yelich-592885/history', sel: ['.cthist__fuzzy'] },
  { name: 'dlab-verdict', url: '/design-lab', sel: ['.dlab__verdict--merge'] },
  { name: 'dlab-verdict-hold', url: '/design-lab', sel: ['.dlab__verdict--bespoke', '.dlab__verdict--hold'] },
]
const REVEAL = { 'bbsbh:reveal:777747': '19' }
const TARGETS_2 = [
  { name: 'wiredock-count', url: '/09222026', sel: ['.wiredock__count'] },
  { name: 'wcall-wrong', url: '/05272025/bosmil/bottom10', w: 1280, seed: REVEAL, click: 'role=tab[name=/arms/i]', sel: ['.wcall__pill--wrong'] },
  { name: 'wcall-right', url: '/05272025/bosmil/bottom10', w: 1280, seed: REVEAL, click: 'role=tab[name=/arms/i]', sel: ['.wcall__pill--right'] },
  { name: 'favormeter', url: '/05272025/bosmil/bottom10', w: 1280, seed: REVEAL, click: 'role=tab[name=/arms/i]', sel: ['.favormeter__tierpill'] },
  { name: 'winprob-chip', url: '/05272025/bosmil/boxscore', seed: { 'bbsbh:boxreveal:777747': '1' }, sel: ['.winprob__ledger-chip'] },
  { name: 'flipback-crown', url: '/09202026', seed: { 'bbsbh:spoiledDays': '["2026-09-20"]' }, sel: ['.flipback__pill--crown'] },
  { name: 'flipback-scenario', url: '/09222026', seed: { 'bbsbh:spoiledDays': '["2026-09-22"]' }, sel: ['.flipback__pill--scenario'] },
  { name: 'flipback-tag', url: '/07072026', seed: { 'bbsbh:spoiledDays': '["2026-07-07"]' }, sel: ['.flipback__pill--tag'] },
  { name: 'tlead-level', url: '/leaders/org/158', sel: ['.tlead__level'] },
  { name: 'tlead-level-row', url: '/leaders/org/158', sel: ['.tlead__row .tlead__level'] },
  { name: 'mound-avail', url: '/player/trevor-megill-656730', sel: ['.moundcard__avail'] },
  { name: 'team-hub-level', url: '/team/556', sel: ['.team-hub__level'] },
  { name: 'cbk-badge', url: '/team/109/numbers', scroll: true, sel: ['.cbk__badge'] },
  { name: 'affiliate-level', url: '/team/158/minors', sel: ['.thub-affiliate__level'] },
  { name: 'prospect-top', url: '/team/158/minors', sel: ['.prospecttable__top'] },
  { name: 'scorebug-pos', url: '/fouls', sel: ['.scorebug__result.is-positive'] },
  { name: 'scorebug-neg', url: '/fouls', sel: ['.scorebug__result.is-negative'] },
  { name: 'phcard-level', url: '/prospects', w: 1280, focus: 'button.plink', sel: ['.phcard__tag--level'] },
  { name: 'phcard-rehab', url: '/rehab', w: 1280, focus: 'button.plink', sel: ['.phcard__tag--rehab'] },
  { name: 'cwb-chip', url: '/.scratch/design-system/pill-collapse/cwb-mount.html', sel: ['.cwb__chip:not(.cwb__chip--none):not(.cwb__chip--share)'] },
  { name: 'cwb-chip-share', url: '/.scratch/design-system/pill-collapse/cwb-mount.html', sel: ['.cwb__chip--share'] },
  { name: 'cwb-chip-none', url: '/.scratch/design-system/pill-collapse/cwb-mount.html', sel: ['.cwb__chip--none'] },
]
// One slot per slice, each on its own line, so parallel slices never edit the
// same line. A slice fills only its own slot.
// ---- slice 3 ----
const TARGETS_3 = []
// ---- slice 4 ----
const TARGETS_4 = []
// ---- slice 5 ----
const TARGETS_5 = []
// ---- slice 6 ----
const TARGETS_6 = [
  { name: 'poster-save', url: '/09222026/tbnyy/preview', w: 1280, sel: ['.posterstudio__save'] },
]
// ---- end of slots ----
const TARGETS_BY_SLICE = { 1: TARGETS_1, 2: TARGETS_2, 3: TARGETS_3, 4: TARGETS_4, 5: TARGETS_5, 6: TARGETS_6 }
const TARGETS_ALL = TARGETS_BY_SLICE[SLICE]
if (!TARGETS_ALL) throw new Error(`capture.mjs: no target slot for SLICE=${SLICE}`)
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const TARGETS = ONLY ? TARGETS_ALL.filter((t) => ONLY.includes(t.name)) : TARGETS_ALL

const PROPS = [
  'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontFamily', 'fontSize',
  'letterSpacing', 'lineHeight', 'textTransform', 'borderTopWidth', 'borderTopStyle', 'borderTopColor',
  'borderRadius', 'backgroundColor', 'color', 'display', 'alignSelf', 'marginTop', 'gap',
]

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(700)
}

async function find(page, sels, nth = 0) {
  for (const s of sels) {
    const loc = page.locator(s)
    const n = await loc.count()
    let seen = 0
    for (let i = 0; i < n; i++) {
      const el = loc.nth(i)
      if (await el.isVisible()) {
        if (seen === nth) return { el, sel: s }
        seen += 1
      }
    }
  }
  return null
}

const browser = await chromium.launch()
const contexts = new Map()
const ctxFor = async (w) => {
  if (!contexts.has(w)) contexts.set(w, await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2 }))
  return contexts.get(w)
}
const rows = []
for (const t of TARGETS) {
  const page = await (await ctxFor(t.w || W)).newPage()
  if (t.seed) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v) }, t.seed)
  const sep = t.url.includes('?') ? '&' : '?'
  try {
    await page.goto(`${base}${t.url}${sep}nointro`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    if (t.click) { await page.locator(t.click).first().click(); await settle(page) }
    if (t.scroll) { for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(200) } await settle(page) }
    if (t.focus) {
      const links = page.locator(t.focus)
      const n = Math.min(await links.count(), 6)
      for (let i = 0; i < n; i++) {
        await links.nth(i).focus()
        await page.waitForTimeout(2500)
        if (await page.locator(t.sel[0]).count()) break
      }
    }
    const hit = await find(page, t.sel, t.nth || 0)
    if (!hit) {
      rows.push({ name: t.name, url: t.url, missing: true })
      console.log('MISSING', t.name)
      await page.close()
      continue
    }
    const { el, sel } = hit
    if (!t.focus) await el.scrollIntoViewIfNeeded()
    if (!t.focus) await el.evaluate((n) => {
      const r = n.getBoundingClientRect()
      if (r.top < 140 || r.bottom > 700) window.scrollBy(0, r.top - 300)
    })
    await page.waitForTimeout(250)
    const m = await el.evaluate((n, props) => {
      const cs = getComputedStyle(n)
      const o = { tag: n.tagName.toLowerCase(), cls: String(n.className), text: n.textContent.trim().slice(0, 40) }
      for (const p of props) o[p] = cs[p]
      const r = n.getBoundingClientRect()
      o.rectH = Math.round(r.height * 10) / 10
      o.rectW = Math.round(r.width * 10) / 10
      // The row it sits in: a tag's job is to sit in a line of text, so the
      // host's height is part of what the pair must not change unplanned.
      const host = n.parentElement.getBoundingClientRect()
      o.hostH = Math.round(host.height * 10) / 10
      return o
    }, PROPS)
    // Crop the tag with its parent row, so a baseline shift shows.
    const box = await el.evaluate((n) => {
      const a = n.getBoundingClientRect()
      const p = n.parentElement.getBoundingClientRect()
      const x = Math.max(0, Math.min(a.left, p.left) - 6)
      const y = Math.max(0, Math.min(a.top, p.top) - 6)
      const w = Math.min(window.innerWidth - x, Math.max(a.right, Math.min(p.right, a.right + 200)) - x + 6)
      const h = Math.min(160, Math.max(a.bottom, p.bottom) - y + 6)
      return { x, y, width: w, height: h }
    })
    const file = `${t.name}.png`
    await page.screenshot({ path: join(out, file), clip: box })
    const tight = `${t.name}--tag.png`
    const b = await el.boundingBox()
    await page.screenshot({ path: join(out, tight), clip: { x: Math.max(0, b.x - 4), y: Math.max(0, b.y - 4), width: b.width + 8, height: b.height + 8 } })
    rows.push({ name: t.name, url: t.url, vw: t.w || W, sel, ...m, shots: [file, tight] })
    console.log('ok', t.name.padEnd(18), m.rectH, m.fontSize, m.fontFamily.split(',')[0], m.color, m.borderTopColor)
  } catch (e) {
    rows.push({ name: t.name, url: t.url, error: String(e).slice(0, 200) })
    console.log('ERR', t.name, String(e).slice(0, 120))
  }
  await page.close()
}
await browser.close()

const sheetFile = join(out, 'sheet.json')
let prior = []
try { prior = JSON.parse((await import('node:fs')).readFileSync(sheetFile, 'utf8')) } catch {}
const merged = TARGETS_ALL.map((t) => rows.find((r) => r.name === t.name) || prior.find((r) => r.name === t.name)).filter(Boolean)
writeFileSync(sheetFile, JSON.stringify(merged, null, 2))
const px = (v) => (v || '').replace(/px/g, '')
const md = [
  `# Contact sheet — ${phase}`,
  '',
  `${W}px unless a target sets its own width (1280px for the reveal, hover-card and tab targets), ?nointro, captured from ${base}. Crops: \`<name>.png\` (tag in its row) and \`<name>--tag.png\` (2x).`,
  '',
  '| tag | selector | h | w | host h | padding T R B L | font | size | tracking | line-h | border | fill | ink | edge |',
  '| --- | --- | ---: | ---: | ---: | --- | --- | ---: | --- | --- | --- | --- | --- | --- |',
  ...merged.map((r) =>
    r.missing || r.error
      ? `| ${r.name} | — | ${r.missing ? 'not rendered at this route' : r.error} | | | | | | | | | | |`
      : `| ${r.name} | \`${r.sel}\` | ${r.rectH} | ${r.rectW} | ${r.hostH} | ${[r.paddingTop, r.paddingRight, r.paddingBottom, r.paddingLeft].map(px).join(' ')} | ${r.fontFamily.split(',')[0].replace(/"/g, '')} | ${px(r.fontSize)} | ${r.letterSpacing} | ${r.lineHeight} | ${px(r.borderTopWidth)} ${r.borderTopStyle} | ${r.backgroundColor} | ${r.color} | ${r.borderTopColor} |`,
  ),
]
writeFileSync(join(out, 'sheet.md'), md.join('\n') + '\n')
console.log('wrote', out)
