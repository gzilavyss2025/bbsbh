// Day lines (#2606): the batter's and the pitcher's line for today, clamped to
// the step the reader has tapped to. Pinned on the captured real game (gamePk
// 823035, test/fixtures/game-823035.trimmed.json). The entry indexes below are
// computeHalfInningFeed's for that game:
//  - top 3: 0 Ward (806198) triples, 1 K, 2 Moniak (592885) grounds out and
//    drives Ward in (+1 RBI), 3 out.
//  - top 6: 0 walk off Detmers (690928), 1 mound visit, 2 pitching change to
//    694363, 3 walk off 694363, then more.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { batterDayLine, pitcherDayLine } from '../src/api/gameday/dayLine.js'

const feed = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)
// Top 3 is half index 4; a reader stepping it has revealed through index 3.
const TOP3 = { inning: 3, half: 'top', revealedThrough: 3 }
const TOP6 = { inning: 6, half: 'top', revealedThrough: 9 }

test('step k never sees step k+1: a run scored on a later card is not on the line yet', () => {
  assert.equal(batterDayLine(feed, 806198, { ...TOP3, step: 0 }), null)
  const atTriple = batterDayLine(feed, 806198, { ...TOP3, step: 1 })
  assert.equal(atTriple.h, 1)
  assert.equal(atTriple.r, 0)
  const atRbi = batterDayLine(feed, 806198, { ...TOP3, step: 3 })
  assert.equal(atRbi.r, 1)
})

test('an RBI lands on the step that drove it, not before', () => {
  assert.equal(batterDayLine(feed, 592885, { ...TOP3, step: 2 }).rbi, 0)
  assert.equal(batterDayLine(feed, 592885, { ...TOP3, step: 3 }).rbi, 1)
})

test('earlier halves count: the batter keeps his day', () => {
  const line = batterDayLine(feed, 592885, { ...TOP3, step: 3 })
  assert.equal(line.pa, 2) // top 1 and top 3
  assert.equal(line.ab, 2)
  assert.equal(line.h, 0)
})

test('the last step of the half and a committed half (step null) agree', () => {
  const last = batterDayLine(feed, 592885, { ...TOP3, step: 4 })
  const whole = batterDayLine(feed, 592885, { ...TOP3, step: null, revealedThrough: 4 })
  assert.deepEqual(last, whole)
})

test('a half past the reveal mark + 1 reads nothing', () => {
  assert.equal(batterDayLine(feed, 592885, { ...TOP3, step: 3, revealedThrough: 2 }), null)
  assert.equal(pitcherDayLine(feed, 690928, { ...TOP3, step: 3, revealedThrough: 2 }), null)
})

test('a walk is a plate appearance but not an at-bat', () => {
  // 596142 walks to open top 5 (index 0); his top-2 out is his only earlier trip.
  const line = batterDayLine(feed, 596142, { inning: 5, half: 'top', revealedThrough: 7, step: 1 })
  assert.equal(line.pa, 2)
  assert.equal(line.ab, 1)
  assert.equal(line.bb, 1)
})

test('a pitching change mid-half gives each pitcher his own line', () => {
  // Step 2 shows only the walk off the starter and the mound visit.
  assert.equal(pitcherDayLine(feed, 694363, { ...TOP6, step: 2 }), null)
  const starterBefore = pitcherDayLine(feed, 690928, { ...TOP6, step: 2 })
  // Step 4 adds the change and the reliever's first batter (a walk).
  const reliever = pitcherDayLine(feed, 694363, { ...TOP6, step: 4 })
  assert.equal(reliever.bf, 1)
  assert.equal(reliever.bb, 1)
  // The starter's line does not move when the reliever's batter is shown.
  const starterAfter = pitcherDayLine(feed, 690928, { ...TOP6, step: 4 })
  assert.equal(starterAfter.bf, starterBefore.bf)
  assert.equal(starterAfter.bb, starterBefore.bb)
})

test("a pitcher's line counts only up to the step", () => {
  const atOne = pitcherDayLine(feed, 690928, { ...TOP3, step: 1 })
  const atFour = pitcherDayLine(feed, 690928, { ...TOP3, step: 4 })
  assert.equal(atFour.bf - atOne.bf, 3)
  assert.equal(atOne.r, 0) // the triple is on, the run that scores him is not
  assert.equal(atFour.r, 1)
})

test('missing fields fall back to null and never throw', () => {
  assert.equal(batterDayLine({}, 1, TOP3), null)
  assert.equal(pitcherDayLine({}, 1, TOP3), null)
  assert.equal(batterDayLine(feed, null, TOP3), null)
  assert.equal(batterDayLine(feed, 592885, { half: 'top', revealedThrough: 3 }), null)
})

test('a feed with no pitch data does not throw', () => {
  const bare = structuredClone(feed)
  for (const p of bare.liveData.plays.allPlays) delete p.playEvents
  assert.doesNotThrow(() => batterDayLine(bare, 592885, { ...TOP3, step: 3 }))
  assert.doesNotThrow(() => pitcherDayLine(bare, 690928, { ...TOP3, step: 3 }))
})

test('a null step on the half being stepped reads as step 0, never the whole half', () => {
  // Top 3 is half 4; revealedThrough 3 means it is not committed yet.
  assert.equal(batterDayLine(feed, 806198, { ...TOP3, step: null }), null)
  assert.deepEqual(
    pitcherDayLine(feed, 690928, { ...TOP3, step: null }),
    pitcherDayLine(feed, 690928, { ...TOP3, step: 0 }),
  )
})

test("a pinch runner's run is his, not the batter's he ran for", () => {
  // Top 7: 641343 walks (ab54), 669003 runs for him and scores on ab56.
  const TOP7 = { inning: 7, half: 'top', revealedThrough: 99, step: null }
  assert.equal(batterDayLine(feed, 641343, TOP7).r, 0)
  assert.equal(batterDayLine(feed, 669003, TOP7).r, 1)
  assert.equal(batterDayLine(feed, 669003, TOP7).pa, 0)
})

test('the live, still-open plate appearance counts for nothing', () => {
  const live = structuredClone(feed)
  // Turn Moniak's top-3 at-bat (ab index 2 of that half) into the live one.
  const p = live.liveData.plays.allPlays.find(
    (x) => x.about.inning === 3 && x.about.halfInning === 'top' && x.matchup.batter.id === 592885,
  )
  p.about.isComplete = false
  p.result = { type: 'atBat' }
  p.runners = []
  const line = batterDayLine(live, 592885, { ...TOP3, step: 3 })
  assert.equal(line.pa, 1) // top 1 only
  assert.equal(line.ab, 1)
})
