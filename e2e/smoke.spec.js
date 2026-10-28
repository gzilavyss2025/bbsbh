import { test, expect } from './fixtures.js'
import { installMockApi } from './fixtures/mock-api.js'

// Long-lived example (see .claude/skills/run.md) — not a regression suite,
// just a template + a basic "did the app load and stay sealed" sanity check
// against a pinned real game. Write throwaway specs alongside this one for
// one-off verification and delete them when done.

test('slate loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Scorebook').first()).toBeVisible()
})

// Both pinned-game specs below go through the mock API. The anchor fixtures
// ARE this game and this date (mock-api.js's ANCHOR_GAME_PK/ANCHOR_DATE), and
// a July game's feed is frozen, so a captured response is the same data —
// only deterministic. Without it these two are unrunnable in any sandbox whose
// Chromium cannot reach statsapi.mlb.com: every request hangs, the page never
// leaves its loader, and the seal assertions fail on an element that was never
// rendered rather than on anything about the seal. Uncaptured endpoints still
// relay to the live network, so this narrows what is stubbed, not what is
// checked.
test('pinned game (2026-07-07 MIL@STL g2, gamePk 823035) box score stays sealed until tapped', async ({
  page,
}) => {
  await installMockApi(page)
  await page.goto('/07072026/milstl-2/boxscore')

  const cover = page.getByRole('button', { name: 'Tap to reveal the box score' })
  await expect(cover).toBeVisible()

  // Spoiler rule: nothing score-revealing exists in the DOM pre-reveal.
  await expect(page.getByText(/\b10\b/).first()).not.toBeVisible()

  await cover.click()
  await expect(cover).not.toBeVisible()
})

// The heading is "Defense" (Gary, 2026-10-28; it read "Defensive alignment" from #694). It is display
// copy, so if the wording moves again it has to move here too. Playwright matches an accessible name in
// FULL, so a stale name fails here rather than passing on a substring.
test('pinned game lineup1 renders the defensive alignment', async ({ page }) => {
  await installMockApi(page)
  await page.goto('/07072026/milstl-2/lineup1')
  await expect(page.getByRole('heading', { name: 'Defense' }).first()).toBeVisible()
  // The field: the park drawing with each fielder's name, or the plain diamond for a venue with no layout.
  await expect(page.locator('.lfld').first()).toBeVisible()
})
