import { expect, test } from './fixtures.js'

// The poster's whole reason to exist is that it can leave the browser as a
// file. That depends on one thing the page cannot recover from: if any image
// drawn onto the canvas was fetched without CORS, the canvas is tainted and
// toBlob() throws SecurityError forever after — the Save button would sit
// there looking fine and doing nothing.
//
// So this spec exports for real. It is not a screenshot comparison; it asserts
// the bytes come out, that they are a PNG, and that the PNG is the size X is
// promised (1200 × 1600). Any new image source added to the poster from a host
// that doesn't send access-control-allow-origin will fail here.
const ROUTE = '/08122026/milsd/preview'

// Longer than the project default: a cold poster waits on the live feed, the
// umpire's nightly accuracy file, four webfonts and up to seven images before
// it paints — and it must paint completely before it can be exported, so there
// is no partial state to assert against earlier.
test.describe.configure({ timeout: 120_000 })

test('the poster exports as a real 1200x1600 PNG — the canvas is not tainted', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(ROUTE)
  await expect(page.locator('.posterstudio__canvas')).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.posterstudio__loading')).toHaveCount(0, { timeout: 45_000 })

  const result = await page.evaluate(async () => {
    const canvas = document.querySelector('.posterstudio__canvas')
    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/png')
      })
      const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
      return {
        ok: true,
        size: blob.size,
        type: blob.type,
        width: canvas.width,
        height: canvas.height,
        // The PNG magic number — proof these are image bytes, not an empty blob.
        magic: Array.from(head),
      }
    } catch (err) {
      return { ok: false, name: err.name, message: err.message }
    }
  })

  expect(result.ok, `toBlob failed: ${result.name} — ${result.message}`).toBe(true)
  expect(result.type).toBe('image/png')
  expect(result.width).toBe(1200)
  expect(result.height).toBe(1600)
  expect(result.magic).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  // A poster that painted nothing would still export, just tiny. The real
  // sheet with art on it runs to hundreds of kilobytes.
  expect(result.size).toBeGreaterThan(100_000)
  expect(errors).toEqual([])
})

test('turning a section off repaints the poster and it still exports', async ({ page }) => {
  await page.goto(ROUTE)
  await expect(page.locator('.posterstudio__canvas')).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.posterstudio__loading')).toHaveCount(0, { timeout: 45_000 })

  const before = await page.evaluate(() =>
    document.querySelector('.posterstudio__canvas').toDataURL().length,
  )
  await page.getByRole('checkbox', { name: 'Batting order' }).uncheck()
  await expect
    .poll(
      async () =>
        page.evaluate(() => document.querySelector('.posterstudio__canvas').toDataURL().length),
      { timeout: 15_000 },
    )
    .not.toBe(before)
})

test('the save button is offered once the poster has painted', async ({ page }) => {
  await page.goto(ROUTE)
  const save = page.getByRole('button', { name: /save this preview as an image/i })
  await expect(save).toBeEnabled({ timeout: 45_000 })
  await expect(save).toHaveText(/save image/i)
})
