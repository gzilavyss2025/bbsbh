import { test, expect } from './fixtures.js'

test('both league brackets connect the seeded rounds at every viewport', async ({ page }) => {
  await page.goto('/postseason-race')
  const brackets = page.locator('.psrace__miniboard')
  await expect(brackets).toHaveCount(2)
  for (const bracket of await brackets.all()) {
    const wc = bracket.locator('.psrace__round--wc .seedcard')
    const ds = bracket.locator('.psrace__round--ds .seedcard')
    const cs = bracket.locator('.psrace__round--cs .seedcard')
    await expect(wc).toHaveCount(2)
    await expect(ds).toHaveCount(2)
    await expect(cs).toHaveCount(1)
    await expect(wc.locator('.seedrow__seed')).toHaveText(['4', '5', '3', '6'])
    await expect(ds.locator('button .seedrow__seed')).toHaveText(['1', '2'])
    await expect(ds.locator('.psrace__bye')).toHaveCount(2)
    const upper = await ds.nth(0).boundingBox()
    const lower = await ds.nth(1).boundingBox()
    const final = await cs.boundingBox()
    const center = box => box.y + box.height / 2
    expect(Math.abs(center(final) - (center(upper) + center(lower)) / 2)).toBeLessThan(2)
    for (let i = 0; i < 2; i++) {
      const source = await wc.nth(i).boundingBox()
      const target = await ds.nth(i).boundingBox()
      expect(Math.abs(center(source) - center(target))).toBeLessThan(2)
      const lineWidth = await wc.nth(i).evaluate(el => parseFloat(getComputedStyle(el, '::after').width))
      expect(Math.abs(target.x - source.x - source.width - lineWidth)).toBeLessThan(2)
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const region = page.getByRole('region', { name: 'American League bracket' })
  await region.evaluate(el => { el.scrollLeft = el.scrollWidth })
  await expect(region.getByText('Upper DS winner')).toBeInViewport()
  const link = page.locator('.psrace__round--wc button').first()
  await link.click()
  await expect(page).toHaveURL(/\/team\/[^/]+\/numbers/)
})
