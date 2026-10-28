import { test, expect } from './fixtures.js'
import { installMockApi, ANCHOR_DATE, ANCHOR_GAME_PK } from './fixtures/mock-api.js'

// The motion study (issues #976-#983, src/styles/motion/). Verification pass
// for the parts the Animation Lab cannot show, which are all the JS gates: that
// a cascade fires once per mount and not on a poll.
//
// Offline against the captured anchor game (mock-api.js) — 2026-07-07 MIL@STL
// game 2, whose pinch runners and mid-inning substitutions are what put a
// struck-through name on the page in the first place (docs/test-games.md).

const MMDDYYYY = `${ANCHOR_DATE.slice(5, 7)}${ANCHOR_DATE.slice(8, 10)}${ANCHOR_DATE.slice(0, 4)}`
const BASE = `/${MMDDYYYY}/milstl-2`

const animName = (loc, pseudo) =>
  loc.evaluate((el, ps) => getComputedStyle(el, ps || null).animationName, pseudo)

test('#980 the batting order staggers in once, and the bench does not', async ({ page }) => {
  await installMockApi(page)
  await page.goto(`${BASE}/lineup1`)
  await expect(page.locator('.lord__item').first()).toBeVisible()

  const rows = page.locator('.lord__list .lord__item')
  await expect(rows).toHaveCount(9)

  // Each row carries its own place in the order, and the delay steps 30ms.
  for (let i = 0; i < 9; i += 1) {
    const d = await rows.nth(i).evaluate((el) => getComputedStyle(el).animationDelay)
    expect(d, `row ${i + 1} delay`).toBe(`${i * 0.03}s`)
  }
  expect(await animName(rows.first())).toBe('lineup-post')

  // It is an arrival, not a loop: the animation is over and gone a beat later,
  // and a poll cannot bring it back because the rows are keyed by player id.
  await page.waitForTimeout(900)
  const still = await rows.first().evaluate((el) => el.getAnimations().length)
  expect(still, 'the cascade must not loop').toBe(0)

  // The bench list under the order is deliberately left out of it. The anchor
  // game posts no bench, so this reads the sheet rather than a row: no rule that
  // names a bench row may set an animation.
  const benchAnims = await page.evaluate(() => {
    const walk = (rules) => [...rules].flatMap((r) => [r, ...(r.cssRules ? walk(r.cssRules) : [])])
    return [...document.styleSheets]
      .flatMap((s) => { try { return walk(s.cssRules) } catch { return [] } })
      .filter((r) => r.selectorText?.includes('lord__bench') && (r.style.animationName || r.style.animation))
      .map((r) => r.selectorText)
  })
  expect(benchAnims, 'no bench row animates').toEqual([])
})

// #982 (the half writing itself when laid out stacked), its read-back twin and
// #981 (a struck name on a play-by-play card, drawn on a cold load) went with
// the old innings page (#2566): Gameday has no "See the whole half" and draws
// no play-by-play card, so neither surface can be reached. The keyframes stay
// pinned below through the Animation Lab, which still draws both.

test('#983 only the innings frontier seal breathes, not every kraft button', async ({ page }) => {
  await installMockApi(page)
  await page.goto(`/${MMDDYYYY}`)
  await expect(page.locator('.gamecard').first()).toBeVisible()

  // A kraft `.btn--reveal` off the innings bar is not a frontier. The home
  // slate's "Reveal all results" chip was the case a bare `.btn--reveal` rule
  // breathed; the chip went in ADR-0116, so this now holds for any kraft
  // button the slate may draw.
  const kraft = page.locator('.screen--slate .btn--reveal')
  if (await kraft.count()) expect(await animName(kraft.first())).toBe('none')
})

test('#978 the live dot breathes and nothing animates box-shadow', async ({ page }) => {
  await installMockApi(page)
  await page.goto(`/${MMDDYYYY}`)
  await expect(page.locator('.gamecard').first()).toBeVisible()

  // The retired ring pulse must be gone from the whole sheet, not just unused.
  const pulse = await page.evaluate(() =>
    [...document.styleSheets].flatMap((s) => {
      try { return [...s.cssRules] } catch { return [] }
    }).filter((r) => r.type === CSSRule.KEYFRAMES_RULE && r.name === 'liveedge-pulse').length)
  expect(pulse, 'liveedge-pulse is deleted').toBe(0)

  const live = page.locator('.gamecard__live').first()
  if (await live.count()) {
    expect(await animName(live, '::before')).toBe('tally-breathe')
  }
})

test('the whole study is off under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await installMockApi(page)
  await page.goto(`${BASE}/lineup1`)
  await expect(page.locator('.lord__item').first()).toBeVisible()
  expect(await animName(page.locator('.lord__item').first())).toBe('none')

  await page.goto('/animation-lab')
  // The old innings bar's live-edge dot left the lab with that bar (#2566); the LIVE pill keeps the beat.
  await expect(page.locator('.animlab__live .gamecard__live').first()).toBeVisible()
  expect(await animName(page.locator('.animlab__live .gamecard__live').first(), '::before')).toBe('none')
  for (const sel of ['.btn--reveal', '.pbp__cell', '.pbp__leg', '.pbp__outcircle']) {
    expect(await animName(page.locator(`.animlab__live ${sel}`).first()), sel).toBe('none')
  }
  expect(
    await animName(page.locator('.animlab__live .pbp__replaced .struckline').first(), '::after'),
  ).toBe('none')
})
