// Coverage for the attendance data layer: the generator's pure reducers
// (gen-attendance.mjs) and the reader/selectors (src/api/attendance.js).
//
// The schedule row the generator folds (Final only, officialDate dedup, a
// zero gate treated as absent) is gen-gate.mjs's `toRow` and is covered once
// in test/gate.test.js — this file starts from rows it has already produced.
import assert from 'node:assert/strict'
import test from 'node:test'
import { SELLOUT_FILL, byTeamId, capacityOf, seasonRow } from '../scripts/gen-attendance.mjs'
import { attendanceFor, attendanceRatesFor } from '../src/api/attendance.js'

// Fenway seats 37,755 in the static park table; Dodger Stadium 56,000.
const FENWAY = 'Fenway Park'
const DODGER = 'Dodger Stadium'

const at = (attendance, venue = FENWAY, homeId = 111) => ({ homeId, attendance, venue })

// --------------------------------------------------------------------------
// capacityOf — the park join the sellout count and the fill rate both need.
// --------------------------------------------------------------------------
test('capacityOf reads the listed capacity, and is null off the table', () => {
  assert.equal(capacityOf(FENWAY), 37755)
  // Alias-resolved: the park table keys Dodger Stadium under its sponsor
  // name too, and both spellings have to find the one record.
  assert.equal(capacityOf('Dodger Stadium'), 56000)
  assert.equal(capacityOf('Uniqlo Field at Dodger Stadium'), 56000)
  assert.equal(capacityOf('Some Double-A Park'), null)
  assert.equal(capacityOf(null), null)
})

// --------------------------------------------------------------------------
// seasonRow — one club's home dates -> the row attendance.json ships.
// --------------------------------------------------------------------------
test('seasonRow totals, averages and brackets a club season', () => {
  const row = seasonRow([at(30000), at(20000), at(40000)])
  assert.equal(row.games, 3)
  assert.equal(row.total, 90000)
  assert.equal(row.avg, 30000)
  assert.equal(row.high, 40000)
  assert.equal(row.low, 20000)
})

test('seasonRow counts a sellout at the threshold, not only at capacity', () => {
  // 37,755 * 0.95 = 35,867.25 — so 35,868 sells out and 35,867 does not.
  const row = seasonRow([at(35868), at(35867), at(37755), at(38200)])
  assert.equal(SELLOUT_FILL, 0.95)
  assert.equal(row.sellouts, 3)
})

test('seasonRow measures fill against the park each date was played in', () => {
  const row = seasonRow([at(30000, FENWAY), at(30000, DODGER)])
  assert.equal(row.capGames, 2)
  assert.equal(row.seats, 37755 + 56000)
  assert.equal(row.seated, 60000)
})

test('seasonRow keeps a date at a park with no listed capacity out of the fill and the sellouts', () => {
  const row = seasonRow([at(30000, FENWAY), at(20000, 'Some Neutral Site Abroad')])
  assert.equal(row.games, 2)
  assert.equal(row.total, 50000)
  assert.equal(row.capGames, 1)
  assert.equal(row.seats, 37755)
  assert.equal(row.seated, 30000)
})

test('seasonRow says "cannot say" rather than zero when no park is on file', () => {
  const row = seasonRow([at(20000, 'Some Neutral Site Abroad')])
  assert.equal(row.sellouts, null)
  assert.equal(row.capGames, null)
  assert.equal(row.seats, null)
})

test('seasonRow is null when no date reported a gate', () => {
  assert.equal(seasonRow([]), null)
  assert.equal(seasonRow([{ homeId: 111, attendance: null, venue: FENWAY }]), null)
})

test('byTeamId buckets by the HOME club only', () => {
  const rows = [at(30000, FENWAY, 111), at(40000, DODGER, 119), at(20000, FENWAY, 111)]
  const clubs = byTeamId(rows)
  assert.deepEqual(Object.keys(clubs).sort(), ['111', '119'])
  assert.equal(clubs[111].games, 2)
  assert.equal(clubs[119].games, 1)
})

// --------------------------------------------------------------------------
// reader/selectors
// --------------------------------------------------------------------------
const row = (games, avg, high, low, extra = {}) => ({
  games,
  avg,
  high,
  low,
  total: avg * games,
  sellouts: 4,
  capGames: games,
  seats: 40000 * games,
  seated: avg * games,
  ...extra,
})

const DATA = {
  generatedAt: '2026-08-01T00:00:00.000Z',
  selloutFill: 0.95,
  seasons: {
    2026: {
      byTeamId: {
        158: row(10, 40000, 45000, 32000),
        147: row(12, 38000, 41000, 30000),
        121: row(8, 38000, 39000, 36000),
      },
    },
  },
}

test('attendanceFor selects one team/season row, null when absent', () => {
  assert.equal(attendanceFor(DATA, 158, 2026).avg, 40000)
  assert.equal(attendanceFor(DATA, 999, 2026), null)
  assert.equal(attendanceFor(null, 158, 2026), null)
})

test('attendanceRatesFor: rank is by average, richest gate first', () => {
  const top = attendanceRatesFor(DATA, 158, 2026)
  assert.equal(top.avg, 40000)
  assert.equal(top.rank, 1)
  assert.equal(top.of, 3)
  assert.equal(top.tied, false)
})

test('attendanceRatesFor: ties on average share the best rank', () => {
  const tiedA = attendanceRatesFor(DATA, 147, 2026)
  const tiedB = attendanceRatesFor(DATA, 121, 2026)
  assert.equal(tiedA.rank, 2)
  assert.equal(tiedB.rank, 2)
  assert.equal(tiedA.tied, true)
  assert.equal(tiedB.tied, true)
})

test('attendanceRatesFor: the total rank re-orders the average rank', () => {
  // 147 draws less per date than 158 but plays more of them, so it leads the
  // league on the season total while sitting 2nd on the average — the whole
  // reason both ranks are on the card.
  const most = attendanceRatesFor(DATA, 147, 2026)
  assert.equal(most.total, 456000)
  assert.equal(most.totalRank, 1)
  assert.equal(most.totalOf, 3)
  assert.equal(attendanceRatesFor(DATA, 158, 2026).totalRank, 2)
})

test('attendanceRatesFor: fill is the crowd over the seats, one decimal, never clamped', () => {
  const full = attendanceRatesFor(
    { selloutFill: 0.95, seasons: { 2026: { byTeamId: { 158: row(2, 41000, 0, 0) } } } },
    158,
    2026,
  )
  assert.equal(full.fill, 102.5)
  assert.equal(full.fillRank, 1)
  assert.equal(full.fillOf, 1)
})

test('attendanceRatesFor: the sellout count carries its own denominator and threshold', () => {
  const one = attendanceRatesFor(DATA, 158, 2026)
  assert.equal(one.sellouts, 4)
  assert.equal(one.selloutOf, 10)
  assert.equal(one.selloutPct, 95)
})

test('attendanceRatesFor: a club with no park on file ranks on heads but not on fill', () => {
  const data = {
    selloutFill: 0.95,
    seasons: {
      2026: {
        byTeamId: {
          158: row(10, 40000, 45000, 32000),
          133: row(10, 20000, 25000, 15000, {
            sellouts: null,
            capGames: null,
            seats: null,
            seated: null,
          }),
        },
      },
    },
  }
  const off = attendanceRatesFor(data, 133, 2026)
  assert.equal(off.rank, 2)
  assert.equal(off.totalRank, 2)
  assert.equal(off.fill, null)
  assert.equal(off.fillRank, null)
  // Ranked out of the clubs that COULD be measured, not out of all thirty.
  assert.equal(attendanceRatesFor(data, 158, 2026).fillOf, 1)
})

test('attendanceRatesFor: null for a missing club, a missing file, or no games ingested', () => {
  assert.equal(attendanceRatesFor(DATA, 999, 2026), null)
  assert.equal(attendanceRatesFor(null, 158, 2026), null)
  const empty = { seasons: { 2026: { byTeamId: { 200: { games: 0, avg: null } } } } }
  assert.equal(attendanceRatesFor(empty, 200, 2026), null)
})
