import { test, expect } from './fixtures.js'

// My Tally (/profile) — the private profile & settings destination.
//
// Everything asserted here is the SIGNED-OUT / Clerk-unconfigured face of the
// page, which is the one a local dev server can actually produce: signing in
// needs a Clerk-configured deploy, the same gap ADR-0026 records for
// SpoiledDaysCloudSync. That is not a thin slice, though — it is the state the
// whole design is built on ("This device." is the exact phrase, PRD §1.1), and
// it is the one where a regression would be silent.

test('My Tally opens on this device, with every setting usable and no account gate', async ({
  page,
}) => {
  await page.goto('/profile')

  await expect(page.getByRole('heading', { level: 1, name: 'My Tally' })).toBeVisible()
  await expect(page.locator('.mytally__subtitle')).toHaveText('Profile & settings.')

  // The sentence the whole signed-out experience rests on. Not "local", not
  // "offline", not "not synced".
  await expect(page.locator('.mytally__scopelabel')).toHaveText('This device.')

  // Not gated: settings are settings, so every section renders with no account.
  await expect(page.getByRole('heading', { name: 'Baseball' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Scorebook experience' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your ledger' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sync & data' })).toBeVisible()

  // Three counts, and every one of them is a count of the reader's own things.
  await expect(page.locator('.mytally__ledgerrow')).toHaveCount(3)

  // One row per CHANNEL, not one per claim. `reveal` backs two claims —
  // "Reveal progress" and "Pick up your pencil" — and rendering the ledger
  // directly produced two rows showing byte-identical state under two labels.
  // Signed out, every row says where the thing is.
  //
  // FIVE rows, not the four PRD §5.2 tabulated: the multi-book shelf
  // (ADR-0041) added a `books` channel, and this assertion was never updated
  // with it. Add the row here when a channel is added to SYNC_CHANNELS —
  // that list and this list are the same list.
  await expect(page.locator('.syncreceipt__row')).toHaveCount(5)
  await expect(page.locator('.syncreceipt__label')).toHaveText([
    'Reveal progress',
    'Days you unsealed',
    'Game Log',
    'Book covers',
    'Club and settings',
  ])
  await expect(page.locator('.syncreceipt__row').first().locator('.syncreceipt__state')).toHaveText(
    'On this device.',
  )
})

test('the club is picked on the page and survives a reload', async ({ page }) => {
  await page.goto('/profile')

  const yankees = page.locator('.vsteam__team[aria-label="New York Yankees"]')
  await expect(yankees).toBeVisible()
  await yankees.click()
  await expect(page.locator('.mytally__club')).toHaveText('New York Yankees')

  // The preference document is the store now, not `bbsbh:favoriteTeam` — so
  // what this really pins is that a tap writes through usePreferences and
  // survives the round trip.
  await page.reload()
  await expect(page.locator('.mytally__club')).toHaveText('New York Yankees')
  // The strip is a radiogroup, not a tablist — it is single-select preference
  // input and controls no panel. So the state attribute is aria-checked.
  await expect(page.locator('.vsteam__team[aria-label="New York Yankees"]')).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('the level the slate opens on is set here and persists', async ({ page }) => {
  await page.goto('/profile')

  const aa = page.getByRole('group', { name: 'Level the slate opens on' }).getByRole('button', {
    name: 'AA',
    exact: true,
  })
  await aa.click()
  await expect(aa).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await expect(
    page.getByRole('group', { name: 'Level the slate opens on' }).getByRole('button', {
      name: 'AA',
      exact: true,
    }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('Keep Awake is a real switch and remembers its position', async ({ page }) => {
  await page.goto('/profile')

  const keepAwake = page.getByRole('switch', { name: /Keep the screen awake/ })
  await expect(keepAwake).toHaveAttribute('aria-checked', 'false')
  await keepAwake.click()
  await expect(keepAwake).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  await expect(page.getByRole('switch', { name: /Keep the screen awake/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

// Scores Unlocked is REPORTED here and never set here. There is deliberately no
// "always show scores" control anywhere on this page — invariant P3, forbidden
// by name — so this asserts the absence as much as the presence.
test('Scores Unlocked shows its status without offering a standing opt-out', async ({ page }) => {
  await page.goto('/profile')

  const section = page.locator('.mytally__section', { hasText: 'Scores Unlocked' })
  await expect(section.getByText('Scores Unlocked')).toBeVisible()
  await expect(page.getByRole('button', { name: /always show scores/i })).toHaveCount(0)
  await expect(page.getByRole('switch', { name: /scores/i })).toHaveCount(0)
})

// The one action on this page that cannot be undone, so it is the one worth
// driving end to end: the confirm sheet must actually clear the namespace and
// start the app over, not merely close.
test('erasing this device clears every bbsbh: key and starts over', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('switch', { name: /Keep the screen awake/ }).click()
  expect(
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.startsWith('bbsbh:')).length,
    ),
  ).toBeGreaterThan(0)

  await page.getByRole('button', { name: /Erase this device/ }).click()
  const sheet = page.locator('.erasesheet')
  await expect(sheet).toBeVisible()

  // Safety-by-default: the keep-my-data button is first and holds focus, so an
  // inattentive Enter never erases anything.
  await expect(sheet.getByRole('button').first()).toHaveText('Keep my data')
  await expect(sheet.getByRole('button', { name: 'Keep my data' })).toBeFocused()

  await sheet.getByRole('button', { name: 'Erase this device' }).click()
  await page.waitForURL('**/')

  // Everything is swept EXCEPT `bbsbh:intro`, which is deliberately re-seeded
  // on the way out. Without it the reload looks like a brand-new visitor and
  // reopens the welcome modal — and since every exit route from that modal
  // commits a club pick (defaulting to the pinned club) while `bbsbh:prefsOwner`
  // has just been swept too, a still-signed-in user's real club was published
  // over with the default on every device. Asserting the exact remaining key,
  // rather than a count, is what keeps that from silently growing.
  expect(
    await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.startsWith('bbsbh:')).sort(),
    ),
  ).toEqual(['bbsbh:intro'])

  // And the point of keeping it: no welcome modal on the way back in.
  await expect(page.getByRole('dialog', { name: 'Make Tally yours.' })).toHaveCount(0)
})

test('the slate footer’s Settings button is the way in', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { level: 1, name: 'My Tally' })).toBeVisible()
})
