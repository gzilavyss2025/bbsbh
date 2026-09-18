// Coverage for the run differential report's data layer
// (src/api/around-the-game/runDifferential.js).
//
// The one thing here that is easy to get wrong and hard to see wrong is the
// three ways a club can have no postseason line: the year held none, the year
// is still being played, and the club was simply not invited. All three arrive
// as `postseason: null` or `made: false`, they read identically in a blank
// table cell, and only one of them is a failure. Most of these tests are about
// keeping them apart.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildReport,
  outcomeOf,
  exitRound,
  per162,
  seasonSpan,
  rate,
} from '../src/api/around-the-game/runDifferential.js'

// A settled season of a given bracket depth, and its two awkward cousins.
const settled = (rounds) => ({ clubs: 30, games: 162, rounds, held: true, complete: true })
const noPostseason = { clubs: 16, games: 154, rounds: 0, held: false, complete: true }
const beingPlayed = { clubs: 30, games: 153, rounds: 0, held: true, complete: false }

const round = (name, w, l) => ({ round: name, w, l, opp: 1 })

const club = (season, diff, postseason, extra = {}) => ({
  season,
  teamId: 158,
  name: 'Milwaukee Brewers',
  short: 'Brewers',
  w: 100,
  l: 62,
  rs: 800,
  ra: 800 - diff,
  diff,
  postseason,
  ...extra,
})

const madeIt = (rounds, { ring = false } = {}) => ({
  made: true,
  ring,
  reachedWS: rounds.some((r) => r.round === 'World Series'),
  exitRank: rounds.length,
  rounds,
})

// --------------------------------------------------------------------------
// outcomeOf — the three blanks, kept apart.
// --------------------------------------------------------------------------
test('outcomeOf: a year that held no postseason is "none", not a miss', () => {
  assert.equal(outcomeOf(club(1902, 335, null), noPostseason), 'none')
})

test('outcomeOf: the season being played is "pending", not a miss', () => {
  assert.equal(outcomeOf(club(2026, 197, null), beingPlayed), 'pending')
})

test('outcomeOf: a club left out of a postseason that happened is "missed"', () => {
  const row = club(1954, 242, { made: false, ring: false, reachedWS: false, exitRank: 0, rounds: [] })
  assert.equal(outcomeOf(row, settled(1)), 'missed')
})

test('outcomeOf: one series played and lost is a first-round exit in any era', () => {
  // The same shape in two eras whose single round carries two different names.
  const modern = club(2022, 334, madeIt([round('NL Division Series', 1, 3)]))
  const older = club(1980, 210, madeIt([round('AL Championship Series', 1, 3)]))
  assert.equal(outcomeOf(modern, settled(4)), 'firstExit')
  assert.equal(outcomeOf(older, settled(2)), 'firstExit')
})

test('outcomeOf: losing the World Series is not a first-round exit, and not a ring', () => {
  const row = club(2019, 280, madeIt([
    round('AL Division Series', 3, 2),
    round('AL Championship Series', 4, 2),
    round('World Series', 3, 4),
  ]))
  assert.equal(outcomeOf(row, settled(4)), 'lostWS')
})

test('outcomeOf: a ring reads off the World Series row, not the last round played', () => {
  const rounds = [round('NL Division Series', 3, 1), round('World Series', 4, 3)]
  assert.equal(outcomeOf(club(2016, 252, madeIt(rounds, { ring: true })), settled(4)), 'ring')
  // Same rounds, same last row, no ring — the two must not be the same answer.
  assert.equal(outcomeOf(club(2016, 252, madeIt(rounds)), settled(4)), 'lostWS')
})

test('outcomeOf: going out after two series is not a first-round exit', () => {
  const row = club(2021, 269, madeIt([
    round('NL Wild Card Series', 1, 0),
    round('NL Championship Series', 2, 4),
  ]))
  assert.equal(outcomeOf(row, settled(4)), 'lostLater')
})

// --------------------------------------------------------------------------
// exitRound — the series that ended it.
// --------------------------------------------------------------------------
test('exitRound: the last series played, or null when none was', () => {
  const row = club(2023, 207, madeIt([round('NL Division Series', 0, 3)]))
  assert.deepEqual(exitRound(row), { round: 'NL Division Series', w: 0, l: 3, opp: 1 })
  assert.equal(exitRound(club(1902, 335, null)), null)
})

// --------------------------------------------------------------------------
// per162 — a margin on one scale across three schedule lengths.
// --------------------------------------------------------------------------
test('per162: stretches a short season and leaves a full one alone', () => {
  assert.equal(per162({ w: 81, l: 81, diff: 200 }), 200)
  // 2020: +136 over 60 games is a +367 pace.
  assert.equal(per162({ w: 43, l: 17, diff: 136 }), 367)
  // 154-game era: +200 is worth more than +200 over 162.
  assert.equal(per162({ w: 100, l: 54, diff: 200 }), 210)
})

test('per162: a club with no finished games prorates to nothing, not to infinity', () => {
  assert.equal(per162({ w: 0, l: 0, diff: 50 }), 0)
})

// --------------------------------------------------------------------------
// seasonSpan — the eras really are discontinuous.
// --------------------------------------------------------------------------
test('seasonSpan: writes gaps back as separate ranges', () => {
  // The Division Series era: 1981's split season, then 1995 onward.
  assert.equal(seasonSpan([1995, 1981, 1996, 1997]), '1981, 1995–1997')
  // 1994 is a hole in the middle of the Championship Series era.
  assert.equal(seasonSpan([1992, 1993, 1995]), '1992–1993, 1995')
  assert.equal(seasonSpan([1969]), '1969')
})

// --------------------------------------------------------------------------
// rate — nothing over nothing is a dash, never a confident zero.
// --------------------------------------------------------------------------
test('rate: null when there is no sample to take it over', () => {
  assert.equal(rate(0, 0), null)
  assert.equal(rate(5, 22), 23)
})

// --------------------------------------------------------------------------
// buildReport — the fold the page prints.
// --------------------------------------------------------------------------
const data = {
  floor: 150,
  firstSeason: 1902,
  lastSeason: 2026,
  seasons: {
    1902: noPostseason,
    1954: settled(1),
    2016: settled(4),
    2020: { clubs: 30, games: 60, rounds: 4, held: true, complete: true },
    2022: settled(4),
    2026: beingPlayed,
  },
  rows: [
    club(1902, 335, null),
    club(1954, 242, { made: false, ring: false, reachedWS: false, exitRank: 0, rounds: [] }),
    club(2016, 252, madeIt([round('World Series', 4, 3)], { ring: true })),
    // Clears only the prorated bar: +136 over a 60-game season.
    club(2020, 136, madeIt([round('AL Division Series', 0, 3)]), { w: 43, l: 17 }),
    club(2022, 334, madeIt([round('NL Division Series', 1, 3)])),
    club(2026, 197, null, { w: 95, l: 58 }),
  ],
}

test('buildReport: the threshold cuts the board on the RAW margin', () => {
  const report = buildReport(data, 200)
  // Widest first, so the seasons come back in margin order, not year order.
  assert.deepEqual(
    report.rows.map((r) => `${r.season}:+${r.diff}`),
    ['1902:+335', '2022:+334', '2016:+252', '1954:+242'],
  )
  // 2020 clears +200 only after proration, so it is off the board but must
  // still be counted in its era's per-162 column — see the era test below.
  assert.equal(report.rows.some((r) => r.season === 2020), false)
})

test('buildReport: rows come back widest first', () => {
  const report = buildReport(data, 150)
  const margins = report.rows.map((r) => r.diff)
  assert.deepEqual(margins, [...margins].sort((a, b) => b - a))
})

test('buildReport: the per-162 count sees clubs the raw cut dropped', () => {
  const report = buildReport(data, 200)
  const deep = report.eras.find((e) => e.rounds === 4)
  // 2016 and 2022 cleared +200 outright; 2020 only on the prorated reading.
  assert.equal(deep.over, 2)
  assert.equal(deep.overPer162, 3)
})

test('buildReport: totals separate the ring, the miss and the two non-results', () => {
  const t = buildReport(data, 150).totals
  assert.equal(t.ring, 1) // 2016
  assert.equal(t.missed, 1) // 1954
  assert.equal(t.none, 1) // 1902
  assert.equal(t.pending, 1) // 2026
  // The two that are not results are excluded from the rate's denominator, so
  // the season being played can never drag a percentage down.
  assert.equal(t.decided, t.n - t.none - t.pending)
})

test('buildReport: an era with nothing settled reports no rate at all', () => {
  const report = buildReport(data, 150)
  const now = report.eras.find((e) => e.key === 'now')
  assert.equal(now.over, 1)
  assert.equal(now.decided, 0)
  assert.equal(rate(now.ring, now.decided), null)
})

test('buildReport: the missed list holds only clubs a postseason actually excluded', () => {
  const report = buildReport(data, 150)
  assert.deepEqual(report.missed.map((r) => r.season), [1954])
})

test('buildReport: survives an empty file rather than throwing', () => {
  const report = buildReport(null, 200)
  assert.deepEqual(report.rows, [])
  assert.deepEqual(report.eras, [])
  assert.equal(report.totals.n, 0)
})
