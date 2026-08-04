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
  await expect(page.locator('.stampcard')).toHaveCount(0)
  // Belt and braces: the affordance's own copy must not be in the markup
  // either, which catches a rendered-then-hidden regression that a class
  // rename would slip past.
  expect(await page.content()).not.toContain('Stamp this game')

  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()

  await expect(page.locator('.stampcard')).toHaveCount(1)
  await expect(page.locator('.gamestamp')).toHaveCount(1)
})

test('the slate never carries a stamp', async ({ page }) => {
  await page.goto('/07072026')
  await expect(page.locator('.gamestamp')).toHaveCount(0)
})

test('minting files the game in the Logbook, and un-stamping takes it back', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)
  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()

  const mint = page.getByRole('button', { name: 'Stamp this game' })
  await expect(mint).toBeVisible()
  await mint.click()

  // Minted: the card switches to its stamped face.
  await expect(page.getByRole('button', { name: 'Remove stamp' })).toBeVisible()

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
  await page.getByRole('button', { name: 'Remove stamp' }).click()
  await expect(page.getByRole('button', { name: 'Stamp this game' })).toBeVisible()

  await page.goto('/logbook')
  await expect(page.locator('.logbook__cell')).toHaveCount(0)
})
