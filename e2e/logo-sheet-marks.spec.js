import { test, expect } from './fixtures.js'

// The sketch modal's marks, on the two surfaces that open it — the Logo Sheet
// and the game flow's masthead tile. Both are the same LogoModal, which is why
// the wordmark overflowed in both places: TeamLogo sizes a wordmark to a wide
// box with an INLINE width (size x 3.5), and at the modal's 240px stage that
// asked for 840px inside a 340px card. The containment assertions below fail
// without `.logomodal__art { max-width: 100% }` — on the `ipad` and `desktop`
// projects. On `mobile` the old `max-width: 66vw` happened to be narrower than
// the card, which is exactly why the bug read as a wide-screen one: that cap
// tracked the viewport, not the dialog it was supposed to fit inside.

const marks = (page) => page.locator('.logomodal__variant')

// The art must not reach past either edge of the card it sits in. A pixel of
// slack absorbs sub-pixel rounding, nothing more.
async function expectArtInsideCard(page) {
  const card = await page.locator('.logomodal').boundingBox()
  const art = await page.locator('.logomodal__art').boundingBox()
  expect(art.x).toBeGreaterThanOrEqual(card.x - 1)
  expect(art.x + art.width).toBeLessThanOrEqual(card.x + card.width + 1)
}

test('every mark a club offers stays inside the sketch card', async ({ page }) => {
  await page.goto('/logos')
  // The Brewers are pinned to the top of the sheet, and they have City Connect
  // art on file — so this club exercises the four-up list.
  await page.locator('.logotile__btn').first().click()
  await expect(page.locator('.logomodal')).toBeVisible()
  await expect(marks(page)).toHaveText(['Cap', 'Base', 'City Connect', 'Wordmark'])

  for (const label of ['Cap', 'Base', 'City Connect', 'Wordmark']) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expectArtInsideCard(page)
  }
})

test('a club with no City Connect art is not offered the tab', async ({ page }) => {
  await page.goto('/logos')
  // The Yankees opted out of the program entirely, so there is no CC art to show.
  await page.getByRole('button', { name: /Enlarge New York Yankees/ }).click()
  await expect(marks(page)).toHaveText(['Cap', 'Base', 'Wordmark'])
})

test('the game-flow masthead opens the same contained modal', async ({ page }) => {
  await page.goto('/')
  await page.locator('.gamecard').first().click()
  const tile = page.locator('[aria-label*="Enlarge"]').first()
  await expect(tile).toBeVisible()
  await tile.click()
  await expect(page.locator('.logomodal')).toBeVisible()
  await page.getByRole('button', { name: 'Wordmark', exact: true }).click()
  await expectArtInsideCard(page)
})
