// Deliberately NOT importing test/expect from ./fixtures.js — that shared
// fixture appends `?nointro` to EVERY page.goto, which exists precisely to
// keep this modal out of every OTHER spec's way. This file's whole job is to
// exercise the modal itself, so it needs the raw, un-suppressed navigation;
// only the one test that pins `?nointro`'s effect asks for it explicitly, via
// the same `withNoIntro` helper fixtures.js itself uses.
import { test, expect } from '@playwright/test'
import { withNoIntro } from './fixtures.js'

// The first-visit welcome modal (components/account/FavoriteTeamModal.jsx,
// PRD §6.1) — a two-step dialog on a Clerk-configured deploy, one step on an
// unconfigured one.
//
// Everything asserted here is the CLERK-UNCONFIGURED face of the flow, which
// is the one a local dev/preview server can actually produce — same gap
// my-tally.spec.js records for the account section. On this deploy shape
// step 1's primary action is "Get started" and there is no step 2 at all
// (PRD §6.1: "there is no step 2, no indicator, and no dead '1 of 2'"), so
// these specs pin exactly that shape — including the ABSENCE of the step
// indicator, which is part of the rule and not a detail. See HANDOFF.md for what to watch on the
// first Clerk-configured run: step 1's primary action becomes
// "Continue with the {club}", a step 2 panel appears, and its own two
// actions ("Create my Tally" / "Use this device only") both close the modal.

test('a cleared visitor sees step 1, with the exact copy, and no step 2 chrome', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  const dialog = page.getByRole('dialog', { name: 'Make Tally yours.' })
  await expect(dialog).toBeVisible()
  // PRD §6.1 is explicit that an unconfigured deploy shows "no step 2, no
  // indicator, and no dead '1 of 2'". The first version of this spec quoted
  // that sentence in its own header and then asserted the indicator was
  // PRESENT — pinning the violation instead of the rule.
  await expect(dialog.locator('.introsheet__eyebrow')).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: 'Make Tally yours.' })).toBeVisible()
  await expect(dialog).toContainText(
    'Choose your club. We’ll pin its games—and its affiliates—to the top of every slate.',
  )

  // Unconfigured deploy: single step, so the primary action just finishes.
  await expect(dialog.getByRole('button', { name: 'Get started' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Continue with the/ })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Choose later' })).toHaveCount(0)
})

test('picking a club shows the inked-seal reaction and the exact benefit line', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  const dialog = page.getByRole('dialog', { name: 'Make Tally yours.' })
  await dialog.locator('.vsteam__team[aria-label="New York Yankees"]').click()

  await expect(dialog.locator('.introsheet__reaction .clubseal')).toBeVisible()
  await expect(dialog.locator('.introsheet__reactiontext')).toHaveText(
    'Pinned to the top of every Yankees slate — and every Yankees affiliate, from AAA to Single-A.',
  )
})

test('finishing the intro persists the club and never reopens the modal', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  const dialog = page.getByRole('dialog', { name: 'Make Tally yours.' })
  await dialog.locator('.vsteam__team[aria-label="Boston Red Sox"]').click()
  await dialog.getByRole('button', { name: 'Get started' }).click()
  await expect(dialog).toBeHidden()

  // The pick is committed — bbsbh:intro is set, so a reload does not reopen
  // the welcome modal, and the club stuck as the app's own preference.
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Make Tally yours.' })).toHaveCount(0)
  const prefs = await page.evaluate(() => window.localStorage.getItem('bbsbh:prefs'))
  expect(JSON.parse(prefs).club.value).toBe(111) // Boston Red Sox teamId
  const intro = await page.evaluate(() => window.localStorage.getItem('bbsbh:intro'))
  expect(JSON.parse(intro)).toMatchObject({ seen: true, step: 1 })
})

test('dismissing by the ✕ also commits the current pick — a dismissal is an answer', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  const dialog = page.getByRole('dialog', { name: 'Make Tally yours.' })
  await dialog.locator('.vsteam__team[aria-label="San Francisco Giants"]').click()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()

  const prefs = await page.evaluate(() => window.localStorage.getItem('bbsbh:prefs'))
  expect(JSON.parse(prefs).club.value).toBe(137) // San Francisco Giants teamId
})

test('an untouched dismissal still persists the pinned default', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  const dialog = page.getByRole('dialog', { name: 'Make Tally yours.' })
  await dialog.getByRole('button', { name: 'Get started' }).click()
  await expect(dialog).toBeHidden()

  // PINNED_TEAM_ID — the Brewers — even though nothing was tapped.
  const prefs = await page.evaluate(() => window.localStorage.getItem('bbsbh:prefs'))
  expect(JSON.parse(prefs).club.value).toBe(158)
})

test('?nointro suppresses the welcome modal entirely', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  // A fresh, cleared visitor would otherwise see the dialog (per the tests
  // above) — `?nointro` is what every other spec in this suite relies on to
  // keep it out of the way.
  await page.goto(withNoIntro('/'))
  await expect(page.getByRole('dialog', { name: 'Make Tally yours.' })).toHaveCount(0)
})

test('a visitor who already has a club opinion is seeded as already-onboarded', async ({ page }) => {
  // Simulates an existing user from before this flag existed: a preference
  // document with a club, but no bbsbh:intro key at all.
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.clear()
    window.localStorage.setItem(
      'bbsbh:prefs',
      JSON.stringify({ club: { value: 158, updatedAt: 1000 } }),
    )
  })
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Make Tally yours.' })).toHaveCount(0)
})
