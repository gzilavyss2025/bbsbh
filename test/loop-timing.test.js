// Unit coverage for the scoring-loop stopwatch (src/lib/loopTiming.js), the
// instrument that tests the Express Lane PRD's load-bearing claim: staging
// delivers a plate appearance every ~25s and "nobody scores one faster."
//
// The properties that matter here are the ones that would quietly produce a
// WRONG answer rather than an obvious failure: a walk-away gap averaged in as if
// it were scoring, a re-step counted as a second, fast interval, or a mean used
// where the tail is the whole question.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AWAY_GAP_MS,
  STAGING_BUDGET_S,
  appendMark,
  intervals,
  loopTimingKey,
  percentile,
  readMarks,
  summarize,
} from '../src/lib/loopTiming.js'

const at = (h, a, t) => ({ h, a, t })

test('loopTimingKey keeps the trailing colon so prefix sweeps cannot collide', () => {
  assert.equal(loopTimingKey(823739), 'bbsbh:looptiming:823739')
})

test('readMarks drops anything that is not exactly a {h,a,t} mark', () => {
  const raw = JSON.stringify([
    at(6, 1, 1000), // keep
    { h: 6, a: 2 }, // no clock
    { h: -1, a: 1, t: 5 }, // negative half
    { h: 1.5, a: 1, t: 5 }, // non-integer half
    { h: 6, a: 3, t: 0 }, // zero clock
    'nonsense',
    null,
    at(6, 4, 2000), // keep
  ])
  assert.deepEqual(readMarks(raw), [at(6, 1, 1000), at(6, 4, 2000)])
})

test('readMarks survives a hand-mangled or absent value', () => {
  assert.deepEqual(readMarks('{not json'), [])
  assert.deepEqual(readMarks('{"h":6}'), []) // an object, not an array
  assert.deepEqual(readMarks(''), [])
  assert.deepEqual(readMarks(null), [])
})

test('appendMark REPLACES a re-stepped at-bat instead of adding a second mark', () => {
  // Stepping back in focus mode and forward again must not manufacture a fast
  // interval — that would bias the median toward "the scorer is quick" and flip
  // the very conclusion this measurement exists to test.
  let marks = [at(6, 1, 1_000), at(6, 2, 20_000)]
  marks = appendMark(marks, at(6, 2, 21_000))
  assert.equal(marks.length, 2)
  assert.deepEqual(marks, [at(6, 1, 1_000), at(6, 2, 21_000)])
})

test('appendMark keeps clock order even when a mark arrives out of order', () => {
  let marks = appendMark([], at(6, 2, 20_000))
  marks = appendMark(marks, at(6, 1, 1_000))
  assert.deepEqual(
    marks.map((m) => m.t),
    [1_000, 20_000],
  )
})

test('appendMark caps the key and keeps the newest', () => {
  let marks = []
  for (let i = 0; i < 10; i++) marks = appendMark(marks, at(0, i, 1_000 * (i + 1)), 4)
  assert.equal(marks.length, 4)
  assert.deepEqual(
    marks.map((m) => m.a),
    [6, 7, 8, 9],
  )
})

test('intervals separates scoring from getting up for a beer', () => {
  const marks = [
    at(6, 1, 0),
    at(6, 2, 18_000), // 18s — scoring
    at(6, 3, 36_000), // 18s — scoring
    at(7, 1, 36_000 + AWAY_GAP_MS + 1), // over the threshold — away
    at(7, 2, 36_000 + AWAY_GAP_MS + 1 + 15_000), // 15s — scoring
  ]
  const { scoring, away } = intervals(marks)
  assert.deepEqual(scoring, [18_000, 18_000, 15_000])
  assert.equal(away, 1)
})

test('a walk-away gap is EXCLUDED from the distribution, not averaged in', () => {
  // The bug this pins: a single 40-minute gap would drag a mean from ~18s to
  // ~500s and make staging look comfortably ahead when it is not.
  const fast = [at(0, 0, 0), at(0, 1, 15_000), at(0, 2, 30_000)]
  const withBreak = [...fast, at(1, 0, 30_000 + 40 * 60_000), at(1, 1, 30_000 + 40 * 60_000 + 15_000)]
  assert.equal(summarize(fast).medianS, 15)
  assert.equal(summarize(withBreak).medianS, 15)
  assert.equal(summarize(withBreak).awayGaps, 1)
})

test('percentile is nearest-rank and clamps at both ends', () => {
  const s = [10, 20, 30, 40, 50]
  assert.equal(percentile(s, 50), 30)
  assert.equal(percentile(s, 20), 10)
  assert.equal(percentile(s, 80), 40)
  assert.equal(percentile(s, 0), 10)
  assert.equal(percentile(s, 100), 50)
  assert.equal(percentile([], 50), null)
})

test('summarize reports the verdict against the median, and withholds it on a thin sample', () => {
  // Nine intervals is not a game; the verdict stays null rather than guessing.
  const thin = []
  for (let i = 0; i <= 9; i++) thin.push(at(0, i, i * 15_000))
  assert.equal(summarize(thin).intervals, 9)
  assert.equal(summarize(thin).outrunsScorer, null)

  // Twenty at 15s: the scorer is FASTER than the 25s staging budget, so staging
  // does not outrun them — the outcome the PRD assumed away.
  const fast = []
  for (let i = 0; i <= 20; i++) fast.push(at(0, i, i * 15_000))
  const f = summarize(fast)
  assert.equal(f.medianS, 15)
  assert.equal(f.outrunsScorer, false)
  assert.equal(f.shareFasterThanBudget, 100)

  // Twenty at 30s: staging stays ahead.
  const slow = []
  for (let i = 0; i <= 20; i++) slow.push(at(0, i, i * 30_000))
  const sl = summarize(slow)
  assert.equal(sl.medianS, 30)
  assert.equal(sl.outrunsScorer, true)
  assert.equal(sl.shareFasterThanBudget, 0)
})

test('summarize carries the budget it judged against, so a readout cannot drift from it', () => {
  assert.equal(summarize([]).budgetS, STAGING_BUDGET_S)
  assert.equal(summarize([], { budgetS: 18 }).budgetS, 18)
})

test('summarize on an empty or single-mark game reports nothing rather than zero', () => {
  const empty = summarize([])
  assert.equal(empty.intervals, 0)
  assert.equal(empty.medianS, null)
  assert.equal(empty.outrunsScorer, null)
  assert.equal(empty.shareFasterThanBudget, null)
  assert.equal(summarize([at(0, 0, 1_000)]).intervals, 0)
})

test('THE SPOILER INVARIANT: a mark can carry only position and a clock', () => {
  // The instrument must never become a place a result can hide. Anything beyond
  // {h,a,t} — a score, an event type, a description — is dropped on read, so a
  // careless future caller cannot smuggle one into storage and back out again.
  const smuggled = JSON.stringify([
    { h: 6, a: 4, t: 1_000, result: 'Grounds out', runs: 2, away: 3, home: 1, event: 'field_out' },
  ])
  const [mark] = readMarks(smuggled)
  assert.deepEqual(Object.keys(mark).sort(), ['a', 'h', 't'])
})
