// The live series page's pure sort of one Series (src/api/postseason/bracket.js)
// into the three buckets it shows (#1230, slice 6): games already counted
// before the cutoff, the game ON the cutoff date (at most one), and the games
// still ahead. bracket.js's own header records why these never overlap —
// upcomingGames() never repeats the cutoff game inside `upcoming` — so this
// pins that a selector reading a fixture Series sorts them the same way,
// rather than re-deriving the bracket itself.
import assert from 'node:assert/strict'
import test from 'node:test'
import { seriesGameBuckets, upcomingGameLabel } from '../../src/screens/postseason-live/selectors.js'

const CHC = { id: 112, name: 'Chicago Cubs', abbreviation: 'CHC' }
const MIL = { id: 158, name: 'Milwaukee Brewers', abbreviation: 'MIL' }

// Shaped like the 2025 NLDS example in docs/api/postseason.md, heading into
// 2025-10-09: MIL leads 2-1, Game 4 plays today, Game 5 is "if necessary"
// with no date (the row the cutoff game can remove).
function fixtureSeries(overrides) {
  return {
    slots: [
      { club: CHC, wins: 1, from: null, bye: false },
      { club: MIL, wins: 2, from: null, bye: true },
    ],
    games: [
      { gamePk: 813047, gameNumber: 1, date: '2025-10-04', winnerId: 158 },
      { gamePk: 813048, gameNumber: 2, date: '2025-10-06', winnerId: 158 },
      { gamePk: 813049, gameNumber: 3, date: '2025-10-08', winnerId: 112 },
    ],
    playsOnCutoff: true,
    cutoffGame: { gamePk: 813050, gameNumber: 4 },
    upcoming: [
      { gameNumber: 4, gamePk: 813050, date: '2025-10-09', ifNecessary: false },
      { gameNumber: 5, gamePk: null, date: null, ifNecessary: true },
    ],
    decided: false,
    winner: null,
    eliminated: null,
    ...overrides,
  }
}

test('seriesGameBuckets sorts a Series into results/today/upcoming, disjoint', () => {
  const s = fixtureSeries()
  const { results, today, upcoming } = seriesGameBuckets(s)
  assert.deepEqual(results.map((g) => g.gamePk), [813047, 813048, 813049])
  assert.deepEqual(today, { gamePk: 813050, gameNumber: 4 })
  assert.deepEqual(upcoming.map((g) => g.gamePk), [null])

  const resultPks = new Set(results.map((g) => g.gamePk))
  assert.ok(!resultPks.has(today.gamePk), 'a counted result never repeats as today’s game')
  assert.ok(
    !upcoming.some((g) => g.gamePk && resultPks.has(g.gamePk)),
    'a counted result never repeats inside upcoming',
  )
})

test('an upcoming entry with a null date reports "If necessary" with no date', () => {
  const s = fixtureSeries()
  const removable = s.upcoming[1]
  assert.equal(removable.date, null)
  assert.equal(upcomingGameLabel(removable), 'If necessary')
  // A dated entry reports its date plainly, not "if necessary" wording.
  assert.equal(upcomingGameLabel(s.upcoming[0]), '2025-10-09')
})

test('a decided series (no cutoffGame, no upcoming) claims no today’s game', () => {
  const decided = fixtureSeries({
    decided: true,
    winner: MIL,
    eliminated: CHC,
    playsOnCutoff: false,
    cutoffGame: null,
    upcoming: [],
  })
  const { today, upcoming } = seriesGameBuckets(decided)
  assert.equal(today, null)
  assert.deepEqual(upcoming, [])
})

test('seriesGameBuckets degrades to empty buckets for a missing series', () => {
  const { results, today, upcoming } = seriesGameBuckets(null)
  assert.deepEqual(results, [])
  assert.equal(today, null)
  assert.deepEqual(upcoming, [])
})

test('upcoming never repeats today’s game', () => {
  const { today, upcoming } = seriesGameBuckets(fixtureSeries())
  assert.ok(!upcoming.some((g) => g.gameNumber === today.gameNumber), 'today’s game shows once, under Today')
  assert.deepEqual(upcoming.map((g) => g.gameNumber), [5])
})

test('a dated game that may not be needed says so next to its date', () => {
  const g = { gameNumber: 3, gamePk: 1, date: '2026-10-01', ifNecessary: true }
  assert.equal(upcomingGameLabel(g), '2026-10-01 · If necessary')
  assert.equal(upcomingGameLabel(g, () => 'Oct 1'), 'Oct 1 · If necessary')
  assert.equal(upcomingGameLabel({ ...g, ifNecessary: false }, () => 'Oct 1'), 'Oct 1')
})
