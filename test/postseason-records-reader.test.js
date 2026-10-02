// The postseason reader (src/api/postseason/records.js) and the three places
// the shared situational-record code learned about a postseason ledger
// (`data.postseason` in teamRecordsFor and buildRankingIndex). The tally itself
// is pinned in test/team-records.test.js and the pivot in
// test/situational-record-rankings.test.js; only what is new is tested here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { entriesFrom, gameRowsFor, resolveSeason, resolveMinGames, teamRankRows, ALL_SEASONS, MIN_GAMES } from '../src/api/postseason/records.js'
import { teamRecordsFor } from '../src/api/teamRecords.js'
import { buildRankingIndex, rankMetric } from '../src/api/situationalRecordRankings.js'

const game = (over) => ({ d: '2025-10-01', o: 10, r: 'W', rs: 4, ra: 2, hi: 9, ha: 7, ...over })
const club = (teamId, games) => ({ teamId, leagueId: 103, games })
const file = (season, ...clubs) => ({ season, clubs: Object.fromEntries(clubs.map((c) => [c.teamId, c])) })
const teams = [
  { id: 1, name: 'Alphas' },
  { id: 2, name: 'Betas' },
  { id: 3, name: 'Gammas' }, // never made the postseason
]

// ---------------------------------------------------------------------------
// resolveSeason
// ---------------------------------------------------------------------------

test('a season param is a year on file, all, or the latest', () => {
  const seasons = [2023, 2024, 2025]
  assert.equal(resolveSeason('2024', seasons), 2024)
  assert.equal(resolveSeason(ALL_SEASONS, seasons), ALL_SEASONS)
  assert.equal(resolveSeason(undefined, seasons), 2025)
  assert.equal(resolveSeason('1990', seasons), 2025) // before the data
  assert.equal(resolveSeason('banana', seasons), 2025)
  assert.equal(resolveSeason('2025', []), null)
})

// ---------------------------------------------------------------------------
// entriesFrom
// ---------------------------------------------------------------------------

test('clubs with no postseason game are absent, not blank rows', () => {
  const out = entriesFrom(teams, [file(2025, club(1, [game()]))])
  assert.deepEqual(out.map((e) => e.team.id), [1])
  assert.equal(out[0].data.postseason, true)
  assert.equal(out[0].data.sportId, 1)
})

test('all seasons merge per club in season order', () => {
  const out = entriesFrom(teams, [
    file(2024, club(1, [game({ d: '2024-10-02' })]), club(2, [game({ d: '2024-10-03' })])),
    file(2025, club(1, [game({ d: '2025-10-01' })])),
  ])
  assert.deepEqual(out.map((e) => e.team.id), [1, 2])
  assert.deepEqual(out[0].data.games.map((g) => g.d), ['2024-10-02', '2025-10-01'])
})

test('a missing season file (a failed fetch) is skipped, not fatal', () => {
  const out = entriesFrom(teams, [null, file(2025, club(1, [game()]))])
  assert.equal(out.length, 1)
})

// ---------------------------------------------------------------------------
// The postseason switch in the shared code
// ---------------------------------------------------------------------------

const ps = (games) => ({ teamId: 1, sportId: 1, postseason: true, allStarDate: null, games })

test('a postseason ledger has no by-month table and no division table', () => {
  const out = teamRecordsFor(ps([game(), game({ d: '2025-10-02' })]))
  const titles = out.groups.map((g) => g.title)
  assert.equal(titles.includes('By month'), false)
  assert.equal(titles.includes('By division'), false)
})

test('the league line is each game’s own interleague flag', () => {
  const out = teamRecordsFor(ps([game(), game({ r: 'L' }), game({ il: 1 }), game({ il: 1 }), game({ il: 1, r: 'L' })]))
  const rows = out.groups.find((g) => g.title === 'By league').rows
  assert.deepEqual(rows.map((r) => [r.id, r.v]), [['vs-own-league', '1-1'], ['vs-other-league', '2-1']])
})

test('a club that only met its own league has no other-league row', () => {
  const rows = teamRecordsFor(ps([game()])).groups.find((g) => g.title === 'By league').rows
  assert.deepEqual(rows.map((r) => r.id), ['vs-own-league'])
})

test('a regular-season ledger is untouched by the switch', () => {
  const out = teamRecordsFor({ teamId: 1, sportId: 1, games: [game({ il: 1 })], opponents: {}, names: {} })
  assert.ok(out.groups.some((g) => g.title === 'By month'))
  assert.equal(out.groups.some((g) => g.title === 'By league'), false)
})

test('the pivot offers no season counts for a postseason ledger', () => {
  const index = buildRankingIndex(entriesFrom(teams, [file(2025, club(1, [game()]))]))
  assert.equal(index.groups.some((g) => g.title === 'Season counts'), false)
  assert.equal(index.metrics.has('count-win-streak'), false)
})

// ---------------------------------------------------------------------------
// The team view
// ---------------------------------------------------------------------------

test('a club’s rows carry its rank among the clubs that played the split', () => {
  const index = buildRankingIndex(
    entriesFrom(teams, [
      file(
        2025,
        club(1, [game({ rs: 5 }), game({ rs: 5, r: 'L' })]),
        club(2, [game({ rs: 5 }), game({ rs: 5 })]),
      ),
    ]),
  )
  const groups = teamRankRows(index, 1)
  const row = groups.flatMap((g) => g.rows).find((r) => r.id === 'scored-4-plus')
  assert.deepEqual([row.v, row.rank, row.of, row.tied], ['1-1', 2, 2, false])
  // The league view and the team view are one tally.
  assert.equal(rankMetric(index, 'scored-4-plus').ranked.find((r) => r.teamId === 1).rank, row.rank)
})

test('a split only this club has played ranks first of one', () => {
  const index = buildRankingIndex(
    entriesFrom(teams, [file(2025, club(1, [game({ sf: 1 })]), club(2, [game()]))]),
  )
  const row = teamRankRows(index, 1).flatMap((g) => g.rows).find((r) => r.id === 'scored-first')
  assert.deepEqual([row.rank, row.of], [1, 1])
  assert.equal(teamRankRows(index, 2).flatMap((g) => g.rows).some((r) => r.id === 'scored-first'), false)
})

test('a club with no postseason game has no team view', () => {
  const index = buildRankingIndex(entriesFrom(teams, [file(2025, club(1, [game()]))]))
  assert.equal(teamRankRows(index, 3), null)
})

// ---------------------------------------------------------------------------
// On the committed files
// ---------------------------------------------------------------------------

test('all seasons since 1995 pivot into one board with the Dodgers on it', () => {
  const dir = new URL('../public/data/postseason-records/', import.meta.url)
  const seasons = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')).seasons
  const files = seasons.map((s) => JSON.parse(readFileSync(new URL(`${s}.json`, dir), 'utf8')))
  const allTeams = [...new Set(files.flatMap((f) => Object.keys(f.clubs)))].map((id) => ({ id: Number(id), name: `Club ${id}` }))
  const index = buildRankingIndex(entriesFrom(allTeams, files))
  const board = rankMetric(index, 'scored-first')
  assert.ok(board.of >= 25, `${board.of} clubs ranked`)
  const totals = board.ranked.reduce((n, r) => n + r.played, 0)
  assert.ok(totals > 0)
  // A club's own list agrees with the board it sits on.
  const la = teamRankRows(index, 119)
  const mine = la.flatMap((g) => g.rows).find((r) => r.id === 'scored-first')
  assert.equal(mine.rank, board.ranked.find((r) => r.teamId === 119).rank)
})

// ---------------------------------------------------------------------------
// The all-years minimum-games floor
// ---------------------------------------------------------------------------

test('only the all-years board takes a minimum, and only a menu value', () => {
  assert.deepEqual(MIN_GAMES, [0, 3, 5, 10])
  assert.equal(resolveMinGames('5', ALL_SEASONS), 5)
  assert.equal(resolveMinGames('4', ALL_SEASONS), 0) // off the menu
  assert.equal(resolveMinGames('banana', ALL_SEASONS), 0)
  assert.equal(resolveMinGames(undefined, ALL_SEASONS), 0)
  assert.equal(resolveMinGames('5', 2025), 0) // a single postseason
  assert.equal(resolveMinGames('5', null), 0) // still loading
})

const thin = () =>
  buildRankingIndex(
    entriesFrom(teams, [
      file(
        2025,
        club(1, [game({ rs: 5 }), game({ rs: 5 }), game({ rs: 5 })]), // 3-0
        club(2, [...Array.from({ length: 13 }, () => game({ rs: 5 })), game({ rs: 5, r: 'L' })]), // 13-1
      ),
    ]),
  )

test('with no floor a 3-0 club outranks 13-1', () => {
  const result = rankMetric(thin(), 'scored-4-plus')
  assert.deepEqual(result.ranked.map((r) => [r.teamId, r.rank]), [[1, 1], [2, 2]])
})

test('a floor keeps a thin club’s row and figure but takes its rank', () => {
  const result = rankMetric(thin(), 'scored-4-plus', { minPlayed: 5 })
  assert.deepEqual(result.ranked.map((r) => [r.teamId, r.rank]), [[2, 1], [1, null]])
  assert.equal(result.of, 1)
  assert.equal(result.ranked[1].v, '3-0')
})

test('the floor reaches the team view’s ranks too', () => {
  const index = thin()
  const row = (id) => teamRankRows(index, 1, { minPlayed: id }).flatMap((g) => g.rows).find((r) => r.id === 'scored-4-plus')
  assert.deepEqual([row(0).rank, row(0).of], [1, 2])
  assert.deepEqual([row(5).rank, row(5).of], [null, 1])
})

// ---------------------------------------------------------------------------
// The games behind a record
// ---------------------------------------------------------------------------

const withAbbr = (season, abbrs, ...clubs) => ({ ...file(season, ...clubs), abbrs })
const sample = () =>
  entriesFrom(
    [{ id: 1, name: 'Alphas', abbreviation: 'ALP' }],
    [
      withAbbr(2003, { 1: 'FLA', 10: 'NYY' }, club(1, [
        game({ d: '2003-10-21', pk: 11, gt: 'W', h: 1, sg: 3, r: 'L', rs: 1, ra: 6, sf: -1 }),
        game({ d: '2003-10-25', pk: 13, gt: 'W', sg: 6, rs: 2, ra: 0, sf: 1 }),
      ])),
      withAbbr(2024, { 1: 'ALP', 10: 'BET' }, club(1, [game({ d: '2024-10-05', pk: 21, gt: 'D', sg: 1, sf: 1 })])),
    ],
  )[0]

test('a record’s games are exactly the games its figure counted', () => {
  const entry = sample()
  const rows = gameRowsFor(entry, 'scored-first')
  assert.deepEqual(rows.map((r) => r.gamePk), [21, 13])
  // The figure the board prints for the same split.
  const figure = teamRecordsFor(entry.data).groups.flatMap((g) => g.rows).find((r) => r.id === 'scored-first')
  assert.equal(rows.length, figure.played)
  assert.equal(rows.filter((r) => r.won).length, figure.wins)
})

test('rows are newest first and carry the round, score and series game', () => {
  const rows = gameRowsFor(sample(), 'opp-scored-first')
  assert.equal(rows.length, 1)
  assert.deepEqual(
    [rows[0].date, rows[0].series, rows[0].runs, rows[0].oppRuns, rows[0].won, rows[0].line],
    ['2003-10-21', 'WS', 1, 6, false, 'Loss · game 3'],
  )
})

test('the box-score address uses the abbreviations of THAT season, away first', () => {
  const rows = gameRowsFor(sample(), 'scored-first')
  const byPk = Object.fromEntries(rows.map((r) => [r.gamePk, r]))
  assert.equal(byPk[13].boxScorePath, '/10252003/flanyy/boxscore') // road game: club first
  assert.equal(byPk[21].boxScorePath, '/10052024/alpbet/boxscore') // the club's name changed since 2003
  const home = gameRowsFor(sample(), 'opp-scored-first')[0]
  assert.equal(home.boxScorePath, '/10212003/nyyfla/boxscore') // home game: opponent first
  assert.equal(home.teamAbbr, 'FLA')
  assert.equal(home.opponentAbbr, 'NYY')
})

test('a game with no abbreviation on file still lists, with no address', () => {
  const entry = entriesFrom(teams, [file(2025, club(1, [game({ pk: 5, gt: 'L', sf: 1 })]))])[0]
  const [row] = gameRowsFor(entry, 'scored-first')
  assert.equal(row.boxScorePath, null)
  assert.equal(row.teamAbbr, '')
})

test('the cutoff drops a game the same way the record does', () => {
  const entry = sample()
  assert.deepEqual(gameRowsFor(entry, 'scored-first', { cutoff: '2003-12-31' }).map((r) => r.gamePk), [13])
  assert.deepEqual(gameRowsFor(entry, 'scored-first', { cutoff: '2003-10-24' }).map((r) => r.gamePk), [])
})

test('the league rows list the games the `il` flag splits', () => {
  const entry = entriesFrom(teams, [
    withAbbr(2025, { 1: 'ALP', 10: 'BET' }, club(1, [game({ pk: 1, gt: 'D' }), game({ pk: 2, gt: 'W', il: 1, d: '2025-10-25' })])),
  ])[0]
  assert.deepEqual(gameRowsFor(entry, 'vs-own-league').map((r) => r.gamePk), [1])
  assert.deepEqual(gameRowsFor(entry, 'vs-other-league').map((r) => r.gamePk), [2])
})

test('an id that is not a record lists nothing', () => {
  assert.deepEqual(gameRowsFor(sample(), 'not-a-record'), [])
})
