// THE FORMER TEAMMATES GENERATOR'S DECISIONS (issue #1171) — the card was empty
// all offseason because the generator never looked at winter ball. These pin
// what the winter change must and must not do: winter games get a shard, a
// winter stint never makes two players teammates, org ties stay off for a
// winter club, and no shard can grow past the hot-path ceiling.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CAREER_SPORT_IDS,
  MATCHUP_SPORT_IDS,
  MAX_ROWS_PER_MATCHUP,
  capRows,
  careerRequests,
  historicalParentOrgAt,
  isShippedGame,
  orgIdForShared,
  orgTiesApply,
  reduceCareer,
} from '../scripts/lib/former-teammates.mjs'

const game = (leagueId) => ({ teams: { home: { team: { id: 1, league: { id: leagueId } } } } })

test('the matchup sweep includes winter ball', () => {
  assert.ok(MATCHUP_SPORT_IDS.includes(17))
  for (const id of [1, 11, 12, 13, 14]) assert.ok(MATCHUP_SPORT_IDS.includes(id))
  assert.ok(!MATCHUP_SPORT_IDS.includes(16), 'rookie ball stays out')
})

test('a winter game ships only from the four winter leagues', () => {
  for (const leagueId of [119, 132, 135, 131]) assert.equal(isShippedGame(17, game(leagueId)), true)
  // Liga Roberto Clemente and the Australian league come back from sportId 17
  // but do not ship (src/lib/winter/leagues.js).
  assert.equal(isShippedGame(17, game(133)), false)
  assert.equal(isShippedGame(17, game(595)), false)
  assert.equal(isShippedGame(17, { teams: { home: { team: { id: 1 } } } }), false)
  // No league filter at the other levels.
  assert.equal(isShippedGame(1, game(104)), true)
  assert.equal(isShippedGame(12, { teams: {} }), true)
})

test('a career is never requested from winter ball', () => {
  assert.ok(!CAREER_SPORT_IDS.includes(17))
  assert.ok(careerRequests().every((r) => r.sportId !== 17))
  assert.equal(careerRequests().length, 2 * CAREER_SPORT_IDS.length)
})

test('a winter stint never enters the pair set, whatever request returns it', () => {
  const split = (sportId, teamId, season, gamesPlayed = 30) => ({
    season: String(season),
    team: { id: teamId, name: `Club ${teamId}` },
    sport: { id: sportId },
    stat: { gamesPlayed },
  })
  const career = reduceCareer(
    [
      { request: { group: 'hitting', sportId: 12 }, splits: [split(12, 4124, 2025, 90)] },
      // A winter split, even under a career-level request.
      { request: { group: 'hitting', sportId: 1 }, splits: [split(17, 542, 2025)] },
      { request: { group: 'hitting', sportId: 17 }, splits: [split(17, 670, 2024)] },
      null,
    ],
    null,
  )
  assert.deepEqual([...career.pairs], ['4124|2025'])
  assert.equal(career.clubs.get(4124).level, 'AA')
  assert.equal(career.games.get('4124|2025'), 90)
  assert.ok(!career.clubs.has(542) && !career.clubs.has(670))
})

test('the reduction keeps both clubs of a trade and drops a rehab cameo', () => {
  const career = reduceCareer(
    [
      {
        request: { group: 'hitting', sportId: 1 },
        splits: [
          { season: '2023', team: { id: 158, name: 'Milwaukee Brewers' }, sport: { id: 1 }, stat: { gamesPlayed: 60 } },
          { season: '2023', team: { id: 147, name: 'New York Yankees' }, sport: { id: 1 }, stat: { gamesPlayed: 40 } },
          { season: '2023', stat: { gamesPlayed: 100 } }, // the team-less trade aggregate
        ],
      },
      {
        request: { group: 'hitting', sportId: 11 },
        // Post-debut, three games at Triple-A: rehab, not a season.
        splits: [{ season: '2024', team: { id: 556, name: 'Nashville Sounds' }, sport: { id: 11 }, stat: { gamesPlayed: 3 } }],
      },
    ],
    2020,
  )
  assert.deepEqual([...career.pairs].sort(), ['147|2023', '158|2023'])
})

test('org ties are off whenever either club is a winter club', () => {
  assert.equal(orgTiesApply(11, 12), true)
  assert.equal(orgTiesApply(1, 11), true)
  assert.equal(orgTiesApply(17, 17), false)
  assert.equal(orgTiesApply(17, 11), false)
  assert.equal(orgTiesApply(1, 17), false)
})

test('a shard keeps only the top rows by score', () => {
  const rows = Array.from({ length: 170 }, (_, i) => ({ score: (i * 37) % 170 }))
  const capped = capRows(rows)
  assert.equal(capped.length, MAX_ROWS_PER_MATCHUP)
  assert.equal(capped[0].score, 169)
  assert.equal(capped.at(-1).score, 170 - MAX_ROWS_PER_MATCHUP)
  assert.equal(rows.length, 170, 'the input is not changed')
  assert.equal(capRows(rows.slice(0, 5)).length, 5)
  // The card shows five before "show all"; the cap must sit well above that.
  assert.ok(MAX_ROWS_PER_MATCHUP >= 50)
})

// Each `shared` club entry carries `orgId`, its season-accurate parent org.
// Fixture copied from public/data/milb-history.json: Scranton/Wilkes-Barre was
// a Phillies club through 2006 and a Yankees club from 2007.
const history = {
  clubs: {
    531: {
      parentHistory: [
        { years: [2005, 2006], parentOrgId: 143, parentOrgName: 'Philadelphia Phillies' },
        { years: [2007, 2026], parentOrgId: 147, parentOrgName: 'New York Yankees' },
      ],
    },
    533: {}, // Worcester: the file has no parentHistory for it
  },
}
const orgOf = (teamId, season) => historicalParentOrgAt(history, teamId, season)?.id

test('historicalParentOrgAt reads the era that holds the season', () => {
  assert.deepEqual(historicalParentOrgAt(history, 531, 2006), { id: 143, name: 'Philadelphia Phillies' })
  assert.deepEqual(historicalParentOrgAt(history, 531, 2007), { id: 147, name: 'New York Yankees' })
})

test('historicalParentOrgAt is null for a club or season the file does not cover', () => {
  assert.equal(historicalParentOrgAt(history, 531, 2004), null)
  assert.equal(historicalParentOrgAt(history, 533, 2019), null)
  assert.equal(historicalParentOrgAt(history, 999, 2019), null)
  assert.equal(historicalParentOrgAt({}, 531, 2019), null)
})

test('an MLB club is its own org', () => {
  assert.equal(orgIdForShared(111, 'MLB', [2019, 2020], orgOf), 111)
})

test('a minor-league club maps to the parent for the stint’s own season', () => {
  assert.equal(orgIdForShared(531, 'AAA', [2005], orgOf), 143)
  assert.equal(orgIdForShared(531, 'AAA', [2015], orgOf), 147)
})

test('a club with several shared seasons takes the parent of its LATEST season', () => {
  assert.equal(orgIdForShared(531, 'AAA', [2006, 2008], orgOf), 147)
  assert.equal(orgIdForShared(531, 'AAA', [2008, 2006], orgOf), 147, 'input order does not matter')
})

test('a missing lookup writes no orgId', () => {
  assert.equal(orgIdForShared(533, 'AAA', [2019], orgOf), undefined)
  assert.equal(orgIdForShared(531, 'AAA', [2001], orgOf), undefined)
})
