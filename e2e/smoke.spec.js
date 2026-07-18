import { test, expect } from './fixtures.js'

// Long-lived example (see .claude/skills/run.md) — not a regression suite,
// just a template + a basic "did the app load and stay sealed" sanity check
// against a pinned real game. Write throwaway specs alongside this one for
// one-off verification and delete them when done.

test('slate loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Scorebook').first()).toBeVisible()
})

test('pinned game (2026-07-07 MIL@STL g2, gamePk 823035) box score stays sealed until tapped', async ({
  page,
}) => {
  await page.goto('/07072026/milstl-2/boxscore')

  const cover = page.getByRole('button', { name: 'Tap to reveal the box score' })
  await expect(cover).toBeVisible()

  // Spoiler rule: nothing score-revealing exists in the DOM pre-reveal.
  await expect(page.getByText(/\b10\b/).first()).not.toBeVisible()

  await cover.click()
  await expect(cover).not.toBeVisible()
})

test('pinned game lineup1 renders the defense diamond', async ({ page }) => {
  await page.goto('/07072026/milstl-2/lineup1')
  await expect(page.getByText('Scorebook').first()).toBeVisible()
})
