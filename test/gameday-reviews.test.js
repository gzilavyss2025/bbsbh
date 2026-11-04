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
import { reviewsInPlay } from '../src/api/gameday/reviews.js'
import { challengesForPlay } from '../src/api/challenges.js'

const load = (pk) =>
  JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url), 'utf8'))
const g823036 = load(823036)
const g823169 = load(823169)
const g815625 = load(815625)
const reviewsOf = (feed, upTo = Infinity) =>
  feed.liveData.plays.allPlays.filter((p) => p.about.atBatIndex <= upTo).flatMap((p) => reviewsInPlay(feed, p))

test('the module never reads gameData.absChallenges', () => {
  const code = readFileSync(new URL('../src/api/gameday/reviews.js', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  assert.equal(/absChallenges/.test(code), false)
})


test("a manager's replay challenge is listed with its reason", () => {
  const ma = reviewsOf(g823036).find((r) => r.kind === 'manager' && r.atBatIndex === 25)
  assert.equal(ma.side, 'home')
  assert.equal(ma.reasonCode, 'A')
  assert.equal(ma.reason, 'Tag play')
  assert.equal(ma.overturned, true)
})

test('the ABS records agree with challengesForPlay for the whole game (no second spelling)', () => {
  const mine = reviewsOf(g823036)
    .filter((r) => r.kind === 'abs')
    .map((r) => [r.side, r.overturned ? 'success' : 'fail', r.pitchNumber, r.isHeuristic, r.playerId])
  const theirs = g823036.liveData.plays.allPlays
    .flatMap((p) => challengesForPlay(g823036, p))
    .map((c) => [c.side, c.outcome, c.pitchNumber, c.isHeuristic, c.playerId])
  assert.deepEqual(mine, theirs)
})

test("the umpires' own reviews carry no club", () => {
  const crew = reviewsOf(g823169, 26).filter((x) => x.kind === 'crew')
  assert.deepEqual(
    crew.map((x) => [x.atBatIndex, x.reason, x.side, x.overturned]),
    [
      [11, 'Fair/foul in outfield', null, false],
      [26, 'Home run', null, false],
    ],
  )
})

test('a review still in progress has no outcome', () => {
  const live = structuredClone(g823036)
  live.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 10).reviewDetails.inProgress = true
  const r = reviewsOf(live, 10).find((x) => x.atBatIndex === 10)
  assert.equal(r.inProgress, true)
  assert.equal(r.overturned, null)
})

test('an ABS challenge still under review has no outcome yet (pitch level too)', () => {
  const live = structuredClone(g823036)
  // Fermín's pitch-level ABS challenge, bottom 3rd, ab24.
  const p = live.liveData.plays.allPlays.find((x) => x.about.atBatIndex === 24)
  p.playEvents.find((e) => e.reviewDetails).reviewDetails.inProgress = true
  const abs = reviewsOf(live, 24).find((x) => x.atBatIndex === 24)
  assert.equal(abs.kind, 'abs')
  assert.equal(abs.overturned, null)
  assert.equal(abs.reasonCode, 'J')
})
