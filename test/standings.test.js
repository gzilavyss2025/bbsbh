import assert from 'node:assert/strict'
import test from 'node:test'
import {
  shapeStandings,
  shapeWildCard,
  expectedPace,
  formatMagicNumber,
  attachTeamField,
  extractRanks,
  rankTrend,
  attachRankTrend,
  DASH,
} from '../src/api/standings.js'

test('expectedPace prefers the feed\'s own xWinLoss expected record', () => {
  const t = {
    wins: 53,
    losses: 47,
    records: { expectedRecords: [{ type: 'xWinLoss', wins: 53, losses: 47 }] },
  }
  assert.equal(expectedPace(t), '53-47')
})

test('expectedPace falls back to a Pythagorean split over games played so far when expectedRecords is absent', () => {
  const t = { wins: 10, losses: 5, runsScored: 80, runsAllowed: 50 }
  const pace = expectedPace(t)
  assert.match(pace, /^\d+-\d+$/)
  const [xWins, xLosses] = pace.split('-').map(Number)
  assert.equal(xWins + xLosses, 15) // games played
  assert.ok(xWins > xLosses) // more runs scored than allowed should favor the winning side
})

test('expectedPace is DASH with no games played or no runs data', () => {
  assert.equal(expectedPace({}), DASH)
  assert.equal(expectedPace({ wins: 0, losses: 0 }), DASH)
})

test('formatMagicNumber reads the division leader\'s magicNumber', () => {
  assert.equal(formatMagicNumber({ clinched: false, magicNumber: '61' }), '61')
})

test('formatMagicNumber reports Clinched regardless of the numeric fields', () => {
  assert.equal(formatMagicNumber({ clinched: true, magicNumber: '5' }), 'Clinched')
})

test('formatMagicNumber is DASH for a non-leader (no magicNumber key on the feed)', () => {
  assert.equal(formatMagicNumber({ clinched: false, eliminationNumberDivision: '61' }), DASH)
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

test('shapeStandings threads pace and magic onto the division leader', () => {
  const [lg] = shapeStandings(rawRecords())
  const [leader, second] = lg.divisions[0].teams
  assert.equal(leader.pace, '58-42')
  assert.equal(leader.magic, '20')
  assert.equal(second.magic, DASH)
})

test('shapeWildCard threads pace but never a magic number (division-board-only feature)', () => {
  const [lg] = shapeWildCard(rawRecords())
  assert.equal(lg.leaders[0].pace, '58-42')
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
