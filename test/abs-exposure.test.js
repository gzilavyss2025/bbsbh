// Coverage for the exposure reader behind /abs-challenges's "How often is
// normal" (src/api/around-the-game/absExposure.js) — the DENOMINATOR half of
// the ABS report, which asks how often a man is even exposed to a call he
// could argue.
//
// Two of these pin mistakes that were real rather than hypothetical:
//
//   1. A MARK PLACED BY A HAND-COUNTED BIN INDEX drifts from its own label the
//      first time the data moves. The median rule in the first draft of this
//      section pointed at 5.11 under a label reading 5.90, so binPosition maps
//      a VALUE through the same edges the labels are written from, and these
//      tests check the two agree.
//   2. A BATTER HAS TWO DENOMINATORS AND THEY ARE NOT INTERCHANGEABLE. "One
//      challenge every forty plate appearances" and "6.4 per thousand pitches
//      seen" are the same fact over different divisors, and reading the second
//      off plate appearances gives 24.9 — an answer four times too big that
//      still looks like a rate.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  binPosition,
  exposureBoard,
  exposureFor,
  exposureKind,
  histogram,
  leagueBaseline,
  MIN_CATCHER_INNINGS,
  MIN_PLATE_APPEARANCES,
} from '../src/api/around-the-game/absExposure.js'

// One row of the sweep, with the shape gen-abs-challenges.mjs --exposure
// writes. `per1000Pitches` and `per9Caught` are precomputed in the file, so the
// fixture carries them the way the reader will find them.
const batter = (over) => ({
  playerId: 1,
  name: 'A Hitter',
  position: 'LF',
  pitches: 1000,
  plateAppearances: 250,
  catcherInnings: null,
  catcherStarts: null,
  asBatter: 6,
  asCatcher: 0,
  asPitcher: 0,
  per1000Pitches: 6,
  perPlateAppearance: 0.024,
  per9Caught: null,
  ...over,
})

const catcher = (over) => ({
  playerId: 2,
  name: 'A Catcher',
  position: 'C',
  pitches: 800,
  plateAppearances: 210,
  catcherInnings: 900,
  catcherStarts: 100,
  asBatter: 0,
  asCatcher: 100,
  asPitcher: 0,
  per1000Pitches: 0,
  perPlateAppearance: 0,
  per9Caught: 1,
  ...over,
})

const level = (players) => ({ players })

// --------------------------------------------------------------------------
// histogram — bins of a fixed width, and a tail that has to go somewhere.
// --------------------------------------------------------------------------

test('histogram: the first edge falls on a step boundary, not on the lowest value', () => {
  // 1.3 is the smallest value; the first bin starts at 0, not at 1.3. A bin
  // starting on a datum labels the axis with a number nobody chose and moves
  // every label the night a new low arrives.
  const bins = histogram([1.3, 2.4, 3.9], 2, 3)
  assert.deepEqual(
    bins.map((b) => b.from),
    [0, 2, 4],
  )
  assert.deepEqual(
    bins.map((b) => b.n),
    [1, 2, 0],
  )
})

test('histogram: the last bin absorbs everything above it', () => {
  // One man at 29.5 must not draw fifteen columns, thirteen of them empty.
  const bins = histogram([0, 1, 29.5], 2, 3)
  assert.equal(bins.length, 3)
  assert.equal(bins[2].last, true)
  assert.equal(bins[2].n, 1)
  assert.equal(bins.reduce((n, b) => n + b.n, 0), 3)
})

test('histogram: a value ON an upper edge belongs to the bin above it', () => {
  // The bins are half-open, so 2 is the first value of the 2-to-4 bin rather
  // than the last of the 0-to-2 one. Getting this backwards moves a whole
  // column's worth of men one place left.
  const bins = histogram([0, 2, 4], 2, 3)
  assert.deepEqual(
    bins.map((b) => b.n),
    [1, 1, 1],
  )
})

test('histogram: nothing to count draws nothing, and a bad step does not throw', () => {
  assert.deepEqual(histogram([], 2, 4), [])
  assert.deepEqual(histogram(null, 2, 4), [])
  assert.deepEqual(histogram([1, 2], 0, 4), [])
  assert.deepEqual(histogram([1, 2], 2, 0), [])
})

// --------------------------------------------------------------------------
// binPosition — the mark and its label have to agree.
// --------------------------------------------------------------------------

test('binPosition: a value lands exactly where its own label is drawn', () => {
  const bins = histogram([0, 5, 9], 2, 5) // labelled 0, 2, 4, 6, 8
  // THIS IS THE INVARIANT THE SECTION RESTS ON. Each label is centred under its
  // column, so the label "4" sits at the centre of the third column — and the
  // VALUE 4 has to land on that same point, or a rule reading "median 4" points
  // somewhere the reader can see it does not mean.
  assert.equal(binPosition(4, bins), (2 + 0.5) / 5)
  assert.equal(binPosition(0, bins), (0 + 0.5) / 5)
  assert.equal(binPosition(8, bins), (4 + 0.5) / 5)
  // And a value between two labels lands between them, in proportion.
  assert.equal(binPosition(5, bins), (2.5 + 0.5) / 5)
})

test('binPosition: a value past the last bin is drawn on the last column', () => {
  // The last bin absorbs the tail, so a man at 40 has to land INSIDE the chart
  // or the rule leaves it altogether — and the honest place is the "4+" column
  // that already counts him, not a point further right that claims a precision
  // the catch-all bin does not have.
  const bins = histogram([0, 4], 2, 3) // labelled 0, 2, 4+
  const at = binPosition(40, bins)
  assert.ok(at > 0 && at < 1, `expected a fraction inside the plot, got ${at}`)
  assert.equal(at, binPosition(4, bins))
  assert.equal(binPosition(999, bins), at)
})

test('binPosition: the mark tracks the value rather than a counted index', () => {
  // The bug this exists to stop: a mark placed at bin index 2 for a value of
  // 5.90 lands at 5.11's column and the label lies. Moving the value a tenth
  // has to move the mark.
  const bins = histogram([0, 15], 2, 9)
  assert.ok(binPosition(5.9, bins) > binPosition(5.11, bins))
  assert.notEqual(binPosition(5.9, bins), binPosition(5.11, bins))
})

test('binPosition: nothing to place returns null rather than zero', () => {
  const bins = histogram([0, 4], 2, 3)
  assert.equal(binPosition(null, bins), null)
  assert.equal(binPosition(1, []), null)
  assert.equal(binPosition(1, null), null)
})

// --------------------------------------------------------------------------
// leagueBaseline — one fact, two divisors.
// --------------------------------------------------------------------------

test('leagueBaseline: the rate is read on the EXPOSURE, not on the per-call divisor', () => {
  // 12 challenges over 3,000 pitches is 4.0 per thousand. Over 750 plate
  // appearances it is one every 62.5 times up. Both are true and neither is
  // the other; dividing the rate by plate appearances gives 16, which still
  // looks like a rate.
  const rows = [
    batter({ playerId: 1, asBatter: 8, pitches: 2000, plateAppearances: 500 }),
    batter({ playerId: 2, asBatter: 4, pitches: 1000, plateAppearances: 250 }),
  ]
  const base = leagueBaseline(level(rows), 'batter')
  assert.equal(base.calls, 12)
  assert.equal(base.denominator, 750)
  assert.equal(base.per, 62.5)
  assert.equal(base.rate, 4)
})

test('leagueBaseline: a catcher is measured per nine innings caught', () => {
  const rows = [catcher({ asCatcher: 50, catcherInnings: 450 })]
  const base = leagueBaseline(level(rows), 'catcher')
  assert.equal(base.per, 9)
  assert.equal(base.rate, 1)
})

test('leagueBaseline: it covers every man, floor or no floor', () => {
  // "A batter challenges once every forty plate appearances" is a fact about
  // the LEAGUE. Applying the histogram's floor to it would report the habits
  // of regulars as everyone's.
  const rows = [
    batter({ playerId: 1, asBatter: 10, pitches: 4000, plateAppearances: 1000 }),
    batter({ playerId: 2, asBatter: 10, pitches: 400, plateAppearances: 100 }),
  ]
  const base = leagueBaseline(level(rows), 'batter')
  assert.equal(base.calls, 20)
  assert.equal(base.denominator, 1100)
})

test('leagueBaseline: a level nobody challenged in has no rate, not a zero', () => {
  assert.equal(leagueBaseline(level([batter({ asBatter: 0 })]), 'batter'), null)
  assert.equal(leagueBaseline(null, 'batter'), null)
})

// --------------------------------------------------------------------------
// exposureBoard — the distribution the section is actually about.
// --------------------------------------------------------------------------

test('exposureBoard: the floor is applied, and it is applied to the right column', () => {
  // A hitter clears on PLATE APPEARANCES even though the chart is drawn per
  // thousand pitches. Filtering on pitches instead would admit a September
  // call-up who saw four hundred of them.
  const rows = [
    batter({ playerId: 1, plateAppearances: MIN_PLATE_APPEARANCES }),
    batter({ playerId: 2, plateAppearances: MIN_PLATE_APPEARANCES - 1, pitches: 4000 }),
  ]
  const board = exposureBoard(level(rows), 'batter')
  assert.equal(board.qualified, 1)
})

test('exposureBoard: a man who never challenged is counted, and kept in the chart', () => {
  // A full season of chances taken none of the time is the most extreme habit
  // on the board. Dropping it would make the league look more uniform than it
  // is, so he is counted AND binned.
  const rows = [
    batter({ playerId: 1, asBatter: 0, per1000Pitches: 0 }),
    batter({ playerId: 2, asBatter: 6, per1000Pitches: 6 }),
    batter({ playerId: 3, asBatter: 12, per1000Pitches: 12 }),
  ]
  const board = exposureBoard(level(rows), 'batter')
  assert.equal(board.never, 1)
  assert.equal(board.qualified, 3)
  assert.equal(board.bins.reduce((n, b) => n + b.n, 0), 3)
})

test('exposureBoard: the middle eight in ten, and the man at the top', () => {
  const rows = Array.from({ length: 11 }, (_, i) =>
    batter({ playerId: i + 1, name: `Hitter ${i}`, per1000Pitches: i, asBatter: i }),
  )
  const board = exposureBoard(level(rows), 'batter')
  assert.equal(board.median, 5)
  assert.equal(board.low, 1)
  assert.equal(board.high, 9)
  assert.equal(board.mean, 5)
  assert.equal(board.leader.name, 'Hitter 10')
})

test('exposureBoard: a catcher board reads its own rate and its own floor', () => {
  const rows = [
    catcher({ playerId: 1, catcherInnings: MIN_CATCHER_INNINGS, per9Caught: 1.2 }),
    catcher({ playerId: 2, catcherInnings: MIN_CATCHER_INNINGS - 1, per9Caught: 9 }),
  ]
  const board = exposureBoard(level(rows), 'catcher')
  assert.equal(board.qualified, 1)
  assert.equal(board.median, 1.2)
  assert.equal(board.kind.step, exposureKind('catcher').step)
})

test('exposureBoard: nobody clearing the floor draws nothing, not an empty board', () => {
  assert.equal(exposureBoard(level([batter({ plateAppearances: 10 })]), 'batter'), null)
  assert.equal(exposureBoard(level([]), 'batter'), null)
  assert.equal(exposureBoard(null, 'batter'), null)
})

test('exposureFor: a level the sweep has not reached is null, not an empty list', () => {
  const data = { levels: { MLB: level([batter({})]) } }
  assert.equal(exposureFor(data, 'MLB').players.length, 1)
  assert.equal(exposureFor(data, 'AAA'), null)
  assert.equal(exposureFor(null, 'MLB'), null)
})

// --------------------------------------------------------------------------
// The real file, as the page will read it.
// --------------------------------------------------------------------------

test('the shipped file answers both questions at both levels', async () => {
  // Not a snapshot of the figures — those move every night. What is pinned is
  // that the reader finds a usable board on each level and each kind, since a
  // silent null here draws nothing at all and looks like a styling bug.
  const fs = await import('node:fs')
  const url = new URL('../public/data/abs-exposure.json', import.meta.url)
  const data = JSON.parse(fs.readFileSync(url, 'utf8'))
  for (const key of ['MLB', 'AAA']) {
    const shipped = exposureFor(data, key)
    assert.ok(shipped, `${key} has no exposure rows`)
    for (const kind of ['batter', 'catcher']) {
      const board = exposureBoard(shipped, kind)
      assert.ok(board, `${key}/${kind} has no board`)
      assert.ok(board.qualified > 0)
      assert.equal(board.bins.length, exposureKind(kind).bins)
      // Every man who cleared the floor is in exactly one column.
      assert.equal(board.bins.reduce((n, b) => n + b.n, 0), board.qualified)
      // And both rules land inside the plot, which is what the chart draws.
      for (const at of [binPosition(board.median, board.bins), binPosition(board.mean, board.bins)]) {
        assert.ok(at > 0 && at < 1, `${key}/${kind} rule at ${at}`)
      }
      assert.ok(leagueBaseline(shipped, kind).per > 0)
    }
  }
})
