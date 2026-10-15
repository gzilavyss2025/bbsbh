import test from 'node:test'
import assert from 'node:assert/strict'
import { OTHER_LEAGUE, gbText, hasDroughts, scoreCard, standingsCount } from '../src/screens/team/next/standings/standingsData.js'

// The Standings band's team score card and jump-bar count (#1107, row 5b): pure shapes over the
// standings the page already fetched. No season grade anywhere. Offline.

// One standings team row as the feed shapes it.
const row = (id, wins, losses, rs, ra, over = {}) => ({
  team: { id },
  wins,
  losses,
  runsScored: rs,
  runsAllowed: ra,
  runDifferential: rs - ra,
  leagueRecord: { pct: (wins / (wins + losses)).toFixed(3).replace(/^0/, '') },
  ...over,
})
const division = (id, teamRecords) => ({ division: { id }, teamRecords })

const mlbTeam = { id: 1, sport: { id: 1 }, division: { id: 10 }, league: { id: 103 } }
// 15 clubs in each league, ids 1..30: club 1 is best on pct and RD, club 30 worst.
const league = (from) => [division(from === 1 ? 10 : from, Array.from({ length: 15 }, (_, i) => row(from + i, 100 - from - i, 60 + from + i, 800 - (from + i), 600 + (from + i), { sportRank: from + i })))]
const own = league(1)
const other = league(16)

test('OTHER_LEAGUE maps the two MLB leagues to each other', () => {
  assert.deepEqual(OTHER_LEAGUE, { 103: 104, 104: 103 })
})

test('scoreCard MLB: rank among 30 from sportRank, four parts ranked across both leagues', () => {
  const c = scoreCard(own, other, mlbTeam)
  assert.equal(c.col, 'MLB')
  assert.equal(c.label, 'MLB rank')
  assert.deepEqual(c.rank, { rank: 1, of: 30 })
  assert.deepEqual(c.strip, { n: 30, at: 0 })
  assert.deepEqual(c.rows.map((r) => r.part), ['Run diff', 'Win pct', 'Runs allowed', 'Runs scored'])
  assert.deepEqual(c.rows.map((r) => r.value), ['+198', '.619', '601', '799'])
  // Run diff and win pct read "1 of 30"; the counts read "1st".
  assert.deepEqual(c.rows.map((r) => r.rank), [{ rank: 1, of: 30 }, { rank: 1, of: 30 }, { rank: 1 }, { rank: 1 }])
})

test('scoreCard MLB: fewer runs allowed ranks better; a tie shares the rank', () => {
  const o = league(16)
  o[0].teamRecords[0] = row(16, 80, 80, 700, 601) // ties club 1's 601 allowed
  const c = scoreCard(own, o, mlbTeam)
  assert.deepEqual(c.rows[2].rank, { rank: 1 })
  const worse = league(1)
  worse[0].teamRecords[1] = row(2, 99, 61, 799, 599) // fewer allowed than club 1
  assert.deepEqual(scoreCard(worse, other, mlbTeam).rows[2].rank, { rank: 2 })
})

test('scoreCard MLB: the other league empty draws no rank for a part, never a wrong one', () => {
  const c = scoreCard(own, [], mlbTeam)
  assert.deepEqual(c.rank, { rank: 1, of: 30 })
  assert.ok(c.rows.every((r) => r.rank === null))
  assert.equal(c.rows[0].value, '+198')
})

test('scoreCard other clubs: division rank, one cell per division club, column Div', () => {
  const aaa = { id: 3, sport: { id: 11 }, division: { id: 7 }, league: { id: 117 } }
  const d = division(7, [
    row(1, 70, 50, 500, 400, { divisionRank: '1' }),
    row(2, 60, 60, 450, 450, { divisionRank: '2' }),
    row(3, 50, 70, 400, 500, { divisionRank: '3' }),
  ])
  const c = scoreCard([d], null, aaa)
  assert.equal(c.col, 'Div')
  assert.equal(c.label, 'Division rank')
  assert.deepEqual(c.rank, { rank: 3, of: 3 })
  assert.deepEqual(c.strip, { n: 3, at: 2 })
  assert.deepEqual(c.rows[0].rank, { rank: 3, of: 3 })
  assert.equal(c.rows[0].value, '-100')
})

test('scoreCard: a club with no division ranks in its league and says so', () => {
  const winter = { id: 4, sport: { id: 17 }, league: { id: 9 } }
  const c = scoreCard([{ teamRecords: [row(4, 1, 0, 3, 1, { leagueRank: '1' }), row(5, 0, 1, 1, 3, { leagueRank: '2' })] }], null, winter)
  assert.equal(c.label, 'League rank')
  assert.equal(c.col, 'League')
  assert.deepEqual(c.rank, { rank: 1, of: 2 })
})

test('scoreCard: no row for the club, or a pool of one, is no card; no grade key ever', () => {
  assert.equal(scoreCard([], null, mlbTeam), null)
  const solo = { id: 9, sport: { id: 14 }, division: { id: 5 } }
  assert.equal(scoreCard([division(5, [row(9, 1, 0, 3, 2, { divisionRank: '1' })])], null, solo), null)
  assert.ok(!JSON.stringify(scoreCard(own, other, mlbTeam)).toLowerCase().includes('grade'))
})

test('standingsCount: one per card the band draws', () => {
  const full = { standings: [1, 2], teamRecords: {}, scheduleShape: null, dayOfWeek: [1], comeback: {} }
  assert.equal(standingsCount(full), 5)
  assert.equal(standingsCount({ standings: [1], teamRecords: null, dayOfWeek: null, comeback: null }), 1)
  assert.equal(standingsCount({ standings: [], teamRecords: null, dayOfWeek: null, comeback: null }), 0)
})

test('hasDroughts: a schedule shape with nothing to report draws no Last time card', () => {
  assert.equal(hasDroughts({ scheduleShape: null }), false)
  assert.equal(hasDroughts({ scheduleShape: { games: [] } }, null), false)
})

test('gbText: a negative games-back (a winter leader) reads as a dash, the rest is untouched', () => {
  assert.equal(gbText('-1.0'), '—')
  assert.equal(gbText('-'), '-')
  assert.equal(gbText('3.5'), '3.5')
})
