import { test, expect } from './fixtures.js'

// One end-to-end walk across the team hub's five tabs (see
// .scratch/team-page-ia/issues/08-polish-and-tests.md), against the Brewers
// (id 158) — an MLB club with real data in every tab, so nothing here is
// hidden by hiddenTeamTabs (test/team-tab-visibility.test.js covers the
// hidden case directly). Each step asserts a headline element only that tab
// renders, so a tab that regressed to blank or to another tab's content fails
// here rather than only in a unit test.
//
// The walk starts at the BARE '/team/158' on purpose — the pre-slug address, the
// shape of every link shared before ADR-0057 — and each tab click lands on the
// slugged one, because the tab bar builds the address a club should have rather
// than reproducing the one the visitor happened to arrive on.

test('team hub: overview steps through all five tabs, each rendering its headline section', async ({
  page,
}) => {
  await page.goto('/team/158')
  await expect(page.locator('.team-hub__id h1')).toHaveText('Milwaukee Brewers')

  // Scoped to the tab bar itself (`.teamtabs`) — several tab labels ("Roster",
  // "Games") also appear as preview-door link text on the Overview, which a
  // bare getByRole('button', { name }) would ambiguously match too.
  const tabs = page.locator('.teamtabs')

  await tabs.getByRole('button', { name: 'Roster' }).click()
  await expect(page).toHaveURL(/\/team\/milwaukee-brewers-158\/roster$/)
  await expect(page.getByText('Current Roster')).toBeVisible()

  await tabs.getByRole('button', { name: 'Games' }).click()
  await expect(page).toHaveURL(/\/team\/milwaukee-brewers-158\/games$/)
  await expect(page.getByText('Schedule')).toBeVisible()

  await tabs.getByRole('button', { name: 'Numbers' }).click()
  await expect(page).toHaveURL(/\/team\/milwaukee-brewers-158\/numbers$/)
  await expect(page.locator('.thub-card__head').first()).toBeVisible()

  await tabs.getByRole('button', { name: 'Minors' }).click()
  await expect(page).toHaveURL(/\/team\/milwaukee-brewers-158\/minors$/)
  await expect(page.getByText('Affiliates')).toBeVisible()

  await tabs.getByRole('button', { name: 'Overview' }).click()
  await expect(page).toHaveURL(/\/team\/milwaukee-brewers-158$/)
  await expect(page.locator('.team-hub__id h1')).toHaveText('Milwaukee Brewers')
})
