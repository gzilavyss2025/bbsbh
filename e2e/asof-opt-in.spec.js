import { test, expect } from './fixtures.js'

// The as-of cutoff is opt-in (ADR-0034, "The cutoff is opt-in now" /
// "The cutoff gets a way in"). Three halves, and the value is in asserting all
// three — "stats pages open live" is only safe to ship alongside "a dated URL
// still works" and "there's a real way to reach one", because a reader with
// no `?d=` habits of their own would otherwise have no way to ask for a
// historical view at all.
//
//   1. A link out of a STARTED game must not stamp `?d=` on its target. This is
//      the behaviour PR #573 changed; it used to freeze every stats page reached
//      from a game to "entering today".
//   2. A URL that carries `?d=` still applies it, still propagates it across a
//      tab switch, still offers the way back to current, and now also a way to
//      change the date without hand-editing the URL.
//   3. A LIVE page (no `?d=`) offers its own way IN — the date control this PR
//      adds — rather than requiring a hand-typed `?d=` to ever see a historical
//      view.
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

// `AsOfBanner` now renders unconditionally — a live page gets the entry
// control (`.asof-banner--live`), a dated one gets the "Stats entering" strip.
// So "this page isn't claiming to be a historical view" is asserted by the
// absence of the DATED variant specifically, not by the absence of the whole
// component.
async function expectLiveBanner(page) {
  await expect(page.locator('.asof-banner--live')).toBeVisible()
  await expect(page.locator('.asof-banner')).not.toContainText(/Stats entering/i)
}

test('a player link out of a started game carries no as-of cutoff', async ({ page }) => {
  await page.goto(`${GAME}/lineup1`)

  const name = page.locator('.lineup__name').first()
  await expect(name).toBeVisible()
  await name.click()

  await expect(page).toHaveURL(/\/player\/\d+/)
  // The assertion that IS the change: no `d=` on the way out.
  expect(new URL(page.url()).searchParams.get('d')).toBeNull()
  // And so the page must not be claiming to be a historical view.
  await expectLiveBanner(page)
})

test('a club link out of a started game carries no as-of cutoff either', async ({ page }) => {
  await page.goto(`${GAME}/lineup1`)

  const club = page.locator('.plink').first()
  await expect(club).toBeVisible()
  await club.click()

  await expect(page).toHaveURL(/\/team\/\d+/)
  expect(new URL(page.url()).searchParams.get('d')).toBeNull()
  await expectLiveBanner(page)
})

test('a hand-dated team URL still freezes, survives a tab switch, offers the way back, and the way to change', async ({
  page,
}) => {
  // A hand-dated address still works exactly as it did before this PR — the
  // one thing that's new is that the control below is now also how a reader
  // would have arrived here in the first place.
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

  // "Change date" reopens the same picker, pre-filled with the date already
  // in the URL, and re-applies it to the SAME tab (roster).
  await page.getByRole('button', { name: 'Change date' }).click()
  await expect(page.locator('.asof-banner__input')).toHaveValue('2026-04-10')
  await page.locator('.asof-banner__input').fill('2026-05-01')
  await page.getByRole('button', { name: 'Go' }).click()
  await expect(page).toHaveURL(/\/team\/158\/roster\?d=2026-05-01/)
  await expect(page.locator('.asof-banner')).toContainText(/Stats entering/i)

  // And back to current, without hand-editing the URL.
  await page.getByRole('button', { name: 'Show current' }).click()
  await expect(page).toHaveURL(/\/team\/158\/roster$/)
  await expectLiveBanner(page)
})

test('the live-page date control is the way IN to a historical view', async ({ page }) => {
  // Nothing navigated here from a game or hand-typed a `?d=` — this is a cold,
  // live visit, and the control this PR adds is the only way from here to a
  // dated view.
  await page.goto('/team/158')
  await expectLiveBanner(page)

  await page.getByRole('button', { name: 'View as of a date' }).click()
  const input = page.locator('.asof-banner__input')
  await expect(input).toBeVisible()
  // Nothing pre-fills it — the control never defaults to a date on its own.
  await expect(input).toHaveValue('')

  await input.fill('2026-04-01')
  await page.getByRole('button', { name: 'Go' }).click()

  await expect(page).toHaveURL(/\/team\/158\?d=2026-04-01/)
  await expect(page.locator('.asof-banner')).toContainText('Stats entering')
})

test('cancelling the date picker leaves a live page live', async ({ page }) => {
  await page.goto('/team/158')
  await page.getByRole('button', { name: 'View as of a date' }).click()
  await page.locator('.asof-banner__input').fill('2026-04-01')

  await page.getByRole('button', { name: 'Cancel' }).click()

  // No navigation happened — still the bare, live address (query is just the
  // fixture's own `?nointro`, never a `?d=`).
  const url = new URL(page.url())
  expect(url.pathname).toBe('/team/158')
  expect(url.searchParams.get('d')).toBeNull()
  await expectLiveBanner(page)
})
