import { test, expect } from './fixtures.js'

const GROUP_LABELS = [
  'This season',
  'Prospects & injuries',
  'History',
  'Yours',
  'Guides',
  'The site',
]

test.describe('site directory wayfinding', () => {
  test('menu groups have glyphs and stay inside the viewport', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Site menu' }).click()

    const dialog = page.getByRole('dialog', { name: 'Site menu' })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.sitemenusheet__group')).toHaveCount(GROUP_LABELS.length)

    for (const label of GROUP_LABELS) {
      const heading = dialog.getByRole('heading', { name: label })
      await expect(heading).toBeVisible()
      await expect(heading.locator('.dirglyph svg')).toHaveCount(1)
    }

    const bounds = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })
    expect(bounds.top).toBeGreaterThanOrEqual(0)
    expect(bounds.left).toBeGreaterThanOrEqual(0)
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth)
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight)
  })

  test('footer carries the same six group glyphs', async ({ page }) => {
    await page.goto('/more')

    const footer = page.locator('.sitefooter')
    await expect(footer).toBeAttached()
    await expect(footer.locator('.dirglyph svg')).toHaveCount(GROUP_LABELS.length)

    for (const label of GROUP_LABELS) {
      await expect(footer.getByRole('heading', { name: label })).toHaveCount(1)
    }
  })
})
