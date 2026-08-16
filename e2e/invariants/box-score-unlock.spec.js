import { test, expect } from '../fixtures.js'

// THE BOX SCORE YOU OPENED STAYS OPEN (ADR-0049).
//
// The reader lifts the box score's seal by hand. That is a fact about them, not
// about the game, and it is the one thing on this page worth remembering: they
// have seen how it ended. So it is written — `bbsbh:boxreveal:{gamePk}`, one bit
// — and the page opens on the next visit and on their other devices.
//
// Three things are asserted here, and the second and third are the ones that can
// regress quietly:
//
//   1. A tap opens the page and keeps it open across a reload.
//   2. The bit is written ONLY on a real tap. A box score force-revealed by the
//      Scores Unlocked pass (ADR-0026) or by the reader's own stamp (ADR-0048)
//      must write nothing, because `SealBox` fires `onReveal` on any transition
//      to shown — flag included. Either would turn an ephemeral, reversible
//      override into a permanent record of a seal nobody touched.
//   3. It stays out of `bbsbh:reveal:{gamePk}`. That mark is the BY-HAND scoring
//      frontier the innings viewer, the scorecard's ink and the slate's "pick up
//      your pencil" strip all read. Opening a box score is not scoring a half.
//
// gamePk 823035 = 2026-07-07 MIL @ STL game 2 (docs/test-games.md), Final.
const GAME_PK = 823035
const GAME = '/07072026/milstl-2'
const SEAL = 'Tap to reveal the box score'

const boxMark = (page) =>
  page.evaluate((pk) => localStorage.getItem(`bbsbh:boxreveal:${pk}`), GAME_PK)
const revealMark = (page) =>
  page.evaluate((pk) => localStorage.getItem(`bbsbh:reveal:${pk}`), GAME_PK)

test('a tapped box score is still open on the next visit', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)

  // First visit: an ordinary seal, and nothing recorded yet.
  const seal = page.getByRole('button', { name: SEAL })
  await expect(seal).toBeVisible()
  expect(await boxMark(page)).toBeNull()

  await seal.click()
  await expect(page.locator('.bs__team').first()).toBeVisible()
  expect(await boxMark(page)).toBe('1')
  // The by-hand frontier is untouched: this was a box score, not a half.
  expect(await revealMark(page)).toBeNull()

  // The visit that is the whole point. No seal, and the sheet is simply there.
  await page.reload()
  await expect(page.getByRole('button', { name: SEAL })).toHaveCount(0)
  await expect(page.locator('.bs__team').first()).toBeVisible()
  expect(await revealMark(page)).toBeNull()
})

test('a box score opened under the Scores Unlocked pass records nothing', async ({ page }) => {
  // The pass is a consent to spoil a DAY, and it expires. Were the page to
  // record its own opening under it, the 8am reset would drop every OTHER seal
  // back into place and leave this one permanently lifted — a mark the reader
  // never made, outliving the consent it came from.
  // The consented DAY is what `spoilersOffFor` reads for a game on that date —
  // the same record the pass writes on confirm and the one that outlives 8am
  // (see scores-unlocked.spec.js).
  await page.addInitScript(() => {
    localStorage.setItem('bbsbh:spoiledDays', JSON.stringify(['2026-07-07']))
  })
  await page.goto(`${GAME}/boxscore`)

  await expect(page.getByRole('button', { name: SEAL })).toHaveCount(0)
  await expect(page.locator('.bs__team').first()).toBeVisible()
  expect(await boxMark(page)).toBeNull()
  expect(await revealMark(page)).toBeNull()
})

test('a stamped game opens without recording a box-score mark either', async ({ page }) => {
  // ADR-0048's override is exactly as reversible as the stamp behind it: unstamp
  // the game and the seal returns. A bit written on the stamp's account would
  // survive the un-stamping and quietly break that promise.
  await page.addInitScript(
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
  await page.goto(`${GAME}/boxscore`)

  await expect(page.getByRole('button', { name: SEAL })).toHaveCount(0)
  expect(await boxMark(page)).toBeNull()
})

test('an opened box score opens the box score ONLY — the innings viewer still seals', async ({
  page,
}) => {
  // The scope, and the reason this is a bit of its own rather than a shove of
  // `revealedThrough` to the final half. One seal on one page was lifted; the
  // reader's by-hand scoring of the game is untouched, and the innings viewer
  // must not know a thing about it.
  await page.addInitScript(
    ([pk]) => {
      localStorage.setItem(`bbsbh:boxreveal:${pk}`, '1')
    },
    [GAME_PK],
  )

  await page.goto(`${GAME}/boxscore`)
  await expect(page.getByRole('button', { name: SEAL })).toHaveCount(0)

  await page.goto(`${GAME}/top1`)
  await expect(page.getByRole('button', { name: /, sealed$/ }).first()).toBeVisible()
})

test('a mangled box-score mark leaves the seal exactly where it was', async ({ page }) => {
  // Fails closed, like every other value read off this device's storage: only
  // the string "1" opens a page (parseBoxRevealMark).
  await page.addInitScript(
    ([pk]) => {
      localStorage.setItem(`bbsbh:boxreveal:${pk}`, 'true')
    },
    [GAME_PK],
  )
  await page.goto(`${GAME}/boxscore`)
  await expect(page.getByRole('button', { name: SEAL })).toBeVisible()
})
