// Contact sheet for the #1130 Button collapse.
//
//   node .scratch/design-system/button-collapse/capture.mjs before [baseURL]
//   node .scratch/design-system/button-collapse/capture.mjs after  [baseURL]
//
// For every in-scope control: a tight 2x crop of each state it has, named after
// its class, plus the computed box (height, padding, font, border, radius,
// shadow, fill, ink) in sheet.json and sheet.md. The "after" run uses the same
// target names so each pair can be compared file for file. A target lists more
// than one selector when the class is renamed: the first that resolves wins,
// and the table records which one it was.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const phase = process.argv[2] || 'before'
const base = process.argv[3] || 'http://localhost:5173'
const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, phase)
mkdirSync(out, { recursive: true })

const LIVE = process.env.LIVE_GAME || '/09222026/tbnyy'
const FINAL = process.env.FINAL_GAME || '/09202026/milbal'

// name → where it renders, how to find it, and which states it has.
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const TARGETS_ALL = [
  { name: 'sitesearch-btn', url: '/', sel: ['.sitebar__search', '.sitesearch-btn'] },
  { name: 'sitemenu-btn', url: '/', sel: ['.sitebar__menu', '.sitemenu-btn'] },
  { name: 'logbook-btn', url: '/', sel: ['.sitebar__logbook', '.logbook-btn'] },
  { name: 'sitefooter__action', url: '/', sel: ['.sitefooter__btn', '.sitefooter__action'] },
  { name: 'stepnav__btn', url: `${LIVE}/lineup1`, sel: ['.stepnav__btn:not([aria-pressed="true"]):not([aria-current="page"]):not(.is-active)'] },
  { name: 'stepnav__btn--selected', url: `${LIVE}/lineup1`, sel: ['.stepnav__btn[aria-pressed="true"]', '.stepnav__btn[aria-current="page"]', '.stepnav__btn.is-active'], states: ['rest'] },
  { name: 'notesbtn', url: `${LIVE}/lineup1`, sel: ['.innings__notes', '.notesbtn'] },
  { name: 'watchbtn', url: `${LIVE}/lineup1`, sel: ['.masthead__watch', '.watchbtn'] },
  { name: 'refreshbtn', url: `${LIVE}/lineup1`, sel: ['.innings__refresh', '.refreshbtn'] },
  { name: 'btn--reveal', url: `${FINAL}/top1`, sel: ['.pagenav .btn--reveal'], states: ['rest'] },
  { name: 'btn--next', url: `${FINAL}/lineup1`, sel: ['.pagenav .btn--next', '.pagenav .btn'], states: ['rest'] },
  { name: 'backbtn', url: '/umpires', go: 'td .plink, li .plink, .plink', sel: ['.player__back', '.backbtn'] },
  { name: 'umpage__filterbtn', url: '/umpires', go: 'td .plink, li .plink, .plink', sel: ['.umpage__filterbtn:not(.is-active):not([aria-pressed="true"])'] },
  { name: 'umpage__filterbtn--selected', url: '/umpires', go: 'td .plink, li .plink, .plink', sel: ['.umpage__filterbtn[aria-pressed="true"]', '.umpage__filterbtn.is-active'], states: ['rest'] },
  { name: 'mytally__rowbtn', url: '/profile', sel: ['.mytally__rowbtn:not(.mytally__rowbtn--danger)'] },
  { name: 'mytally__rowbtn--danger', url: '/profile', sel: ['.mytally__rowbtn--danger'] },
  { name: 'sc-zoom__btn', url: `${FINAL}/scorecard`, sel: ['.sc-zoom__btn'] },
  { name: 'posinn__scopebtn', url: '/player/christian-yelich-592885/history', sel: ['.posinn__scopebtn:not(.is-active):not([aria-pressed="true"])'] },
  { name: 'posinn__scopebtn--selected', url: '/player/christian-yelich-592885/history', sel: ['.posinn__scopebtn[aria-pressed="true"]', '.posinn__scopebtn.is-active'], states: ['rest'] },
  { name: 'btn--seal', url: `${FINAL}/boxscore`, reveal: true, sel: ['.stampstrip .btn--seal'] },
  { name: 'btn--chip', url: '/logbook', sel: ['.btn--chip', '.logbook .btn--control', '.btn--control'] },
  { name: 'allstarrosters__door', url: '/all-star-rosters', sel: ['.allstarrosters__door', '.door--block'] },
  { name: 'allstarlegacy__door', url: '/all-star-legacy', sel: ['.allstarlegacy__door'] },
  { name: 'teamtabs__btn', url: '/team/158', sel: ['.teamtabs__btn'], states: ['rest'] },
]
const TARGETS = ONLY ? TARGETS_ALL.filter((t) => ONLY.includes(t.name)) : TARGETS_ALL

const PROPS = [
  'height', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontFamily', 'fontSize', 'letterSpacing', 'textTransform', 'borderTopWidth',
  'borderTopStyle', 'borderTopColor', 'borderRadius', 'boxShadow',
  'backgroundColor', 'color', 'gap',
]

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
}

async function find(page, sels) {
  for (const s of sels) {
    const loc = page.locator(s)
    const n = await loc.count()
    for (let i = 0; i < n; i++) {
      const el = loc.nth(i)
      if (await el.isVisible()) return { el, sel: s }
    }
  }
  return null
}

async function crop(page, el, file) {
  const box = await el.boundingBox()
  if (!box) return false
  const pad = 10
  const vw = page.viewportSize()
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: Math.min(vw.width - Math.max(0, box.x - pad), box.width + pad * 2),
    height: box.height + pad * 2,
  }
  await page.screenshot({ path: join(out, file), clip })
  return true
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const rows = []
for (const t of TARGETS) {
  const page = await ctx.newPage()
  const sep = t.url.includes('?') ? '&' : '?'
  try {
    await page.goto(`${base}${t.url}${sep}nointro`, { waitUntil: 'domcontentloaded' })
    await settle(page)
    if (t.go) {
      await page.locator(t.go).first().click({ timeout: 10000 })
      await settle(page)
    }
    if (t.reveal) {
      const cover = page.locator('.cover, .sealbox button').first()
      if (await cover.count()) {
        await cover.click().catch(() => {})
        await settle(page)
      }
    }
    const hit = await find(page, t.sel)
    if (!hit) {
      rows.push({ name: t.name, url: t.url, missing: true })
      console.log('MISSING', t.name)
      await page.close()
      continue
    }
    const { el, sel } = hit
    await el.scrollIntoViewIfNeeded()
    // Keep the control clear of the fixed bar and the sticky head.
    await el.evaluate((n) => {
      const r = n.getBoundingClientRect()
      if (!n.closest('.pagenav, .sitebar, .topbar') && (r.top < 120 || r.bottom > 700)) {
        window.scrollBy(0, r.top - 300)
      }
    })
    await page.waitForTimeout(250)
    const m = await el.evaluate((n, props) => {
      const cs = getComputedStyle(n)
      const o = { tag: n.tagName.toLowerCase(), cls: n.className, text: n.textContent.trim().slice(0, 40) }
      for (const p of props) o[p] = cs[p]
      const r = n.getBoundingClientRect()
      o.rectH = Math.round(r.height * 10) / 10
      o.rectW = Math.round(r.width * 10) / 10
      o.disabled = n.disabled || n.getAttribute('aria-disabled') === 'true'
      o.pressed = n.getAttribute('aria-pressed')
      return o
    }, PROPS)
    const states = t.states || ['rest', 'hover', 'pressed', 'focus']
    const shots = []
    for (const s of states) {
      const file = `${t.name}--${s}.png`
      if (s === 'hover') await el.hover()
      if (s === 'pressed') {
        await el.hover()
        await page.mouse.down()
        await page.waitForTimeout(180)
      }
      if (s === 'focus') {
        await page.mouse.move(0, 0)
        await page.keyboard.press('Shift')
        await el.focus()
      }
      await page.waitForTimeout(160)
      if (await crop(page, el, file)) shots.push(file)
      if (s === 'pressed') {
        await page.mouse.move(0, 0) // leave before release, so no click fires
        await page.mouse.up()
      }
      if (s === 'hover') await page.mouse.move(0, 0)
      if (s === 'focus') await el.evaluate((n) => n.blur())
    }
    rows.push({ name: t.name, url: t.url, sel, ...m, shots })
    console.log('ok', t.name, m.rectH, m.fontSize, m.fontFamily.split(',')[0])
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
rows.length = 0
rows.push(...merged)
writeFileSync(sheetFile, JSON.stringify(rows, null, 2))
const px = (v) => (v || '').replace(/px/g, '')
const md = [
  `# Contact sheet — ${phase}`,
  '',
  `390px, ?nointro, captured from ${base}. Crops: \`<name>--<state>.png\` (2x).`,
  '',
  '| control | selector | h (rect) | padding T R B L | font | size | tracking | border | radius | shadow | fill | ink |',
  '| --- | --- | ---: | --- | --- | ---: | --- | --- | --- | --- | --- | --- |',
  ...rows.map((r) =>
    r.missing || r.error
      ? `| ${r.name} | — | ${r.missing ? 'not rendered at this route' : r.error} | | | | | | | | | |`
      : `| ${r.name} | \`${r.sel}\` | ${r.rectH} | ${[r.paddingTop, r.paddingRight, r.paddingBottom, r.paddingLeft].map(px).join(' ')} | ${r.fontFamily.split(',')[0].replace(/"/g, '')} | ${px(r.fontSize)} | ${r.letterSpacing} | ${px(r.borderTopWidth)} ${r.borderTopStyle} | ${px(r.borderRadius)} | ${r.boxShadow === 'none' ? 'none' : 'yes'} | ${r.backgroundColor} | ${r.color} |`,
  ),
]
writeFileSync(join(out, 'sheet.md'), md.join('\n') + '\n')
console.log('wrote', out)
