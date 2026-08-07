import { test, expect } from '../fixtures.js'

// The core invariant (CLAUDE.md: "the whole point of the app"): a sealed
// value must not exist in the DOM pre-reveal, not merely be hidden by CSS.
// `SealBox` only invokes its render-function children in the revealed
// branch, wrapping the result in `.statgrid` — that markup is a direct
// structural proxy for "has this seal been revealed," so absence of it is
// exactly what would break if someone hoisted a reveal-only selector out to
// render-top-level or a pre-reveal `useMemo`. Viewport-independent, so this
// runs on mobile only (see playwright.config.js).
const GAME = '/07072026/milstl-2'

test('half-inning stat line is absent from the DOM, not just hidden, until revealed', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  await expect(page.locator('.statgrid')).toHaveCount(0)
  await expect(page.locator('.statline')).toHaveCount(0)

  await page.getByRole('button', { name: /Reveal the rest of half/i }).click()

  // Each coverless SealBox for this half (the play-by-play feed, the Insights
  // stat card, and — only on a game with ABS challenges — the AbsCard) wraps
  // its revealed content in its own `.statgrid` proxy, so the count here can
  // legitimately be 2 or 3 depending on the fixture game; the invariant is
  // "at least one", not an exact number tied to how many cards this half has.
  expect(await page.locator('.statgrid').count()).toBeGreaterThan(0)
  await expect(page.locator('.statline')).toHaveCount(1)
})

test('box score is absent from the DOM until its own seal is tapped', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)

  // Multiple SealBoxes can live on this page (box score, game buzz, …) —
  // none of them should have leaked their content pre-tap.
  await expect(page.locator('.statgrid')).toHaveCount(0)

  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()

  await expect(page.locator('.statgrid').first()).toBeVisible()
})

// The Play of the Game card's video affordance is the newest thing inside that
// same seal, and the FIRST image on a scoring surface sourced from a clip —
// a poster frame is a picture of the play, so it has to obey the seal exactly
// like the numbers do. Both halves matter here: the Watch button (whose very
// presence says "this play was worth filming") and the <img> (whose `src`
// would be a real network request for a still of the play, even if CSS hid
// it). Neither may exist pre-tap.
//
// This fixture game is pinned deliberately: gamePk 823035's WPA-picked play
// (Luis Lara's single) HAS an eligible clip with a poster, verified live
// 2026-08-06 — so the post-reveal half of this test asserts the button really
// renders, rather than passing vacuously on a game with no clip at all. Most
// games have one; if this ever starts failing after reveal, confirm the clip
// still exists before assuming the join broke.
test('Play of the Game poster and Watch button stay behind the box score seal', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)

  await expect(page.locator('.bs__potgWatch')).toHaveCount(0)
  await expect(page.locator('.bs__potgPoster')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Watch highlight/i })).toHaveCount(0)

  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()

  // Exactly one — the card ranks a single play, so a second button would mean
  // the lookup had started matching something other than that one play.
  await expect(page.locator('.bs__potgWatch')).toHaveCount(1)
  await expect(page.locator('.bs__potgPoster')).toHaveCount(1)

  // The label must stay generic: never the clip's own title, which narrates
  // the outcome (same discipline as PlayByPlay's per-play button).
  const watch = page.getByRole('button', { name: /Watch highlight for/i })
  await expect(watch).toHaveCount(1)
  await expect(watch).toContainText(/Watch/i)

  // And it opens the shared sheet rather than a second implementation.
  await watch.click()
  await expect(page.locator('.hlsheet')).toBeVisible()
})

// The video row under the line score (GameVideoRow.jsx) is a whole reel of the
// same material the test above guards one clip of: MLB's condensed cut plus
// every per-play highlight, each one a poster frame and a title that narrates
// its own outcome. Its ONLY protection is where it is mounted — inside the box
// score's SealBox reveal function — so this asserts exactly that, on the
// element that would exist if someone hoisted it out.
//
// Same pinned fixture game as above (gamePk 823035, verified 2026-08-06 to
// carry both a condensed cut and eligible clips), so the post-reveal half
// can't pass vacuously.
test('the condensed game and highlight rail stay behind the box score seal', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)

  await expect(page.locator('.hlclip')).toHaveCount(0)
  await expect(page.locator('.hlclip__poster')).toHaveCount(0)
  await expect(page.locator('.cliprail')).toHaveCount(0)

  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()

  // Exactly one feature print — the condensed game — and a rail of clips
  // beside it.
  await expect(page.locator('.hlclip--feature')).toHaveCount(1)
  await expect(page.locator('.cliprail .hlclip')).not.toHaveCount(0)

  // The kraft tab names the feed and its runtime: "CONDENSED GAME (12:20)".
  await expect(page.locator('.hlclip--feature .hlclip__play')).toHaveText(
    /Condensed Game \(\d{1,2}:\d{2}\)/i,
  )

  // And it opens the same shared sheet every other clip does.
  await page.locator('.hlclip--feature').click()
  await expect(page.locator('.hlsheet')).toBeVisible()
})
