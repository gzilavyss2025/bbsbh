import { test, expect } from '../fixtures.js'

// The Logbook's half of the spoiler invariant (ADR-0035). A game stamp IS a
// final score, so the two things this file pins are:
//
//   1. It is absent from the DOM — not hidden — until the box score's seal is
//      tapped. That follows from the affordance living inside SealBox's render
//      function (ADR-0002), which is the CLIENT-side reveal gate; a refactor
//      that hoisted it out of that function would still LOOK right and would
//      silently put a final score on a sealed page.
//   2. It never reaches the slate, which lists games the user has not opened.
//
// The mint round trip (stamp -> it appears in /logbook -> un-stamp) rides along
// because the setup is shared, and because local-first is the posture that has
// to work with no backend configured at all: this whole spec runs signed out,
// against localStorage, exactly as a visitor with no Clerk key does.
//
// scripts/check-stamp-surfaces.mjs guards the same containment statically at
// lint time; this is the runtime half. Viewport-independent — mobile only.
const GAME = '/07072026/milstl-2'

test('a stamp is absent from the DOM until the box score seal is tapped', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)

  await expect(page.locator('.gamestamp')).toHaveCount(0)
  await expect(page.locator('.stampstrip')).toHaveCount(0)
  // Belt and braces: the affordance's own copy must not be in the markup
  // either, which catches a rendered-then-hidden regression that a class
  // rename would slip past.
  expect(await page.content()).not.toContain('Stamp this game')

  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()

  await expect(page.locator('.stampstrip')).toHaveCount(1)
  await expect(page.locator('.gamestamp')).toHaveCount(1)
})

test('the slate never carries a stamp', async ({ page }) => {
  await page.goto('/07072026')
  await expect(page.locator('.gamestamp')).toHaveCount(0)
})

test('minting files the game in the Game Log, and un-stamping takes it back', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)
  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()

  const mint = page.getByRole('button', { name: 'Stamp this game' })
  await expect(mint).toBeVisible()
  await mint.click()

  // Minted: the strip switches to its stamped face. The row itself only ever
  // offers the way into the book — everything a stamp you already HAVE can do
  // sits behind Details, which is what keeps the strip one row tall (see
  // StampGameButton.jsx), so un-stamping is reached through it below.
  await expect(page.getByRole('button', { name: 'Place it in your book' })).toBeVisible()

  // The collection page resolves this game's facts itself (api/logbook.js) —
  // signed out, there is no server to ask, which is the whole local-first
  // point. One stamp, and it links back to the game it came from.
  await page.goto('/logbook')
  await expect(page.locator('.logbook__cell')).toHaveCount(1)
  await expect(page.locator('.logbook__cell .gamestamp')).toHaveCount(1)

  // Un-stamp from the box score and the Logbook empties again — a stamp is a
  // keepsake, deliberately NOT ratcheted the way revealedThrough is.
  await page.goto(`${GAME}/boxscore`)
  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()
  await page.getByRole('button', { name: 'Details' }).click()
  await page.getByRole('button', { name: 'Remove stamp' }).click()
  await expect(page.getByRole('button', { name: 'Stamp this game' })).toBeVisible()

  await page.goto('/logbook')
  await expect(page.locator('.logbook__cell')).toHaveCount(0)
})

// The retrospective (/logbook/stats) renders final scores plainly, on the same
// argument as /logbook itself: every game it reads is one of this user's own
// stamps. Two things worth pinning at runtime — that the route resolves to the
// stats page at all (before the 'stats' branch was ordered ahead of the numeric
// season one, it silently fell through to the bare Logbook), and that its
// totals can only ever come from the collection.
test('the Game Log retrospective counts your stamps, and nothing else', async ({ page }) => {
  await page.goto('/logbook/stats')
  // Empty collection: the page exists and says so, rather than resolving to
  // the bare Logbook and leaving the wrong screen up.
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible()
  await expect(page.locator('.logbookstats__tally')).toHaveCount(0)

  await page.goto(`${GAME}/boxscore`)
  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()
  await page.getByRole('button', { name: 'Stamp this game' }).click()
  await expect(page.getByRole('button', { name: 'Place it in your book' })).toBeVisible()

  await page.goto('/logbook/stats')
  const games = page.locator('.logbookstats__tally').first().locator('strong').first()
  await expect(games).toHaveText('1')
  await expect(page.locator('.logbookstats__row').first()).toBeVisible()
  // And no stamp art here: this page is numbers, so GameStamp.jsx stays off
  // its import allowlist (scripts/check-stamp-surfaces.mjs).
  await expect(page.locator('.gamestamp')).toHaveCount(0)
})
