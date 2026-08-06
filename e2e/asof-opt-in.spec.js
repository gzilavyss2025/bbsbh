import { test, expect } from './fixtures.js'

// The as-of cutoff is opt-in (ADR-0034, "The cutoff is opt-in now"). Two halves,
// and the value is in asserting both — "stats pages open live" is only safe to
// ship alongside "a dated URL still works", because the second is what an
// already-shared link depends on.
//
//   1. A link out of a STARTED game must not stamp `?d=` on its target. This is
//      the behaviour that changed; it used to freeze every stats page reached
//      from a game to "entering today".
//   2. A URL that carries `?d=` still applies it, still propagates it across a
//      tab switch, and still offers the way back to current.
//
// `/07072026/milstl-2` is the same finished fixture game the spoiler-DOM
// invariants use — a real, completed game, so `started` is true and the old
// code would definitely have injected a cutoff here.
//
// `PlayerLink` and `TeamLink` both render as `.plink`, so the two cases are
// separated by WHERE they sit rather than by class: `.lineup__name` is only ever
// a batting-order player, and the club link is the first `.plink` on the page.
// Both read the same `useLinkScope()` → `linkQuery` path, so this is belt and
// braces rather than two mechanisms — but a selector that quietly matched the
// wrong one is exactly how this spec would pass while testing nothing.
const GAME = '/07072026/milstl-2'

test('a player link out of a started game carries no as-of cutoff', async ({ page }) => {
  await page.goto(`${GAME}/lineup1`)

  const name = page.locator('.lineup__name').first()
  await expect(name).toBeVisible()
  await name.click()

  await expect(page).toHaveURL(/\/player\/\d+/)
  // The assertion that IS the change: no `d=` on the way out.
  expect(new URL(page.url()).searchParams.get('d')).toBeNull()
  // And so the page must not be claiming to be a historical view.
  await expect(page.locator('.asof-banner')).toHaveCount(0)
})

test('a club link out of a started game carries no as-of cutoff either', async ({ page }) => {
  await page.goto(`${GAME}/lineup1`)

  const club = page.locator('.plink').first()
  await expect(club).toBeVisible()
  await club.click()

  await expect(page).toHaveURL(/\/team\/\d+/)
  expect(new URL(page.url()).searchParams.get('d')).toBeNull()
  await expect(page.locator('.asof-banner')).toHaveCount(0)
})

test('a hand-dated team URL still freezes, survives a tab switch, and offers the way back', async ({
  page,
}) => {
  // Nothing in the UI produces this address any more — it is what an
  // already-shared link looks like, and what a future date control would build.
  await page.goto('/team/158?d=2026-04-10')

  const banner = page.locator('.asof-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText(/Stats entering/i)

  // The propagation rule ADR-0034 states, and the one part of the old design
  // that is unchanged: a tab switch must not silently drop the cutoff, or one
  // visit would answer two different ways.
  await page.locator('.teamtabs').getByRole('button', { name: 'Roster' }).click()
  await expect(page).toHaveURL(/\/team\/158\/roster\?d=2026-04-10/)
  await expect(page.locator('.asof-banner')).toBeVisible()

  // And back to current, without hand-editing the URL.
  await page.getByRole('button', { name: 'Show current' }).click()
  await expect(page).toHaveURL(/\/team\/158\/roster$/)
  await expect(page.locator('.asof-banner')).toHaveCount(0)
})
