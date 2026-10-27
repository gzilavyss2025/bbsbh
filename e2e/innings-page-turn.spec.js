import { test, expect } from './fixtures.js'
import { halfCell } from './lib/gameday.js'

// The forward-navigation page-turn transition (src/components/page-turn/).
// Covers: the preview/overlay mount-and-clear lifecycle, that a multi-half
// navigator jump plays exactly one transition (not one per intervening
// half), that backward navigation never animates, that
// prefers-reduced-motion skips the animation entirely, and — the spoiler
// invariant, re-asserted for this new preview layer specifically — that a
// still-sealed destination's preview never puts revealed content in the DOM.
// Anchor game per docs/test-games.md: 2026-07-07 MIL@STL g2 (gamePk 823035).
//
// Gameday mounts the half page hidden as its engine (src/screens/gameday/next/
// CLAUDE.md), so the turn's layers are in the DOM but not drawn. Its line
// score's run cells are the one way to move between halves by hand (ADR-0043):
// the old bar's Back / Next half-inning buttons and RollingLine left with the
// old screen. On a phone the line score folds into the Menu.
const GAME = '/07072026/milstl-2'

test('forward click plays exactly one transition, then the overlay/preview are gone', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  await (await halfCell(page, 'Bottom 1')).click()

  // Mid-turn: exactly one preview layer and one curl overlay, and the URL
  // hasn't advanced yet (it only updates on commit, once the animation
  // finishes).
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(1)
  await expect(page.locator('.pagecurl')).toHaveCount(1)
  expect(page.url()).toContain('/top1')

  // After the turn settles: committed to the new half, preview/overlay gone.
  await expect(page).toHaveURL(new RegExp(`${GAME}/bottom1$`))
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
  await expect(page.locator('.pagecurl')).toHaveCount(0)
})

test('a multi-half navigator jump plays exactly one transition, landing directly on the target', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  // Jump three halves ahead (top1 -> bottom2) in one tap — this must not
  // step through top2/bottom1 one at a time, each with its own turn.
  await (await halfCell(page, 'Bottom 2')).click()

  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(1)
  await expect(page.locator('.pagecurl')).toHaveCount(1)

  await expect(page).toHaveURL(new RegExp(`${GAME}/bottom2$`))
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
  await expect(page.locator('.pagecurl')).toHaveCount(0)
})

test('backward navigation never renders the overlay', async ({ page }) => {
  await page.goto(`${GAME}/bottom1`)

  await (await halfCell(page, 'Top 1')).click()

  await expect(page).toHaveURL(new RegExp(`${GAME}/top1$`))
  await expect(page.locator('.pagecurl')).toHaveCount(0)
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
})

test('keyboard-activating a backward navigator pick mid-turn lands there, not on the abandoned forward target', async ({
  page,
}) => {
  await page.goto(`${GAME}/bottom1`)

  // Start a forward turn (bottom1 -> top2), wait for it to actually be
  // mid-animation, then interrupt it via a keyboard-activated pick of the
  // half before. The cells carry aria-disabled mid-turn, never the real
  // `disabled` attribute (panels.css's `pointer-events: none` stops a tap),
  // and browsers don't treat aria-disabled as blocking keyboard activation;
  // the cell's onClick is deliberately unconditional. So this exercises the
  // InningPageTurn invariant (any external activeIdx change mid-turn cancels
  // rather than commits). It also covers the old bar's keyboard Back, which
  // was this same move through a button that is gone.
  await (await halfCell(page, 'Top 2')).click()
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(1)
  const topOfFirst = await halfCell(page, 'Top 1')
  await topOfFirst.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(new RegExp(`${GAME}/top1$`))
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
  await expect(page.locator('.pagecurl')).toHaveCount(0)
})

test('keyboard-activating a further-forward navigator pick mid-turn is dropped (first-request-wins)', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  // Start a forward turn (top1 -> bottom1), then keyboard-activate a pick
  // further ahead than the in-flight target — REQUEST_FORWARD is only
  // honored from idle (pageTurnState.js), so this must be a no-op: the
  // in-flight turn keeps heading to bottom1 rather than restarting or
  // stacking toward bottom2.
  await (await halfCell(page, 'Bottom 1')).click()
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(1)
  const bottomOfSecond = await halfCell(page, 'Bottom 2')
  await bottomOfSecond.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(new RegExp(`${GAME}/bottom1$`))
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
  await expect(page.locator('.pagecurl')).toHaveCount(0)
})

test('prefers-reduced-motion skips the animation but navigation still works', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${GAME}/top1`)

  await (await halfCell(page, 'Bottom 1')).click()

  // Commits immediately — no preview/overlay ever mounts.
  await expect(page).toHaveURL(new RegExp(`${GAME}/bottom1$`))
  await expect(page.locator('.pagecurl')).toHaveCount(0)
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
})

test('a still-sealed destination half never puts revealed content in the preview', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  await (await halfCell(page, 'Bottom 1')).click()

  // Mid-turn, with the destination (bottom of the 1st) still sealed: the
  // preview layer exists (for the curl visual) but must contain no revealed
  // stat grid, score, or play-by-play text — the spoiler invariant applies
  // to this preview exactly as it does to the real interactive instance.
  const preview = page.locator('.turnscene__layer--preview')
  await expect(preview).toHaveCount(1)
  await expect(preview.locator('.statgrid')).toHaveCount(0)
  await expect(preview.locator('.rhe')).toHaveCount(0)
  await expect(preview.locator('.pitchgrid')).toHaveCount(0)
})
