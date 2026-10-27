import { test, expect } from '../fixtures.js'
import { halfCell } from '../lib/gameday.js'

// A STAMPED GAME OPENS UNSEALED, AND STILL PERSISTS NOTHING (ADR-0048).
//
// Two halves, and the second is the one that can regress silently. The visible
// half is that a game carrying the reader's own stamp renders open — no seal to
// tap on the box score, no sealed halves in the innings viewer. The invisible
// half is ADR-0026's contract, inherited: the override is RENDER-ONLY, so
// merely revisiting a stamped game must not write `bbsbh:reveal:{gamePk}` and
// must not push a mark to any other device. A stamp is permanent where the day
// pass expires, so a leak here would be permanent too.
//
// gamePk 823035 = 2026-07-07 MIL @ STL game 2 (docs/test-games.md), a FINAL
// game — which is the only kind that can carry a stamp at all.
const GAME_PK = 823035
const GAME = '/07072026/milstl-2'

// The minimal record `parseStamps`/`normalizeStamp` accept: `stampedAt` is the
// one field with no default (a record without it is dropped), and `state: 'on'`
// is what separates a live stamp from a tombstone.
function seedStamp(page) {
  return page.addInitScript(
    ([pk]) => {
      localStorage.setItem(
        'bbsbh:stamps',
        JSON.stringify({
          [pk]: {
            state: 'on',
            mode: 'watched',
            stampedAt: 1752000000000,
            updatedAt: 1752000000000,
            note: '',
            date: '2026-07-07',
            placement: null,
          },
        }),
      )
    },
    [GAME_PK],
  )
}

test('a stamped game opens the box score with no seal, and writes no reveal mark', async ({
  page,
}) => {
  await seedStamp(page)
  await page.goto(`${GAME}/boxscore`)

  // The seal is simply not there — not hidden, not pre-torn: absent.
  await expect(page.getByRole('button', { name: 'Tap to reveal the box score' })).toHaveCount(0)
  // …and the body behind it rendered.
  await expect(page.locator('.boxscore').first()).toBeVisible()

  // The invariant. Opening a stamped game is a render decision and nothing
  // more: the ratchet's key stays untouched, so unstamping the game (or
  // signing out) drops straight back to a sealed one.
  const mark = await page.evaluate((pk) => localStorage.getItem(`bbsbh:reveal:${pk}`), GAME_PK)
  expect(mark).toBeNull()
})

test('a stamped game opens the innings viewer unsealed, and still writes no reveal mark', async ({
  page,
}) => {
  await seedStamp(page)
  await page.goto(`${GAME}/top1`)

  // No sealed half anywhere on the page — Gameday's line score names a sealed
  // half "{Half} {n}, sealed" (see reveal-persistence.spec.js). On a phone the
  // line score folds into the Menu, so it is opened first: without it this
  // count would pass on a page that drew no line score at all.
  await halfCell(page, 'Top 1')
  await expect(page.getByRole('button', { name: /, sealed$/ })).toHaveCount(0)

  // The surface gated by the reveal mark WITHOUT a SealBox of its own — the
  // line score's run cells. It is the check that the RENDER mark actually
  // moved, rather than that a few seals happened to be force-torn: it reads
  // no runs on a sealed page and every half's runs on a fully revealed one
  // (this game played all 18 halves), which is what a stamped page must match.
  await expect(page.getByRole('button', { name: /, \d+ runs?$/ })).toHaveCount(18)

  const mark = await page.evaluate((pk) => localStorage.getItem(`bbsbh:reveal:${pk}`), GAME_PK)
  expect(mark).toBeNull()
})

// The regression guard, and the more important of the two directions: the
// overwhelming majority of games are unstamped and must still seal exactly as
// they did before this override existed. Same game, same route, no stamp.
test('an unstamped game is untouched — still sealed', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)
  await expect(page.getByRole('button', { name: 'Tap to reveal the box score' })).toBeVisible()

  await page.goto(`${GAME}/top1`)
  await expect(await halfCell(page, 'Top 1')).toHaveAccessibleName('Top 1, sealed')
})

// A tombstoned stamp is NOT a stamp. `removeStamp` writes `state: 'off'` rather
// than deleting the key, so the sync can carry the removal to other devices —
// and an unstamped game must re-seal, on every device, the moment it does.
test('an unstamped-again (tombstoned) game re-seals', async ({ page }) => {
  await page.addInitScript(
    ([pk]) => {
      localStorage.setItem(
        'bbsbh:stamps',
        JSON.stringify({
          [pk]: {
            state: 'off',
            mode: 'watched',
            stampedAt: 1752000000000,
            updatedAt: 1752000100000,
            note: '',
            date: '2026-07-07',
            placement: null,
          },
        }),
      )
    },
    [GAME_PK],
  )
  await page.goto(`${GAME}/boxscore`)
  await expect(page.getByRole('button', { name: 'Tap to reveal the box score' })).toBeVisible()
})
