// WHERE A SEASON BEGAN AND WHERE IT ENDED (scripts/lib/level-path.mjs) — the
// arithmetic behind issue #1122, tested without a network.
//
// The bug it exists to stop: a pool entry's `levels` is a Set sorted by level,
// so reading its two ends as a climb cannot tell a promotion from a demotion,
// and reads a rehab cameo three levels below a player's own as a three-level
// rise. Checked against dated game logs, that reading put nineteen names on the
// High-A promotions list that had not been promoted at all.
//
// The second half of these tests is the correction to the FIRST fix, which took
// the busiest level in each window and strung them together. That loses the
// September call-up — a player promoted in the last fortnight plays most of it
// at the level he left — and four of those same nineteen names were real
// promotions dropped exactly that way.
import assert from 'node:assert/strict'
import test from 'node:test'
import { levelSpan, movedUp, seasonWindows } from '../scripts/lib/level-path.mjs'

// ROK(0) through AAA(4) — MILB_LEVELS' order, the opposite direction from the
// raw sportIds.
const RANK = new Map([
  [16, 0],
  [14, 1],
  [13, 2],
  [12, 3],
  [11, 4],
])
const rank = (id) => (RANK.has(id) ? RANK.get(id) : null)
// One window's worth of one level, written the way the generator records it.
const at = (window, sportId, games = 10) => ({ window, sportId, games })
const span = (observations) => levelSpan(observations, rank)
const climbed = (observations) => movedUp(levelSpan(observations, rank), rank)

test('half-month windows cover a real level season and no more', () => {
  // High-A 2026: April 2 to September 6, off the level's own published row.
  const windows = seasonWindows('2026-04-02', '2026-09-06')
  assert.equal(windows.length, 11)
  // The first and last are clamped to the season, not to the half-month.
  assert.deepEqual(windows[0], { key: '2026-04-1', start: '2026-04-02', end: '2026-04-15' })
  assert.deepEqual(windows.at(-1), { key: '2026-09-1', start: '2026-09-01', end: '2026-09-06' })
  // In order, contiguous, and inside the season at both ends.
  for (let i = 1; i < windows.length; i += 1) {
    assert.ok(windows[i].start > windows[i - 1].end, `window ${i} follows ${i - 1}`)
  }
  assert.ok(windows.every((w) => w.start >= '2026-04-02' && w.end <= '2026-09-06'))
})

test('every level lands on ONE clock, whatever day its own season opened', () => {
  // Triple-A 2026 opened March 27 and Double-A April 2, so their first windows
  // are clamped to different dates. Their April fortnights must still be the
  // same instant, or a player's Double-A April reads as later than his
  // Triple-A April and a promotion looks like a rehab.
  const aaa = seasonWindows('2026-03-27', '2026-09-20')
  const aa = seasonWindows('2026-04-02', '2026-09-13')
  assert.equal(aaa[0].key, '2026-03-2')
  assert.notEqual(aaa[1].start, aa[0].start)
  assert.equal(aaa[1].key, aa[0].key)
  assert.equal(aa[0].key, '2026-04-1')
})

test('a season inside one half-month is one window, and a bad span is none', () => {
  assert.deepEqual(seasonWindows('2026-04-03', '2026-04-09'), [
    { key: '2026-04-1', start: '2026-04-03', end: '2026-04-09' },
  ])
  assert.deepEqual(seasonWindows('2026-09-06', '2026-04-02'), [])
  assert.deepEqual(seasonWindows(null, '2026-09-06'), [])
  assert.deepEqual(seasonWindows('2026-04-02', 'later'), [])
})

test('February is 28 or 29 days, and a span can cross a New Year', () => {
  const windows = seasonWindows('2028-01-20', '2028-03-02')
  assert.deepEqual(windows[1], { key: '2028-02-1', start: '2028-02-01', end: '2028-02-15' })
  assert.deepEqual(windows[2], { key: '2028-02-2', start: '2028-02-16', end: '2028-02-29' })
  assert.deepEqual(windows.at(-1), { key: '2028-03-1', start: '2028-03-01', end: '2028-03-02' })
})

test('a promotion is a season that opens at one level and closes higher', () => {
  const rows = [at(0, 14), at(1, 14), at(2, 13), at(3, 13), at(4, 12)]
  assert.deepEqual(span(rows), { from: 14, to: 12 })
  assert.equal(climbed(rows), true)
})

test('a demotion is a season that closes below where it opened', () => {
  const rows = [at(0, 11), at(1, 11), at(2, 12), at(3, 12)]
  assert.deepEqual(span(rows), { from: 11, to: 12 })
  assert.equal(climbed(rows), false)
})

test('a rehab assignment returns to where it came from, so it is not a move', () => {
  // Three games at High-A in the middle of a Triple-A season.
  const rows = [at(0, 11), at(1, 11), at(4, 13, 3), at(5, 11), at(6, 11)]
  assert.deepEqual(span(rows), { from: 11, to: 11 })
  assert.equal(climbed(rows), false)
})

test('a rehab stint at the very END of a season is still not a promotion', () => {
  // The cameo shares the last window with the level he actually plays at, so
  // the "arrived latest" tie-break hands `to` to High-A — and High-A is BELOW
  // Triple-A, so the season reads as ending lower, which is not a climb.
  const rows = [at(0, 11), at(1, 11), at(2, 11), at(2, 13, 3)]
  assert.deepEqual(span(rows), { from: 11, to: 13 })
  assert.equal(climbed(rows), false)
})

test('a September call-up is a promotion even though he played more below it', () => {
  // THE CASE THE FIRST FIX GOT WRONG. Five High-A games and one Double-A game
  // in the final fortnight: a "busiest level wins the window" rule answers
  // High-A and the call-up disappears. The span reads Double-A as the level he
  // arrived at latest, which is what it is.
  const rows = [at(0, 13, 10), at(1, 13, 11), at(2, 13, 5), at(2, 12, 1)]
  assert.deepEqual(span(rows), { from: 13, to: 12 })
  assert.equal(climbed(rows), true)
})

test('a detour does not disqualify a season that still ends higher', () => {
  // Sent down in June, back up in July, promoted in September.
  const rows = [at(0, 13), at(3, 14), at(5, 13), at(9, 12)]
  assert.deepEqual(span(rows), { from: 13, to: 12 })
  assert.equal(climbed(rows), true)
})

test('a season that goes up and comes back ends where it started', () => {
  // High-A all year with a Double-A spell in the middle. `levels` cannot tell
  // this from a promotion; the two ends can.
  const rows = [at(0, 13), at(1, 13), at(5, 12), at(6, 12), at(9, 13), at(10, 13)]
  assert.deepEqual(span(rows), { from: 13, to: 13 })
  assert.equal(climbed(rows), false)
})

test('when nothing distinguishes two levels, neither end claims a climb', () => {
  // Both levels open and close in the same single window, so there is no order
  // to read. `from` takes the higher and `to` the lower, which cannot be a rise.
  const rows = [at(4, 13, 6), at(4, 12, 6)]
  assert.deepEqual(span(rows), { from: 12, to: 13 })
  assert.equal(climbed(rows), false)
})

test('the opening tie goes to the level he left soonest', () => {
  // Both start in window 0; High-A stops there and Double-A runs on, so High-A
  // is where the season opened and Double-A is where it went.
  const rows = [at(0, 13), at(0, 12), at(1, 12), at(2, 12)]
  assert.deepEqual(span(rows), { from: 13, to: 12 })
  assert.equal(climbed(rows), true)
})

test('it ignores what it cannot place, and says nothing about one level', () => {
  // One level all season is not a move and gets no answer at all — which its
  // reader must not confuse with a board too old to say.
  assert.equal(span([at(0, 13), at(1, 13)]), null)
  assert.equal(span([]), null)
  assert.equal(span(null), null)
  // MLB (sportId 1) is not in the minors ranking, a window with no games is not
  // a window he played, and a window index that is not an integer cannot be
  // ordered against the rest. Each leaves one level standing, so: no answer.
  assert.equal(span([at(0, 13), at(1, 1, 20)]), null)
  assert.equal(span([at(0, 13), at(1, 12, 0)]), null)
  assert.equal(span([at(0, 14), at('later', 12)]), null)
})

test('movedUp needs two ends it can compare', () => {
  assert.equal(movedUp(null, rank), false)
  assert.equal(movedUp({ from: 14, to: 11 }, rank), true)
  assert.equal(movedUp({ from: 11, to: 14 }, rank), false)
  assert.equal(movedUp({ from: 13, to: 13 }, rank), false)
  assert.equal(movedUp({ from: 13, to: 1 }, rank), false)
})
