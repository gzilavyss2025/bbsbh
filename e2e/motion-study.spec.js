import { test, expect } from './fixtures.js'
import { installMockApi, ANCHOR_DATE, ANCHOR_GAME_PK } from './fixtures/mock-api.js'

// The motion study (issues #976-#983, src/styles/motion/). Verification pass
// for the parts the Animation Lab cannot show, which are all the JS gates: that
// a cascade fires once per mount and not on a poll, that a strike renders
// already drawn on a cold load, that a half writes itself only when the reader
// unseals it, and that the write is capped.
//
// Offline against the captured anchor game (mock-api.js) — 2026-07-07 MIL@STL
// game 2, whose pinch runners and mid-inning substitutions are what put a
// struck-through name on the page in the first place (docs/test-games.md).

const MMDDYYYY = `${ANCHOR_DATE.slice(5, 7)}${ANCHOR_DATE.slice(8, 10)}${ANCHOR_DATE.slice(0, 4)}`
const BASE = `/${MMDDYYYY}/milstl-2`

const animName = (loc, pseudo) =>
  loc.evaluate((el, ps) => getComputedStyle(el, ps || null).animationName, pseudo)

test('#980 the batting order staggers in once, and the roster does not', async ({ page }) => {
  await installMockApi(page)
  await page.goto(`${BASE}/lineup1`)
  await expect(page.locator('.lineup__row').first()).toBeVisible()

  const rows = page.locator('.lineup__list .lineup__row')
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

  // The 40-man roster is deliberately left out of it.
  const roster = page.locator('.roster__row').first()
  if (await roster.count()) expect(await animName(roster)).toBe('none')
})

test('#982 the half writes itself when it is laid out to be read back, capped at six', async ({ page }) => {
  await installMockApi(page)
  await page.goto(`${BASE}/top7`)

  // Nothing sealed is in the DOM before the tap (ADR-0002), so there is nothing
  // to animate either — and the frontier seal breathes while it waits (#983).
  await expect(page.locator('.btn--reveal').first()).toBeVisible()
  await expect(page.locator('.pbp__atbat')).toHaveCount(0)
  expect(await animName(page.locator('.btn--reveal').first())).toBe('sc-seal-breathe')

  await page.locator('.revealsplit__btn--quiet').click()
  await expect(page.locator('.pbp__atbat').first()).toBeVisible()

  // The seal has nothing left to say once the tape is torn.
  await expect(page.locator('.btn--reveal')).toHaveCount(0)

  // Revealing holds the WINDOWED at-bat, which owns ADR-0046's ink-set — the
  // write-on stays out of its way. See HalfInning's comment.
  await expect(page.locator('.pbp__atbat--writing')).toHaveCount(0)

  // "See the whole half" lays the half out stacked. THAT is the write.
  await page.locator('.trailstrip__summarybtn').click()
  const total = await page.locator('.pbp__atbat').count()
  expect(total, 'the half is laid out').toBeGreaterThan(6)
  await expect(page.locator('.pbp__atbat--writing')).toHaveCount(6)

  // Beat 2 is the only new technique: one fixed dasharray for every leg.
  const leg = page.locator('.pbp__atbat--writing .pbp__leg').first()
  if (await leg.count()) {
    expect(await animName(leg)).toBe('leg-trace')
    expect(await leg.evaluate((el) => getComputedStyle(el).strokeDasharray)).toBe('43px')
  }
})

test('#982 a half read back a second time renders settled ink, never a replay', async ({ page }) => {
  await installMockApi(page)
  await page.goto(`${BASE}/top7`)
  await page.locator('.revealsplit__btn--quiet').click()
  await page.locator('.trailstrip__summarybtn').click()
  await expect(page.locator('.pbp__atbat--writing').first()).toBeVisible()

  // Same half, loaded fresh: the reveal mark persisted, so the cards come back
  // already written. This is the cold-load case useBecameTrue exists for.
  await page.reload()
  await expect(page.locator('.pbp__atbat').first()).toBeVisible()
  await expect(page.locator('.pbp__atbat--writing')).toHaveCount(0)
})

test('#981 a struck name renders already drawn on a cold load', async ({ page }) => {
  await installMockApi(page)
  await page.goto(`${BASE}/lineup1`)
  await expect(page.locator('.lineup__row').first()).toBeVisible()

  // The defense diamond carries this game's substitutions. Whatever is struck
  // on arrival must show a full bar and no animation — the reader was not here
  // when it happened.
  const out = page.locator('.defdiamond__name--out')
  const n = await out.count()
  for (let i = 0; i < n; i += 1) {
    await expect(out.nth(i)).not.toHaveClass(/is-drawing/)
    expect(await animName(out.nth(i), '::after'), 'settled, not drawing').toBe('none')
    const bar = await out.nth(i).evaluate((el) => getComputedStyle(el, '::after').transform)
    expect(bar, 'the bar is fully drawn').toBe('matrix(1, 0, 0, 1, 0, 0)')
  }
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
  await expect(page.locator('.lineup__row').first()).toBeVisible()
  expect(await animName(page.locator('.lineup__row').first())).toBe('none')

  await page.goto('/animation-lab')
  await expect(page.locator('.animlab__live .liveedge__dot').first()).toBeVisible()
  for (const sel of ['.liveedge__dot', '.btn--reveal', '.pbp__cell', '.pbp__leg', '.pbp__outcircle']) {
    expect(await animName(page.locator(`.animlab__live ${sel}`).first()), sel).toBe('none')
  }
  expect(await animName(page.locator('.animlab__live .pbp__replaced').first(), '::after')).toBe('none')
})
