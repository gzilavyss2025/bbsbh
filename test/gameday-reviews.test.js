// Reviews and the ABS bank (#2607), clamped to the reader's step. Pinned on
// three trimmed real games (built by .scratch/gameday-engine/build-fixture.mjs;
// every review below was read off the live feed on 2026-10-26):
//  - 823036 MIL@STL: top 2 ab10 Frelick's failed ABS challenge (play level);
//    bottom 3 ab24 Fermín's failed ABS challenge (pitch level), then ab25 a
//    manager's replay challenge (MA) on a pickoff, overturned.
//  - 823169 MIN@SF: the umpires' own reviews — top 2 ab11 (NO, fair/foul) and
//    top 4 ab26 (NH, a home run) — with no club on them.
//  - 815625 STP@TOL: 13 innings, five failed away challenges, refills in extras.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reviewsAtStep } from '../src/api/gameday/reviews.js'
import { challengesForPlay } from '../src/api/challenges.js'

const load = (pk) =>
  JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url), 'utf8'))
const g823036 = load(823036)
const g823169 = load(823169)
const g815625 = load(815625)

test('a challenge in a play past the step is absent, and the bank has not spent it', () => {
  const before = reviewsAtStep(g823036, { inning: 2, half: 'top', step: 3, revealedThrough: 1 })
  assert.equal(before.reviews.length, 0)
  assert.equal(before.bank.away.remaining, 2)
  const after = reviewsAtStep(g823036, { inning: 2, half: 'top', step: 4, revealedThrough: 1 })
  assert.equal(after.reviews.length, 1)
  assert.equal(after.reviews[0].kind, 'abs')
  assert.equal(after.reviews[0].side, 'away')
  assert.equal(after.reviews[0].overturned, false)
  assert.equal(after.bank.away.remaining, 1)
  assert.equal(after.bank.away.used, 1)
})

test("a manager's replay challenge is listed with its reason and does not touch the ABS bank", () => {
  const at24 = reviewsAtStep(g823036, { inning: 3, half: 'bottom', step: 7, revealedThrough: 4 })
  assert.equal(at24.reviews.filter((r) => r.kind === 'manager').length, 0)
  const at25 = reviewsAtStep(g823036, { inning: 3, half: 'bottom', step: 8, revealedThrough: 4 })
  const ma = at25.reviews.find((r) => r.kind === 'manager')
  assert.equal(ma.atBatIndex, 25)
  assert.equal(ma.side, 'home')
  assert.equal(ma.reasonCode, 'A')
  assert.equal(ma.reason, 'Tag play')
  assert.equal(ma.overturned, true)
  assert.equal(at25.bank.home.remaining, at24.bank.home.remaining)
})

test('the ABS records agree with challengesForPlay for the whole game (no second spelling)', () => {
  const all = reviewsAtStep(g823036, { inning: 9, half: 'bottom', revealedThrough: 99 })
  const mine = all.reviews
    .filter((r) => r.kind === 'abs')
    .map((r) => [r.side, r.overturned ? 'success' : 'fail', r.pitchNumber, r.isHeuristic, r.playerId])
  const theirs = g823036.liveData.plays.allPlays
    .flatMap((p) => challengesForPlay(g823036, p))
    .map((c) => [c.side, c.outcome, c.pitchNumber, c.isHeuristic, c.playerId])
  assert.deepEqual(mine, theirs)
})

test("the umpires' own reviews carry no club", () => {
  const r = reviewsAtStep(g823169, { inning: 4, half: 'top', step: 1, revealedThrough: 6 })
  const crew = r.reviews.filter((x) => x.kind === 'crew')
  assert.deepEqual(
    crew.map((x) => [x.atBatIndex, x.reason, x.side, x.overturned]),
    [
      [11, 'Fair/foul in outfield', null, false],
      [26, 'Home run', null, false],
    ],
  )
  const before = reviewsAtStep(g823169, { inning: 4, half: 'top', step: 0, revealedThrough: 6 })
  assert.equal(before.reviews.some((x) => x.atBatIndex === 26), false)
})

test('a club that enters an extra inning empty is given one challenge', () => {
  const endOf10 = reviewsAtStep(g815625, { inning: 10, half: 'bottom', revealedThrough: 99 })
  assert.equal(endOf10.bank.away.remaining, 0)
  const startOf11 = reviewsAtStep(g815625, { inning: 11, half: 'top', step: 0, revealedThrough: 99 })
  assert.equal(startOf11.bank.away.remaining, 1)
})

test("the whole-game bank matches the feed's own counts (checked here, never read by the module)", () => {
  const end = reviewsAtStep(g815625, { inning: 13, half: 'bottom', revealedThrough: 99 }).bank
  const feedSays = g815625.gameData.absChallenges
  for (const s of ['away', 'home']) {
    assert.equal(end[s].overturned, feedSays[s].usedSuccessful)
    assert.equal(end[s].used - end[s].overturned, feedSays[s].usedFailed)
    assert.equal(end[s].remaining, feedSays[s].remaining)
  }
})

test('a review still in progress has no outcome and spends nothing', () => {
  const live = structuredClone(g823036)
  live.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 10).reviewDetails.inProgress = true
  const r = reviewsAtStep(live, { inning: 2, half: 'top', step: 4, revealedThrough: 1 })
  assert.equal(r.reviews[0].inProgress, true)
  assert.equal(r.reviews[0].overturned, null)
  assert.equal(r.bank.away.remaining, 2)
})

test('a game that does not run ABS has no bank but keeps its other reviews', () => {
  const noAbs = structuredClone(g823169)
  delete noAbs.gameData.absChallenges
  delete noAbs.gameData.venue
  const r = reviewsAtStep(noAbs, { inning: 4, half: 'top', step: 1, revealedThrough: 6 })
  assert.equal(r.bank, null)
  assert.equal(r.reviews.filter((x) => x.kind === 'crew').length, 2)
})

test('a half past the reveal mark + 1 reads nothing; an empty feed does not throw', () => {
  assert.equal(reviewsAtStep(g823036, { inning: 3, half: 'bottom', step: 8, revealedThrough: 3 }), null)
  assert.deepEqual(reviewsAtStep({}, { inning: 1, half: 'top', revealedThrough: -1 }), { reviews: [], bank: null })
  assert.equal(reviewsAtStep(g823036, { half: 'top', revealedThrough: 3 }), null)
})

test('the module never reads gameData.absChallenges', () => {
  const code = readFileSync(new URL('../src/api/gameday/reviews.js', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  assert.equal(/absChallenges/.test(code), false)
})

test('a null step on the half being stepped reads as step 0', () => {
  const r = reviewsAtStep(g823036, { inning: 2, half: 'top', step: null, revealedThrough: 1 })
  assert.equal(r.reviews.length, 0)
})
