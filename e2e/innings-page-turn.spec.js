import { test, expect } from './fixtures.js'

// The forward-navigation page-turn transition (src/components/page-turn/).
// Covers: the preview/overlay mount-and-clear lifecycle, that a multi-half
// RollingLine jump plays exactly one transition (not one per intervening
// half), that backward navigation never animates, that
// prefers-reduced-motion skips the animation entirely, and — the spoiler
// invariant, re-asserted for this new preview layer specifically — that a
// still-sealed destination's preview never puts revealed content in the DOM.
// Anchor game per docs/test-games.md: 2026-07-07 MIL@STL g2 (gamePk 823035).
const GAME = '/07072026/milstl-2'

test('forward click plays exactly one transition, then the overlay/preview are gone', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  await page.getByRole('button', { name: 'Next half-inning' }).click()

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

test('a multi-half RollingLine jump plays exactly one transition, landing directly on the target', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  // Jump three halves ahead (top1 -> bottom2) in one tap — this must not
  // step through top2/bottom1 one at a time, each with its own turn.
  await page.getByRole('button', { name: /Bottom of the 2nd/ }).click()

  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(1)
  await expect(page.locator('.pagecurl')).toHaveCount(1)

  await expect(page).toHaveURL(new RegExp(`${GAME}/bottom2$`))
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
  await expect(page.locator('.pagecurl')).toHaveCount(0)
})

test('backward navigation never renders the overlay', async ({ page }) => {
  await page.goto(`${GAME}/bottom1`)

  await page.getByRole('button', { name: 'Back one half-inning' }).click()

  await expect(page).toHaveURL(new RegExp(`${GAME}/top1$`))
  await expect(page.locator('.pagecurl')).toHaveCount(0)
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
})

test('keyboard-activating Back mid-turn lands backward, not on the abandoned forward target', async ({
  page,
}) => {
  await page.goto(`${GAME}/bottom1`)

  // Start a forward turn (bottom1 -> top2), wait for it to actually be
  // mid-animation, then interrupt it via Back. index.css's
  // `[aria-disabled='true'] { pointer-events: none }` rule already blocks a
  // literal mouse/touch tap here, but that CSS can't stop a keyboard user
  // (Tab to the button, press Enter) — the button never gets the real
  // `disabled` attribute, only `aria-disabled`, which browsers don't treat as
  // blocking keyboard activation. So this should still land on top1, not on
  // the top2 the abandoned turn was headed to.
  await page.getByRole('button', { name: 'Next half-inning' }).click()
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(1)
  const backButton = page.getByRole('button', { name: 'Back one half-inning' })
  await backButton.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(new RegExp(`${GAME}/top1$`))
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
  await expect(page.locator('.pagecurl')).toHaveCount(0)
})

test('keyboard-activating a backward RollingLine pick mid-turn lands there, not on the abandoned forward target', async ({
  page,
}) => {
  await page.goto(`${GAME}/bottom1`)

  // Start a forward turn (bottom1 -> top2), then interrupt it via a
  // keyboard-activated RollingLine pick rather than the Back button — the
  // same aria-disabled-doesn't-block-keyboard gap as the Back button test
  // above (RollingLine.jsx's onClick is deliberately unconditional; see its
  // header comment), so this exercises the same InningPageTurn invariant
  // (any external activeIdx change mid-turn cancels rather than commits)
  // through a different call site.
  await page.getByRole('button', { name: 'Next half-inning' }).click()
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(1)
  const topOfFirst = page.getByRole('button', { name: /Top of the 1st/ })
  await topOfFirst.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(new RegExp(`${GAME}/top1$`))
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
  await expect(page.locator('.pagecurl')).toHaveCount(0)
})

test('keyboard-activating a further-forward RollingLine pick mid-turn is dropped (first-request-wins)', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  // Start a forward turn (top1 -> bottom1), then keyboard-activate a pick
  // further ahead than the in-flight target — REQUEST_FORWARD is only
  // honored from idle (pageTurnState.js), so this must be a no-op: the
  // in-flight turn keeps heading to bottom1 rather than restarting or
  // stacking toward bottom2.
  await page.getByRole('button', { name: 'Next half-inning' }).click()
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(1)
  const bottomOfSecond = page.getByRole('button', { name: /Bottom of the 2nd/ })
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

  await page.getByRole('button', { name: 'Next half-inning' }).click()

  // Commits immediately — no preview/overlay ever mounts.
  await expect(page).toHaveURL(new RegExp(`${GAME}/bottom1$`))
  await expect(page.locator('.pagecurl')).toHaveCount(0)
  await expect(page.locator('.turnscene__layer--preview')).toHaveCount(0)
})

test('a still-sealed destination half never puts revealed content in the preview', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  await page.getByRole('button', { name: 'Next half-inning' }).click()

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
