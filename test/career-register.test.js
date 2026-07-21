// Regression coverage for a real bug (player id 687726, an AA -> AAA call-up on
// 2026-07-17 with exactly one AAA appearance): the "Current season" tiles are
// SUPPOSED to blend every MiLB level a player appeared at this year into one
// line (resolveCurrentSeasonStat's header comment) — but that same blended
// figure was also being reused for the Career register's current-level row,
// so the AAA row silently absorbed the AA line while a separate, correct AA
// row also existed. Locks two things: the tile/register split stays two
// different stats (resolveCurrentSeasonStat), and the register itself never
// blends two levels into one row (careerRegisterView).
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveCurrentSeasonStat } from '../src/api/loadPlayer.js'
import { careerRegisterView } from '../src/api/person.js'
import { SPORT_IDS } from '../src/lib/teams.js'

// A pitching stint's raw stat line, shaped like a statsapi split's `.stat`.
const AA_STAT = {
  gamesPlayed: 19, gamesStarted: 0, wins: 0, losses: 1, saves: 0,
  inningsPitched: '26.2', earnedRuns: 6, hits: 15, baseOnBalls: 6, strikeOuts: 39,
  era: '2.03', whip: '0.79',
}
const AAA_STAT = {
  gamesPlayed: 1, gamesStarted: 0, wins: 0, losses: 0, saves: 0,
  inningsPitched: '1.0', earnedRuns: 0, hits: 0, baseOnBalls: 0, strikeOuts: 1,
  era: '0.00', whip: '0.00',
}

// Serves fetchMilbByDateRange's 5-level fan-out: only AA (sportId 12) and AAA
// (sportId 11) have played this year, every other level comes back empty —
// same shape fetchPersonStats expects (`data.stats[0].splits`).
function mockDateRangeFetch() {
  return async (url) => {
    const sportId = Number(new URL(url).searchParams.get('sportId'))
    const stat = sportId === SPORT_IDS.AA ? AA_STAT : sportId === SPORT_IDS.AAA ? AAA_STAT : null
    const splits = stat ? [{ season: '2026', sport: { id: sportId }, team: { id: sportId * 10 }, stat }] : []
    return { ok: true, status: 200, json: async () => ({ stats: [{ splits }] }) }
  }
}

test('resolveCurrentSeasonStat: the tile blends every MiLB level, but levelOnlyStat stays scoped to just the current level', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockDateRangeFetch()
  try {
    const { stat, sportId, levelOnlyStat } = await resolveCurrentSeasonStat({
      id: 687726, group: 'pitching', season: 2026,
      startDate: '2026-01-01', endDate: '2026-07-21',
      sportId: SPORT_IDS.AAA, hasDebuted: false, levelStat: null,
    })

    assert.equal(sportId, SPORT_IDS.AAA)
    // The tile is a deliberate cross-level blend (AA's 19G/26.2IP + AAA's 1G/1.0IP).
    assert.equal(stat.gamesPlayed, 20)
    assert.equal(stat.inningsPitched, '27.2')
    // The register's current-level row must NOT get that blend — only the
    // AAA appearance belongs to the AAA row.
    assert.equal(levelOnlyStat.gamesPlayed, 1)
    assert.equal(levelOnlyStat.inningsPitched, '1.0')
    assert.equal(levelOnlyStat.era, '0.00')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('careerRegisterView: a same-season AA -> AAA promotion produces two independent rows, never a blended one', () => {
  const register = careerRegisterView({
    mlbSplits: [],
    milbSplits: [
      { season: 2026, sport: { id: SPORT_IDS.AA }, team: { id: 501 }, stat: AA_STAT },
      { season: 2026, sport: { id: SPORT_IDS.AAA }, team: { id: 502 }, stat: AAA_STAT },
    ],
    group: 'pitching',
    role: null,
    debutYear: null,
    // The register's current-level row is fed the LEVEL-ONLY stat (what
    // resolveCurrentSeasonStat's levelOnlyStat resolves to), never the
    // cross-level-blended tile.
    currentStat: AAA_STAT,
    currentSeason: 2026,
    currentSportId: SPORT_IDS.AAA,
    careerStat: null,
    warByYear: {},
    transactions: [],
  })

  const aaaRow = register.rows.find((r) => r.sportId === SPORT_IDS.AAA)
  const aaRow = register.rows.find((r) => r.sportId === SPORT_IDS.AA)
  assert.ok(aaaRow, 'expected a 2026 AAA row')
  assert.ok(aaRow, 'expected a separate 2026 AA row')

  // cells: [G, GS, W-L, ERA, IP, K, BB, WHIP] (no WAR column — no MLB row here)
  assert.equal(aaaRow.cells[0], 1, 'AAA row must show only the one AAA appearance')
  assert.equal(aaaRow.cells[4], '1.0')
  assert.equal(aaRow.cells[0], 19, 'AA row must stay the full AA-only season')
  assert.equal(aaRow.cells[4], '26.2')

  // The bug this guards against: the AAA row absorbing AA's line too
  // (gamesPlayed 20, IP '27.2' — the blended tile's own values above).
  assert.notEqual(aaaRow.cells[0], 20)
  assert.notEqual(aaaRow.cells[4], '27.2')
})
