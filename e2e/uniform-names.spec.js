import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from './fixtures.js'

// Coverage for the dev-only /uniform-names curation page (UniformNamesPage.jsx)
// and its save round trip through vite.config.js's dev-only middleware —
// nothing here is exercised by `npm test` since it's a stateful page backed by
// a real file write, not a pure function. `npm run e2e`'s webServer boots
// `npm run dev` (see playwright.config.js), so the DEV-gated route and the
// middleware are both live.
//
// The Save button writes straight to public/data/uniform-names.json, so every
// test that saves restores the file's original bytes afterward — this repo's
// committed curated names are real data, not fixtures.

const DATA_PATH = path.resolve(process.cwd(), 'public/data/uniform-names.json')
const TEAM_ANCHOR = '#uniformnames-team-158' // Brewers — this repo's pinned team (see teams.js PINNED_TEAM_ID)

test.describe('Uniform Names dev curation page', () => {
  let originalFile

  test.beforeEach(async () => {
    originalFile = await readFile(DATA_PATH, 'utf8')
  })

  test.afterEach(async () => {
    await writeFile(DATA_PATH, originalFile)
  })

  test('renders every jersey as a labeled, pre-filled row', async ({ page }) => {
    await page.goto('/uniform-names')
    await expect(page.locator(TEAM_ANCHOR)).toBeVisible()

    const inputs = page.locator(`${TEAM_ANCHOR} .uniformnames__input`)
    await expect(inputs.first()).toBeVisible()
    expect(await inputs.count()).toBeGreaterThan(0)
    // Every row is pre-filled — this is a curation tool, never a blank form.
    await expect(inputs.first()).not.toHaveValue('')
  })

  test('editing a name and saving persists it across a reload', async ({ page }) => {
    await page.goto('/uniform-names')
    const input = page.locator(`${TEAM_ANCHOR} .uniformnames__input`).first()
    await expect(input).toBeVisible()

    const uniqueName = `E2E Test Name ${Date.now()}`
    await input.fill(uniqueName)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved.')).toBeVisible()

    await page.reload()
    await expect(page.locator(`${TEAM_ANCHOR} .uniformnames__input`).first()).toHaveValue(
      uniqueName,
    )
  })

  test('rejects a malformed save payload without touching the file', async ({ request }) => {
    const before = await readFile(DATA_PATH, 'utf8')

    const arrayBody = await request.post('/__dev/uniform-names', { data: ['not', 'a', 'map'] })
    expect(arrayBody.status()).toBe(400)

    const nonStringValue = await request.post('/__dev/uniform-names', {
      data: { '158_jersey_1_2026': { nested: true } },
    })
    expect(nonStringValue.status()).toBe(400)

    expect(await readFile(DATA_PATH, 'utf8')).toBe(before)
  })

  test('rejects an oversized save payload', async ({ request }) => {
    const hugeValue = 'x'.repeat(300 * 1024)
    const res = await request.post('/__dev/uniform-names', {
      data: { '158_jersey_1_2026': hugeValue },
    })
    expect(res.status()).toBe(413)
  })
})
