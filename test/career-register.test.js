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

// ---------------------------------------------------------------------------
// The register shows EVERYTHING. It used to drop a small post-debut minor-league
// stint out of the table into an "Also: 4.2 IP at AAA" caption below it, and to
// fold a season split between two clubs into one row labelled with both. Both
// are gone: one row per (season, level, club), no workload threshold anywhere.
// ---------------------------------------------------------------------------

// A four-appearance AAA cameo three years after the player's debut — well under
// the rehab cap (15 outings / 30 IP) that used to banish it to the caption.
const REHAB_STAT = {
  gamesPlayed: 2, gamesStarted: 0, wins: 0, losses: 0, saves: 0,
  inningsPitched: '4.2', earnedRuns: 1, hits: 3, baseOnBalls: 1, strikeOuts: 5,
  era: '1.93', whip: '0.86',
}
const MLB_STAT = {
  gamesPlayed: 60, gamesStarted: 0, wins: 4, losses: 2, saves: 1,
  inningsPitched: '61.0', earnedRuns: 25, hits: 55, baseOnBalls: 20, strikeOuts: 70,
  era: '3.69', whip: '1.23',
}

test('careerRegisterView: a small post-debut MiLB stint is a real row, not a footnote', () => {
  const register = careerRegisterView({
    mlbSplits: [{ season: 2026, sport: { id: 1 }, team: { id: 158 }, stat: MLB_STAT }],
    milbSplits: [{ season: 2026, sport: { id: SPORT_IDS.AAA }, team: { id: 5015 }, stat: REHAB_STAT }],
    group: 'pitching',
    role: null,
    debutYear: 2023,
    currentStat: null,
    currentSeason: 2026,
    currentSportId: 1,
    careerStat: null,
    warByYear: {},
    transactions: [],
  })

  assert.equal(register.footnote, undefined, 'the register no longer emits a caption')
  const aaa = register.rows.find((r) => r.sportId === SPORT_IDS.AAA)
  assert.ok(aaa, 'the 4.2 IP AAA stint must appear as its own row')
  assert.equal(aaa.cells[4], '4.2')
  assert.equal(aaa.pill, 'AAA')
})

test('careerRegisterView: an MLB season split between two clubs is one row per club', () => {
  const bosStat = { ...MLB_STAT, gamesPlayed: 40, inningsPitched: '41.0' }
  const nyyStat = { ...MLB_STAT, gamesPlayed: 20, inningsPitched: '20.0' }
  const register = careerRegisterView({
    mlbSplits: [
      { season: 2026, sport: { id: 1 }, team: { id: 111 }, stat: bosStat },
      { season: 2026, sport: { id: 1 }, team: { id: 147 }, stat: nyyStat },
    ],
    milbSplits: [],
    group: 'pitching',
    role: null,
    debutYear: 2026,
    currentStat: null,
    currentSeason: 2026,
    currentSportId: 1,
    careerStat: null,
    // A season's WAR is not published per club: it belongs to the first row of
    // the season, and the total must count it once — never once per club.
    warByYear: { 2026: 1.8 },
    transactions: [],
  })

  assert.equal(register.rows.length, 2)
  assert.deepEqual(register.rows.map((r) => r.teamIds), [[111], [147]])
  assert.deepEqual(register.rows.map((r) => r.year), ['2026', '2026'])
  // cells: [G, GS, W-L, ERA, IP, K, BB, WHIP, WAR]
  assert.deepEqual(register.rows.map((r) => r.cells[8]), ['1.8', '—'])
  const mlbTotal = register.totals.find((t) => t.label === 'MLB')
  assert.equal(mlbTotal.cells[0], 60, 'the two clubs foot to the whole season')
  assert.equal(mlbTotal.cells[8], '1.8', 'season WAR counted once, not twice')
  // Distinct row keys, or React collapses the second club's line.
  assert.equal(new Set(register.rows.map((r) => r.key)).size, 2)
})

test('careerRegisterView: a subtotal appears only when its side has more than one row', () => {
  const oneEach = careerRegisterView({
    mlbSplits: [{ season: 2026, sport: { id: 1 }, team: { id: 158 }, stat: MLB_STAT }],
    milbSplits: [{ season: 2022, sport: { id: SPORT_IDS.AAA }, team: { id: 5015 }, stat: REHAB_STAT }],
    group: 'pitching',
    role: null,
    debutYear: 2023,
    currentStat: null,
    currentSeason: 2026,
    currentSportId: 1,
    careerStat: null,
    warByYear: {},
    transactions: [],
  })
  // One MLB line and one MiLB line: each foots itself, so neither gets a footer
  // that would just restate it.
  assert.deepEqual(oneEach.totals, [])

  const twoLevels = careerRegisterView({
    mlbSplits: [{ season: 2026, sport: { id: 1 }, team: { id: 158 }, stat: MLB_STAT }],
    milbSplits: [
      { season: 2022, sport: { id: SPORT_IDS.AAA }, team: { id: 5015 }, stat: REHAB_STAT },
      { season: 2021, sport: { id: SPORT_IDS.AA }, team: { id: 5016 }, stat: AA_STAT },
    ],
    group: 'pitching',
    role: null,
    debutYear: 2023,
    currentStat: null,
    currentSeason: 2026,
    currentSportId: 1,
    careerStat: null,
    warByYear: {},
    transactions: [],
  })
  assert.deepEqual(twoLevels.totals.map((t) => t.label), ['MiLB'])
  // 2 G (AAA) + 19 G (AA), and 4.2 + 26.2 innings.
  const milb = twoLevels.totals[0]
  assert.equal(milb.cells[0], 21)
  assert.equal(milb.cells[4], '31.1')
})

test('careerRegisterView: the current season splits per club from the date-cut splits', () => {
  // What buildBlock hands in for a player traded this year: the raw, date-cut
  // per-club rows. The register must use THOSE (they can't move mid-game), not
  // the live year-by-year line, and must still split them per club.
  const register = careerRegisterView({
    mlbSplits: [
      { season: 2026, sport: { id: 1 }, team: { id: 111 }, stat: { ...MLB_STAT, gamesPlayed: 44 } },
      { season: 2026, sport: { id: 1 }, team: { id: 147 }, stat: { ...MLB_STAT, gamesPlayed: 22 } },
    ],
    milbSplits: [],
    group: 'pitching',
    role: null,
    debutYear: 2026,
    currentStat: { ...MLB_STAT, gamesPlayed: 60 },
    currentSplits: [
      { season: 2026, sport: { id: 1 }, team: { id: 111 }, stat: { ...MLB_STAT, gamesPlayed: 40 } },
      { season: 2026, sport: { id: 1 }, team: { id: 147 }, stat: { ...MLB_STAT, gamesPlayed: 20 } },
    ],
    currentSeason: 2026,
    currentSportId: 1,
    careerStat: null,
    warByYear: {},
    transactions: [],
  })

  assert.deepEqual(register.rows.map((r) => r.cells[0]), [40, 20], 'the date-cut figures, per club')
})

test('careerRegisterView: with no date-cut splits the current season collapses to one row that keeps its clubs', () => {
  const register = careerRegisterView({
    mlbSplits: [
      { season: 2026, sport: { id: 1 }, team: { id: 111 }, stat: { ...MLB_STAT, gamesPlayed: 44 } },
      { season: 2026, sport: { id: 1 }, team: { id: 147 }, stat: { ...MLB_STAT, gamesPlayed: 22 } },
    ],
    milbSplits: [],
    group: 'pitching',
    role: null,
    debutYear: 2026,
    currentStat: { ...MLB_STAT, gamesPlayed: 55 },
    currentSplits: [],
    currentSeason: 2026,
    currentSportId: 1,
    careerStat: null,
    warByYear: {},
    transactions: [],
  })

  assert.equal(register.rows.length, 1)
  assert.equal(register.rows[0].cells[0], 55, 'still the date-cut stat, never the live line')
  assert.deepEqual(register.rows[0].teamIds, [111, 147], 'the clubs survive the collapse')
})
