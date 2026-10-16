import { test, expect } from './fixtures.js'

// The team page is ONE scroll of seven bands (ADR-0082, #1107). This walks its jump
// bar against the Brewers (id 158) — an MLB club with real data in every band, so
// nothing here is hidden by hiddenTeamSections (test/team-section-visibility covers the
// hidden case). Each step asserts a headline only that band renders, so a band that
// regressed to blank or to another band's content fails here rather than only in a unit
// test. A jump-bar click scrolls; it never changes the path.
//
// The old tab addresses (/team/{id}/roster …) must still work: each lands on its band,
// then the address becomes the bare page, keeping ?d= and ?s=.

const NAV = 'nav[aria-label="Team sections"]'

test('team page: the jump bar scrolls to each band without changing the path', async ({ page }) => {
  await page.goto('/team/158')
  await expect(page.locator('h1.tnext__name')).toHaveText('Milwaukee Brewers')
  const path = new URL(page.url()).pathname

  // Scoped to the jump bar: "Roster" and "Games" also appear as link text inside bands.
  const bar = page.locator(NAV)
  const jump = async (label, band, headline) => {
    await bar.getByRole('button', { name: new RegExp(`^${label}`) }).click()
    await expect(bar.getByRole('button', { name: new RegExp(`^${label}`) })).toHaveAttribute('aria-current', 'location')
    await expect(page.locator(`#${band}`)).toBeVisible()
    await expect(headline).toBeVisible()
    expect(new URL(page.url()).pathname).toBe(path)
  }

  await jump('Roster', 'roster', page.locator('#roster').getByRole('heading', { name: 'Roster', exact: true }))
  await jump('Games', 'games', page.locator('#games').getByText('Schedule'))
  await jump('Farm', 'farm', page.locator('#farm').getByText('Affiliates'))
  await jump('Money', 'money', page.locator('#money').getByRole('heading', { name: 'The commitment cliff' }))
  await jump('Standings', 'standings', page.locator('#standings .card').first())
})

// old address -> the band it lands on (TEAM_TAB_BAND, lib/route.js)
const OLD_ADDRESSES = [
  ['roster', 'roster'],
  ['games', 'games'],
  ['numbers', 'standings'],
  ['contracts', 'money'],
  ['minors', 'farm'],
]

for (const [tab, band] of OLD_ADDRESSES) {
  test(`team page: the old /${tab} address lands on #${band}, keeping ?d= and ?s=`, async ({ page }) => {
    await page.goto(`/team/158/${tab}?d=2026-04-10&s=1`)
    await expect(page.locator(`#${band}`)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/team/158\\?[^#]*d=2026-04-10[^#]*s=1[^#]*#${band}$`))
    const url = new URL(page.url())
    expect(url.pathname).toBe('/team/158')
    expect(url.searchParams.get('d')).toBe('2026-04-10')
    expect(url.searchParams.get('s')).toBe('1')
  })
}
