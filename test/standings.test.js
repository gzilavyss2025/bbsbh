import assert from 'node:assert/strict'
import test from 'node:test'
import {
  shapeStandings,
  shapeWildCard,
  expectedRecord,
  formatMagicNumber,
  clinchMark,
  clinchLabel,
  clinchMarksInPlay,
  CLINCH_ORDER,
  attachTeamField,
  extractRanks,
  rankTrend,
  attachRankTrend,
  DASH,
} from '../src/api/standings.js'

test('expectedRecord prefers the feed\'s own xWinLoss expected record', () => {
  const t = {
    wins: 53,
    losses: 47,
    records: { expectedRecords: [{ type: 'xWinLoss', wins: 53, losses: 47 }] },
  }
  assert.equal(expectedRecord(t), '53-47')
})

test('expectedRecord falls back to a Pythagorean split over games played so far when expectedRecords is absent', () => {
  const t = { wins: 10, losses: 5, runsScored: 80, runsAllowed: 50 }
  const pace = expectedRecord(t)
  assert.match(pace, /^\d+-\d+$/)
  const [xWins, xLosses] = pace.split('-').map(Number)
  assert.equal(xWins + xLosses, 15) // games played
  assert.ok(xWins > xLosses) // more runs scored than allowed should favor the winning side
})

test('expectedRecord is DASH with no games played or no runs data', () => {
  assert.equal(expectedRecord({}), DASH)
  assert.equal(expectedRecord({ wins: 0, losses: 0 }), DASH)
})

test('formatMagicNumber reads the division leader\'s magicNumber', () => {
  assert.equal(formatMagicNumber({ clinched: false, magicNumber: '61' }), '61')
})

test('formatMagicNumber reports Clinched for a club that has WON the division', () => {
  assert.equal(formatMagicNumber({ clinched: true, divisionChamp: true, magicNumber: '5' }), 'Clinched')
  assert.equal(formatMagicNumber({ clinched: true, clinchIndicator: 'y' }), 'Clinched')
  assert.equal(formatMagicNumber({ clinched: true, clinchIndicator: 'z' }), 'Clinched')
})

// `clinched: true` means a POSTSEASON BERTH, not the division. A wild-card club
// carries it while it still sits behind a division leader, and reading it as a
// division clinch printed "Clinched" in the division Magic# column against a
// club that was five games from being eliminated FROM that division (the real
// 2025 Yankees record on Sep 23, reproduced below).
test('formatMagicNumber never reports Clinched for a berth-only (wild card) club', () => {
  const wildCardClub = {
    clinched: true,
    clinchIndicator: 'x',
    divisionLeader: false,
    divisionChamp: false,
    wildCardLeader: true,
    eliminationNumberDivision: '5',
  }
  assert.equal(formatMagicNumber(wildCardClub), DASH)
})

test('formatMagicNumber is DASH for a non-leader (no magicNumber key on the feed)', () => {
  assert.equal(formatMagicNumber({ clinched: false, eliminationNumberDivision: '61' }), DASH)
})

// Every fixture below is a real /standings teamRecord, trimmed to the clinch
// fields — the dates named are the pulls they were copied from, so a feed
// change shows up here as a failing test rather than a quiet wrong badge.

test('clinchMark reads the indicator the feed ships, for each of MLB four letters', () => {
  assert.equal(clinchMark({ clinchIndicator: 'z', clinched: true, divisionChamp: true }), 'z')
  assert.equal(clinchMark({ clinchIndicator: 'y', clinched: true, divisionChamp: true }), 'y')
  assert.equal(clinchMark({ clinchIndicator: 'x', clinched: true, divisionChamp: false }), 'x')
  assert.equal(clinchMark({ clinchIndicator: 'w', clinched: true, divisionChamp: false }), 'w')
})

test('clinchMark is null for a club still simply playing', () => {
  // 2026 Braves, Sep 15: division leader, magic number 5, nothing settled.
  const braves = {
    clinched: false,
    divisionLeader: true,
    divisionChamp: false,
    magicNumber: '5',
    eliminationNumberDivision: '-',
    wildCardEliminationNumber: '-',
  }
  assert.equal(clinchMark(braves), null)
})

test('clinchMark derives the letter the feed omits from the booleans beside it', () => {
  assert.equal(clinchMark({ divisionChamp: true, clinched: true }), 'y')
  assert.equal(clinchMark({ divisionChamp: false, clinched: true }), 'x')
})

test('clinchMark marks a club eliminated only when BOTH races are gone', () => {
  // 2026 Nationals, Sep 15 — out of the division and out of the wild card.
  const nationals = {
    clinched: false,
    eliminationNumberDivision: 'E',
    wildCardEliminationNumber: 'E',
  }
  assert.equal(clinchMark(nationals), 'e')
})

test('clinchMark leaves a club alive in the wild card unmarked, though its division is gone', () => {
  // 2026 Marlins, Sep 15: division 'E', wild card still 3 away. Reading the
  // division number alone would retire a club that is still playing for a spot.
  const marlins = {
    clinched: false,
    eliminationNumberDivision: 'E',
    wildCardEliminationNumber: '3',
  }
  assert.equal(clinchMark(marlins), null)
})

test('clinchMark never marks a clinched club eliminated', () => {
  // 2025 Red Sox, final: clinched a wild card, yet every elimination number on
  // the record reads 'E' because the division and the league race are over.
  const redSox = {
    clinchIndicator: 'w',
    clinched: true,
    eliminationNumberDivision: 'E',
    wildCardEliminationNumber: '-',
  }
  assert.equal(clinchMark(redSox), 'w')
  // Same club with the indicator stripped: still a berth, never an elimination.
  assert.equal(clinchMark({ ...redSox, clinchIndicator: undefined }), 'x')
})

test('clinchMark is null on a thin feed that carries no clinch fields at all', () => {
  assert.equal(clinchMark({}), null)
  assert.equal(clinchMark({ wins: 10, losses: 5 }), null)
})

test('clinchLabel names every mark in CLINCH_ORDER and nothing else', () => {
  for (const mark of CLINCH_ORDER) assert.ok(clinchLabel(mark).length > 0, mark)
  assert.equal(clinchLabel('q'), '')
  assert.equal(clinchLabel(null), '')
})

test('clinchMarksInPlay collects marks from a Division-shaped tree', () => {
  const leagues = [
    { id: 103, divisions: [{ id: 201, teams: [{ clinch: 'y' }, { clinch: 'e' }, { clinch: null }] }] },
  ]
  assert.deepEqual([...clinchMarksInPlay(leagues)].sort(), ['e', 'y'])
})

test('clinchMarksInPlay collects marks from a Wild-Card-shaped tree', () => {
  const leagues = [{ id: 103, leaders: [{ clinch: 'z' }], wildcard: [{ clinch: 'w' }, { clinch: null }] }]
  assert.deepEqual([...clinchMarksInPlay(leagues)].sort(), ['w', 'z'])
})

test('clinchMarksInPlay is empty for a board where nothing has been settled', () => {
  const leagues = [{ id: 103, divisions: [{ id: 201, teams: [{ clinch: null }, { clinch: null }] }] }]
  assert.equal(clinchMarksInPlay(leagues).size, 0)
})

// A raw /standings-shaped fixture: one league, one division, two teams — just
// enough for shapeStandings/shapeWildCard to exercise the Pace/Magic# wiring
// end to end (not re-testing shapeTeam's existing fields).
function rawRecords() {
  return [
    {
      league: { id: 103 },
      division: { id: 201, name: 'American League East' },
      teamRecords: [
        {
          team: { id: 1, name: 'Yankees' },
          divisionRank: '1',
          wins: 60,
          losses: 40,
          winningPercentage: '.600',
          gamesBack: '-',
          runsScored: 500,
          runsAllowed: 400,
          runDifferential: 100,
          streak: { streakCode: 'W3' },
          records: {
            splitRecords: [
              { type: 'home', wins: 30, losses: 20 },
              { type: 'away', wins: 30, losses: 20 },
              { type: 'lastTen', wins: 7, losses: 3 },
            ],
            expectedRecords: [{ type: 'xWinLoss', wins: 58, losses: 42 }],
          },
          magicNumber: '20',
          clinched: false,
          divisionLeader: true,
        },
        {
          team: { id: 2, name: 'Orioles' },
          divisionRank: '2',
          wins: 50,
          losses: 50,
          winningPercentage: '.500',
          gamesBack: '10.0',
          runsScored: 420,
          runsAllowed: 420,
          runDifferential: 0,
          streak: { streakCode: 'L1' },
          records: { splitRecords: [] },
          eliminationNumberDivision: '52',
          clinched: false,
          divisionLeader: false,
        },
      ],
    },
  ]
}

test('shapeStandings threads the expected record and magic onto the division leader', () => {
  const [lg] = shapeStandings(rawRecords())
  const [leader, second] = lg.divisions[0].teams
  assert.equal(leader.expWL, '58-42')
  assert.equal(leader.magic, '20')
  assert.equal(second.magic, DASH)
})

test('shapeStandings threads a clinch mark onto every row, both boards', () => {
  const records = rawRecords()
  records[0].teamRecords[0].clinchIndicator = 'y'
  records[0].teamRecords[0].clinched = true
  records[0].teamRecords[0].divisionChamp = true
  records[0].teamRecords[1].eliminationNumberDivision = 'E'
  records[0].teamRecords[1].wildCardEliminationNumber = 'E'

  const [division] = shapeStandings(records)
  const [leader, second] = division.divisions[0].teams
  assert.equal(leader.clinch, 'y')
  assert.equal(leader.magic, 'Clinched')
  assert.equal(second.clinch, 'e')

  const [wc] = shapeWildCard(records)
  assert.equal(wc.leaders[0].clinch, 'y')
  assert.equal(wc.wildcard[0].clinch, 'e')
})

test('shapeWildCard threads the expected record but never a magic number (division-board-only feature)', () => {
  const [lg] = shapeWildCard(rawRecords())
  assert.equal(lg.leaders[0].expWL, '58-42')
})

test('attachTeamField stamps a value by team id onto a Division-shaped tree', () => {
  const leagues = [{ id: 103, divisions: [{ id: 201, teams: [{ id: 100 }, { id: 101 }] }] }]
  attachTeamField(leagues, new Map([[100, 7.2]]), 'grade')
  assert.equal(leagues[0].divisions[0].teams[0].grade, 7.2)
  assert.equal(leagues[0].divisions[0].teams[1].grade, null)
})

test('attachTeamField stamps a value by team id onto a Wild-Card-shaped tree', () => {
  const leagues = [{ id: 103, leaders: [{ id: 200 }], wildcard: [{ id: 201 }] }]
  attachTeamField(leagues, new Map([[201, 6.5]]), 'grade')
  assert.equal(leagues[0].leaders[0].grade, null)
  assert.equal(leagues[0].wildcard[0].grade, 6.5)
})

test('extractRanks reads division rank in division mode', () => {
  const leagues = [{ id: 103, divisions: [{ id: 201, teams: [{ id: 1, rank: '1' }, { id: 2, rank: '2' }] }] }]
  const ranks = extractRanks(leagues, 'division')
  assert.equal(ranks.get(1), 1)
  assert.equal(ranks.get(2), 2)
})

test('extractRanks reads pooled wcRank in wildcard mode, skipping division leaders (no wcRank)', () => {
  const leagues = [{ id: 103, leaders: [{ id: 200 }], wildcard: [{ id: 201, wcRank: 1 }, { id: 202, wcRank: 2 }] }]
  const ranks = extractRanks(leagues, 'wildcard')
  assert.equal(ranks.has(200), false)
  assert.equal(ranks.get(201), 1)
  assert.equal(ranks.get(202), 2)
})

test('rankTrend compares lower-is-better ranks', () => {
  assert.equal(rankTrend(1, 2), 'up') // moved from 2nd to 1st
  assert.equal(rankTrend(3, 2), 'down') // moved from 2nd to 3rd
  assert.equal(rankTrend(2, 2), 'flat')
  assert.equal(rankTrend(1, undefined), null)
  assert.equal(rankTrend(undefined, 1), null)
})

test('attachRankTrend sets trend on every team from a previous-snapshot rank map', () => {
  const leagues = [
    { id: 103, divisions: [{ id: 201, teams: [{ id: 1, rank: '1' }, { id: 2, rank: '2' }, { id: 3, rank: '3' }] }] },
  ]
  const prevRanks = new Map([[1, 2], [2, 2], [3, 1]]) // team 1 climbed, team 2 held, team 3 fell
  attachRankTrend(leagues, 'division', prevRanks)
  const [t1, t2, t3] = leagues[0].divisions[0].teams
  assert.equal(t1.trend, 'up') // 2 -> 1
  assert.equal(t2.trend, 'flat') // 2 -> 2
  assert.equal(t3.trend, 'down') // 1 -> 3
})

test('attachRankTrend is null for a team missing from the previous snapshot', () => {
  const leagues = [{ id: 103, divisions: [{ id: 201, teams: [{ id: 9, rank: '1' }] }] }]
  attachRankTrend(leagues, 'division', new Map())
  assert.equal(leagues[0].divisions[0].teams[0].trend, null)
})
