// Regression coverage for a real bug (player id 676760, traded SD -> PIT during
// the 2026 season): the career register printed his 2026 line as 74 G / 104.2 IP
// — exactly DOUBLE the true 37 G / 52.1 IP — and every MLB row above it summed
// past the API's own career line by that same margin.
//
// Cause: a stats fetch spanning a team change returns the per-team stints AND a
// synthetic, team-less roll-up equal to their sum. Verified live on 2026-08-03:
//
//   byDateRange 2026 sportId=1 ->  {team: 135 (SD),  G 33, IP '47.0'}
//                                  {team: 134 (PIT), G  4, IP  '5.1'}
//                                  {no team, numTeams: 2, G 37, IP '52.1'}
//
// yearByYear returns the same three-row shape, and `stats=career` returns one
// row that ALSO carries numTeams (3) — so the roll-up may only be dropped when
// the per-team rows it summarizes are present to be summed instead.
//
// careerRegisterView already deduped this for the non-current seasons it fed
// through levelSeasonStat; the leak was every OTHER path into aggregateSplits —
// the current season's date-cut row, resolveCurrentSeasonStat's levelOnlyStat,
// and the milestone career total.
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCurrentSeasonStat } from '../src/api/loadPlayer.js'
import { aggregateSplits, careerRegisterView, mlbCareerThroughCutoff } from '../src/api/person.js'
import { SPORT_IDS } from '../src/lib/teams.js'

const SD_STAT = {
  gamesPlayed: 33, gamesStarted: 0, wins: 2, losses: 0, saves: 0,
  inningsPitched: '47.0', earnedRuns: 25, hits: 44, baseOnBalls: 23, strikeOuts: 45,
  era: '4.79', whip: '1.43',
}
const PIT_STAT = {
  gamesPlayed: 4, gamesStarted: 0, wins: 0, losses: 0, saves: 0,
  inningsPitched: '5.1', earnedRuns: 4, hits: 6, baseOnBalls: 2, strikeOuts: 6,
  era: '6.75', whip: '1.50',
}
// The synthetic roll-up the API appends alongside the two stints above.
const COMBINED_STAT = {
  gamesPlayed: 37, gamesStarted: 0, wins: 2, losses: 0, saves: 0,
  inningsPitched: '52.1', earnedRuns: 29, hits: 50, baseOnBalls: 25, strikeOuts: 51,
  era: '4.99', whip: '1.43',
}

// The three rows exactly as statsapi returns them for a mid-season trade: two
// team-tagged stints plus the team-less `numTeams` roll-up.
function tradedSeasonSplits(season = 2026) {
  return [
    { season, sport: { id: 1 }, team: { id: 135 }, stat: SD_STAT },
    { season, sport: { id: 1 }, team: { id: 134 }, stat: PIT_STAT },
    { season, sport: { id: 1 }, numTeams: 2, stat: COMBINED_STAT },
  ]
}

test('aggregateSplits: a traded season sums its stints once, not twice', () => {
  const stat = aggregateSplits(tradedSeasonSplits(), 'pitching')

  assert.equal(stat.gamesPlayed, 37, 'the roll-up row must not be summed on top of the stints')
  assert.equal(stat.inningsPitched, '52.1')
  assert.equal(stat.era, '4.99')
  // The bug's exact fingerprint: every counting stat doubled.
  assert.notEqual(stat.gamesPlayed, 74)
  assert.notEqual(stat.inningsPitched, '104.2')
})

test('aggregateSplits: the lone stats=career row keeps its own numTeams span', () => {
  // No team-tagged sibling to sum instead, so the multi-team row IS the answer.
  const career = [{ numTeams: 3, stat: { gamesPlayed: 145, inningsPitched: '177.2', era: '3.60' } }]

  assert.equal(aggregateSplits(career, 'pitching').gamesPlayed, 145)
})

test('aggregateSplits: hand-built team-less rows still sum (the milestone career total)', () => {
  // mlbCareerThroughCutoff synthesizes rows with no team and no numTeams — a
  // team-less row is only ever dropped when it is a multi-team roll-up.
  const stat = mlbCareerThroughCutoff(
    {
      mlbSplits: [
        { season: 2024, sport: { id: 1 }, team: { id: 147 }, stat: { gamesPlayed: 16, inningsPitched: '23.1' } },
        ...tradedSeasonSplits(2025),
      ],
      tileStat: { gamesPlayed: 7, inningsPitched: '10.2' },
      tileSportId: 1,
      currentSeason: 2026,
    },
    'pitching',
  )

  // 16 + 37 (traded season counted ONCE) + 7 = 60, never 97.
  assert.equal(stat.gamesPlayed, 60)
})

test('resolveCurrentSeasonStat: a traded MLB season is not doubled into the tiles or the register row', async () => {
  const { stat, levelOnlyStat } = await resolveCurrentSeasonStat({
    id: 676760, group: 'pitching', season: 2026,
    startDate: '2026-01-01', endDate: '2026-08-03',
    sportId: 1, hasDebuted: true, levelStat: aggregateSplits(tradedSeasonSplits(), 'pitching'),
  })

  assert.equal(stat.gamesPlayed, 37)
  assert.equal(levelOnlyStat.gamesPlayed, 37)
})

test('careerRegisterView: a traded season is one row PER CLUB, each counted once, and the MLB total stays consistent', () => {
  const priorStat = {
    gamesPlayed: 16, gamesStarted: 0, wins: 1, losses: 0, saves: 0,
    inningsPitched: '23.1', earnedRuns: 10, hits: 20, baseOnBalls: 8, strikeOuts: 25,
    era: '3.86', whip: '1.20',
  }
  const register = careerRegisterView({
    mlbSplits: [
      ...tradedSeasonSplits(),
      { season: 2024, sport: { id: 1 }, team: { id: 147 }, stat: priorStat },
    ],
    milbSplits: [],
    group: 'pitching',
    role: null,
    debutYear: 2024,
    // What buildBlock passes: the date-cut current-season splits, still one row
    // per club, plus the aggregate of them as the empty-fetch fallback. Both
    // come from the same three-row traded-season response.
    currentSplits: tradedSeasonSplits(),
    currentStat: aggregateSplits(tradedSeasonSplits(), 'pitching'),
    currentSeason: 2026,
    currentSportId: 1,
    careerStat: null,
    warByYear: {},
    transactions: [],
  })

  // cells: [G, GS, W-L, ERA, IP, K, BB, WHIP, WAR]
  // The traded season is TWO rows now, one per club, in the order he played for
  // them — and the team-less roll-up must not become a phantom third row.
  const subtotal2026 = register.rows.find((r) => r.year === '2026' && r.subtotal)
  const rows2026 = register.rows.filter((r) => r.year === '2026' && !r.subtotal)
  assert.equal(rows2026.length, 2, 'one row per club, and no row for the roll-up')
  assert.equal(subtotal2026.teamLabel, '2 TM', 'the deliberate subtotal is identified, not a phantom API roll-up')
  assert.equal(subtotal2026.cells[0], 37)
  assert.equal(subtotal2026.cells[4], '52.1')
  assert.deepEqual(rows2026.map((r) => r.teamIds), [[135], [134]])
  assert.deepEqual(rows2026.map((r) => r.cells[0]), [33, 4])
  assert.deepEqual(rows2026.map((r) => r.cells[4]), ['47.0', '5.1'])
  // The bug's fingerprint, restated for the split rows: no row may carry the
  // roll-up's own 37 G / 52.1 IP, and the two must still sum to exactly that.
  assert.ok(!rows2026.some((r) => r.cells[0] === 37), 'no row may be the roll-up')
  assert.equal(rows2026[0].cells[0] + rows2026[1].cells[0], 37)

  // With no API career line supplied the MLB footer sums the shown rows, so it
  // is the register's own internal check: 33 + 4 + 16 = 53, and the innings
  // 47.0 + 5.1 + 23.1 = 75.2.
  const mlbTotal = register.totals.find((t) => t.label === 'MLB')
  assert.equal(mlbTotal.cells[0], 53)
  assert.equal(mlbTotal.cells[4], '75.2')
})
