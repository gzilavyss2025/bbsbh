// Unit coverage for the mound card's derivations (src/api/workload.js's
// dayStripFor / turnStripFor / moundRateFor).
//
// The card these feed is the pitcher's counterpart to a hitter's last-three-
// games read, and its whole claim is that it DESCRIBES rather than predicts: it
// reports days elapsed, the gap a starter's own turns have kept, and what he
// threw. So the things pinned here are the ones that would quietly turn a
// description into a claim — a strip that counts today as spent, a "typical
// gap" computed over a stretch that includes the All-Star break, a load band
// invented rather than taken from the app's own tired thresholds.
import assert from 'node:assert/strict'
import test from 'node:test'
import { dayStripFor, turnStripFor, moundRateFor, LOAD_BANDS } from '../src/api/workload.js'

const data = {
  season: 2026,
  asOf: '2026-08-23',
  baselines: {
    SP: { last10: { mean: 844.1, sd: 126.6, n: 137 }, last3: { mean: 260.1, sd: 39.9, n: 137 }, app7: { mean: 1.2, sd: 0.4, n: 137 } },
    RP: { last10: { mean: 206.4, sd: 125.7, n: 216 }, last3: { mean: 62.7, sd: 41.1, n: 216 }, app7: { mean: 2.5, sd: 0.9, n: 216 } },
  },
  cohorts: { winning: {}, losing: {} },
  pitchers: {
    // A six-man-turn starter whose season straddles the All-Star break, so the
    // gap list carries one 13-day outlier the "typical" read must not swallow.
    starter: {
      name: 'Starter', teamId: 158, role: 'SP',
      apps: [
        { d: '2026-08-21', p: 96, gs: 1 }, { d: '2026-08-15', p: 98, gs: 1 },
        { d: '2026-08-09', p: 94, gs: 1 }, { d: '2026-08-02', p: 83, gs: 1 },
        { d: '2026-07-26', p: 83, gs: 1 }, { d: '2026-07-20', p: 65, gs: 1 },
        { d: '2026-07-07', p: 103, gs: 1 }, { d: '2026-07-02', p: 82, gs: 1 },
      ],
      season: { g: 24, gs: 24, pitches: 2179, outs: 435, bf: 550, strikes: 1484 },
    },
    // A multi-inning reliever: one heavy outing, one light, one three-pitch cameo.
    reliever: {
      name: 'Reliever', teamId: 158, role: 'RP',
      apps: [
        { d: '2026-08-22', p: 21 }, { d: '2026-08-20', p: 40 },
        { d: '2026-08-16', p: 3 }, { d: '2026-08-15', p: 31 },
        { d: '2026-08-12', p: 24 },
      ],
      season: { g: 60, gs: 1, pitches: 1295, outs: 216, bf: 315, strikes: 800 },
    },
    // A starter who has not taken a turn in months — injured, or shut down. A
    // "days since" strip would draw one cell per elapsed day.
    shutDown: {
      name: 'Shut Down', teamId: 158, role: 'SP',
      apps: [
        { d: '2026-07-03', p: 110, gs: 1 }, { d: '2026-06-24', p: 89, gs: 1 },
        { d: '2026-06-17', p: 91, gs: 1 },
      ],
      season: { g: 12, gs: 12, pitches: 1100, outs: 200, bf: 280, strikes: 700 },
    },
    // An opener: classifies SP by games-started share, but works like a reliever.
    opener: {
      name: 'Opener', teamId: 158, role: 'SP',
      apps: [
        { d: '2026-08-22', p: 18, gs: 1 }, { d: '2026-08-19', p: 21, gs: 1 },
        { d: '2026-08-16', p: 16, gs: 1 },
      ],
      season: { g: 20, gs: 15, pitches: 340, outs: 60, bf: 80, strikes: 220 },
    },
  },
}
const AS_OF = '2026-08-23'

test('dayStripFor: one cell per day, oldest first, today last and never spent', () => {
  const strip = dayStripFor(data, 'reliever', AS_OF)
  assert.equal(strip.length, 14)
  assert.equal(strip[0].date, '2026-08-10')
  assert.equal(strip[13].date, '2026-08-23')
  // Today is the frame's right edge and carries no load: the file holds only
  // completed appearances, and he may still pitch tonight.
  assert.equal(strip[13].today, true)
  assert.equal(strip[13].pitches, null)
  assert.equal(strip.filter((c) => c.today).length, 1)
})

test('dayStripFor: load bands come from the app\'s own tired thresholds', () => {
  const by = Object.fromEntries(dayStripFor(data, 'reliever', AS_OF).map((c) => [c.date, c]))
  assert.equal(by['2026-08-22'].pitches, 21)
  assert.equal(by['2026-08-22'].band, 'light')     // under the 25 "pitched yesterday" flag
  assert.equal(by['2026-08-15'].band, 'moderate')  // 31 — at or over 25, under 35
  assert.equal(by['2026-08-20'].band, 'heavy')     // 40 — at or over the 35 three-day flag
  assert.equal(by['2026-08-16'].band, 'light')     // a 3-pitch cameo is still an outing
  assert.equal(by['2026-08-11'].band, 'none')      // a day off is not a light day
  assert.equal(by['2026-08-11'].pitches, null)
  assert.deepEqual(LOAD_BANDS, { light: 0, moderate: 25, heavy: 35 })
})

test('dayStripFor: unknown pitcher returns null so the caller can say "not posted"', () => {
  // workload.json is built from the 30 active MLB rosters, so a AAA arm — and
  // an MLB pitcher optioned down mid-season — simply has no record.
  assert.equal(dayStripFor(data, 'nobody', AS_OF), null)
})

test('turnStripFor: days since the last START, not the last appearance', () => {
  const t = turnStripFor(data, 'starter', AS_OF)
  assert.equal(t.lastStart, '2026-08-21')
  assert.equal(t.daysSince, 2)
  assert.equal(t.lastStartPitches, 96)
})

test('turnStripFor: the typical gap is a RANGE over recent turns, and excludes the break', () => {
  const t = turnStripFor(data, 'starter', AS_OF)
  // Gaps most-recent-first: 6, 6, 7, 7, 6, 13, 5 — the 13 is the All-Star break.
  assert.deepEqual(t.gaps.slice(0, 5), [6, 6, 7, 7, 6])
  // Over the last five turns he has gone every sixth or seventh day. Reporting
  // a single number here would have been the card's one prediction.
  assert.deepEqual([t.typicalMin, t.typicalMax], [6, 7])
  // The outlier is visible to a caller that wants it, never folded into the range.
  assert.equal(t.gaps.includes(13), true)
})

test('turnStripFor: an opener is not handed a rotation turn', () => {
  // pitcherRole is gs/g >= 0.5, so a dedicated opener classifies SP. Giving him
  // a "his last five turns came every 6th day" strip would be a wrong card, not
  // a thin one — he goes every third day and never past the first inning.
  assert.equal(turnStripFor(data, 'opener', AS_OF), null)
  // The reliever strip is what he gets instead, and it still works for him.
  assert.equal(dayStripFor(data, 'opener', AS_OF).length, 14)
})

test('moundRateFor: outs per outing separates a one-inning arm from a long man', () => {
  const rel = moundRateFor(data, 'reliever')
  assert.equal(rel.outsPerOuting, 3.6)   // 216 outs / 60 appearances
  assert.equal(rel.multiInning, true)
  const st = moundRateFor(data, 'starter')
  assert.equal(st.ipPerStart, '6.0')     // 435 outs / 24 starts = 18.1 outs
  assert.equal(st.pitchesPerStart, 91)   // 2179 / 24, rounded
})

test('moundRateFor: no season games means no rates rather than a divide by zero', () => {
  const empty = { pitchers: { x: { role: 'RP', apps: [], season: { g: 0, gs: 0, pitches: 0, outs: 0 } } } }
  assert.equal(moundRateFor(empty, 'x'), null)
})

test('turnStripFor: a man months past his last start is not in a turn', () => {
  // 52 days since. Drawing one cell per elapsed day would render a 52-cell
  // strip, and "his last turns came every 7 days" would be describing a
  // rotation he is no longer in. The elapsed count IS the whole story here.
  const t = turnStripFor(data, 'shutDown', AS_OF)
  assert.equal(t.daysSince, 51)
  assert.equal(t.outOfTurn, true)
  // A pitcher inside his normal turn is not flagged.
  assert.equal(turnStripFor(data, 'starter', AS_OF).outOfTurn, false)
})

test('the strips read as of TODAY, never a day past it', () => {
  // workload.json's own asOf IS the current day, and the buckets above shift it
  // forward by one so a same-day appearance still counts. That shift must not
  // reach a CALENDAR reading: a day past today makes "yesterday" mean today,
  // inflates days-since by one, and — worst — slides availabilityFor's
  // three-day window off the end, so this card would call a man fresh while the
  // Bullpen Board, reading the real game date off the same file, calls him
  // limited. Same file, same pitcher, two verdicts.
  const t = turnStripFor(data, 'starter', AS_OF)
  assert.equal(t.daysSince, 2)                    // Aug 21 -> Aug 23, not 3
  const strip = dayStripFor(data, 'reliever', AS_OF)
  assert.equal(strip.at(-1).date, AS_OF)          // today is the right edge
  assert.equal(strip.at(-1).today, true)
})
