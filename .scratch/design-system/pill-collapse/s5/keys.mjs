// Slice 5 keyboard check (#1131). Tab only, no clicks:
//   1. /situational-records: Tab to a rail link on the navy band. The ring
//      must draw (2px solid, 2px off) and be paper, not green. Enter must jump
//      to its #record-group-N section, with no page reload.
//   2. /team/158 (navy club) and /team/110 (light club): Tab to Postseason
//      Odds; Enter opens the odds sheet.
//   3. /team/406/games (plain hub): Tab to Stamp In; Enter goes to
//      /team/406/stamp-in on the client (a marker on window survives).
//   node .scratch/design-system/pill-collapse/s5/keys.mjs http://localhost:5171
import { chromium } from '@playwright/test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.argv[2] || 'http://localhost:5171'
const here = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const out = []
const log = (s) => { out.push(s); console.log(s) }

async function open(path) {
  const page = await ctx.newPage()
  await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}nointro`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(800)
  await page.evaluate(() => { window.__noReload = 1 })
  return page
}

// Tab from the top of the page until `sel` has focus (at most 400 stops).
async function tabTo(page, sel, nth = 0) {
  await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => {})
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  const target = page.locator(sel).nth(nth)
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((n) => document.activeElement === n).catch(() => false)) return { stops: i + 1, el: target }
  }
  return { stops: null, el: target }
}

const ring = (el) => el.evaluate((n) => {
  const cs = getComputedStyle(n)
  return { focusVisible: n.matches(':focus-visible'), outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`, offset: cs.outlineOffset }
})

// 1. the rail
{
  const page = await open('/situational-records')
  const { stops, el } = await tabTo(page, '.trrank__jump a', 1)
  log(`rail: Tab reached link 2 after ${stops} stops`)
  const r = await ring(el)
  log(`rail: focus-visible ${r.focusVisible}, outline ${r.outline}, offset ${r.offset}`)
  const b = await el.boundingBox()
  await page.screenshot({ path: join(here, 'keys-rail-focus.png'), clip: { x: 0, y: Math.max(0, b.y - 16), width: 390, height: b.height + 32 } })
  const href = await el.getAttribute('href')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  const after = await page.evaluate((h) => {
    const t = document.querySelector(h)
    return { hash: location.hash, reload: window.__noReload !== 1, top: t ? Math.round(t.getBoundingClientRect().top) : null }
  }, href)
  log(`rail: Enter on ${href} -> hash ${after.hash}, section top ${after.top}px, reloaded ${after.reload}`)
  await page.close()
}

// 2. Postseason Odds on a navy and a light club
for (const id of ['158', '110']) {
  const page = await open(`/team/${id}`)
  const { stops, el } = await tabTo(page, '.psodds-pill')
  const r = await ring(el)
  log(`team ${id}: Tab reached Postseason Odds after ${stops} stops; focus-visible ${r.focusVisible}, outline ${r.outline}, offset ${r.offset}`)
  const b = await el.boundingBox()
  await page.screenshot({ path: join(here, `keys-psodds-${id}-focus.png`), clip: { x: 0, y: Math.max(0, b.y - 16), width: 390, height: b.height + 32 } })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
  const sheet = await page.locator('.psoddsmodal').isVisible().catch(() => false)
  log(`team ${id}: Enter -> odds sheet visible ${sheet}`)
  await page.close()
}

// 3. Stamp In on the plain hub
{
  const page = await open('/team/406/games')
  const { stops, el } = await tabTo(page, '.psodds-pill')
  const r = await ring(el)
  log(`team 406 games: Tab reached Stamp In after ${stops} stops; focus-visible ${r.focusVisible}, outline ${r.outline}`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  const after = await page.evaluate(() => ({ path: location.pathname, reload: window.__noReload !== 1 }))
  log(`team 406 games: Enter -> ${after.path}, reloaded ${after.reload}`)
  await page.close()
}

await browser.close()
const { writeFileSync } = await import('node:fs')
writeFileSync(join(here, 'keys.txt'), out.join('\n') + '\n')
