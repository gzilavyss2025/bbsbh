// The postseason situational-records ledger: the pure half of
// scripts/gen-postseason-records.mjs (scripts/lib/records/postseason.mjs) and
// the committed public/data/postseason-records/ files it writes.
//
// The cases that earn their place are the ones the regular-season tagger would
// get wrong here: a sweep in a best-of-seven, the same two clubs meeting in two
// rounds, a club that changed leagues, and a role table that must not be the
// regular season's.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { refreshRoleFacts } from '../scripts/lib/team-records.mjs'
import {
  parseSeasons,
  postseasonCandidates,
  addPostseasonFacts,
  tagPostseasonSeries,
  shipPostseasonRow,
  buildSeasonFile,
  FIRST_SEASON,
} from '../scripts/lib/records/postseason.mjs'
import { teamRecordsFor, seriesRecordCounts, sweepCounts } from '../src/api/teamRecords.js'

// ---------------------------------------------------------------------------
// parseSeasons
// ---------------------------------------------------------------------------

test('no --seasons means the current season only', () => {
  assert.deepEqual(parseSeasons(undefined, 2026), [2026])
  assert.deepEqual(parseSeasons(true, 2026), [2026])
})

test('--seasons reads a year, a range, and a comma list of either', () => {
  assert.deepEqual(parseSeasons('2024', 2026), [2024])
  assert.deepEqual(parseSeasons('2022-2024', 2026), [2022, 2023, 2024])
  assert.deepEqual(parseSeasons('2024,1995-1996,2024', 2026), [1995, 1996, 2024])
})

test('--seasons refuses a typo and a year before the Wild Card era', () => {
  assert.throws(() => parseSeasons('twenty', 2026), /cannot read/)
  assert.throws(() => parseSeasons('2024-2022', 2026), /outside/)
  assert.throws(() => parseSeasons(`${FIRST_SEASON - 1}`, 2026), /outside/)
})

// ---------------------------------------------------------------------------
// postseasonCandidates / addPostseasonFacts
// ---------------------------------------------------------------------------

const game = (over = {}) => ({
  gamePk: 1,
  gameType: 'D',
  officialDate: '2025-10-04',
  seriesGameNumber: 2,
  status: { codedGameState: 'F' },
  teams: {
    away: { team: { id: 10, league: { id: 103 } } },
    home: { team: { id: 20, league: { id: 104 } } },
  },
  ...over,
})
const slate = (...games) => ({ dates: [{ games }] })

test('only played, new games with two clubs are candidates', () => {
  const out = postseasonCandidates(
    slate(
      game({ gamePk: 1 }),
      game({ gamePk: 2, status: { codedGameState: 'S' } }), // scheduled
      game({ gamePk: 3, status: { codedGameState: 'O' } }), // game over, not yet final
      game({ gamePk: 4 }), // already on file
      game({ gamePk: 5, teams: { away: { team: {} }, home: { team: { id: 20 } } } }), // TBD club
    ),
    new Set(['4']),
  )
  assert.deepEqual(out.map((c) => c.game.gamePk), [1])
  assert.equal(out[0].sportId, 1)
  assert.equal(out[0].date, '2025-10-04')
})

test('a postseason row records round, series game, and BOTH clubs’ leagues and abbreviations that season', () => {
  const rows = [
    { payload: {} }, // away
    { payload: {} }, // home
  ]
  const withAbbr = game()
  withAbbr.teams.away.team.abbreviation = 'FLA'
  withAbbr.teams.home.team.abbreviation = 'NYY'
  addPostseasonFacts(rows, withAbbr)
  assert.deepEqual(rows[0].payload, {
    gameType: 'D', seriesGameNumber: 2, leagueId: 103, oppLeagueId: 104, abbr: 'FLA', oppAbbr: 'NYY',
  })
  assert.deepEqual(rows[1].payload, {
    gameType: 'D', seriesGameNumber: 2, leagueId: 104, oppLeagueId: 103, abbr: 'NYY', oppAbbr: 'FLA',
  })
})

// ---------------------------------------------------------------------------
// tagPostseasonSeries
// ---------------------------------------------------------------------------

const row = (over = {}, payload = {}) => ({
  opp_id: 20,
  date: '2025-10-04',
  result: 'W',
  sport_id: 1,
  payload: { gameType: 'D', seriesGameNumber: 1, ...payload },
  ...over,
})

test('a sweep of a best-of-seven is a four-game series, not a seven-game one', () => {
  const rows = [1, 2, 3, 4].map((n) => row({ date: `2025-10-0${n}` }, { gameType: 'L', seriesGameNumber: n }))
  const tagged = tagPostseasonSeries(rows)
  assert.deepEqual(tagged.map((t) => t.seriesLength), [4, 4, 4, 4])
  assert.deepEqual(tagged.map((t) => t.seriesOpener), [true, false, false, false])
  assert.deepEqual(tagged.map((t) => t.seriesFinale), [false, false, false, true])
})

test('two clubs meeting in two rounds are two series', () => {
  const rows = [
    row({ date: '2025-10-01' }, { gameType: 'D', seriesGameNumber: 1 }),
    row({ date: '2025-10-02' }, { gameType: 'D', seriesGameNumber: 2 }),
    row({ date: '2025-10-09' }, { gameType: 'L', seriesGameNumber: 1 }),
  ]
  const tagged = tagPostseasonSeries(rows)
  assert.deepEqual(tagged.map((t) => t.seriesLength), [2, 2, 1])
  assert.deepEqual(tagged.map((t) => t.seriesOpener), [true, false, true])
})

test('a feed with no series game number falls back to the running count', () => {
  const rows = [1, 2, 3].map((n) =>
    row({ date: `2025-10-0${n}` }, { seriesGameNumber: null }),
  )
  assert.deepEqual(tagPostseasonSeries(rows).map((t) => t.seriesGame), [1, 2, 3])
})

test('a series gap (a game that never ingested) leaves the series short, never invented', () => {
  // Game 2 is missing. The series still ends at game 3, so the reader — which
  // counts a series only when every game in it is present — drops it whole.
  const rows = [1, 3].map((n) => row({ date: `2025-10-0${n}` }, { seriesGameNumber: n }))
  const tagged = tagPostseasonSeries(rows)
  assert.equal(tagged[0].seriesLength, 3)
  assert.equal(seriesRecordCounts(tagged.map((t) => ({ r: 'W', sg: t.seriesGame, sl: t.seriesLength, o: 20, d: t.date }))).won, 0)
})

// ---------------------------------------------------------------------------
// shipPostseasonRow / buildSeasonFile
// ---------------------------------------------------------------------------

const payload = (over = {}) => ({
  innings: [[0, 0], [1, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, null]],
  isHome: false,
  runs: 1,
  oppRuns: 0,
  hits: 5,
  oppHits: 3,
  errors: 0,
  oppErrors: 0,
  homeRuns: 0,
  oppHomeRuns: 0,
  scheduledInnings: 9,
  dayNight: 'night',
  doubleHeader: 'N',
  gameNumber: 1,
  starterId: null,
  starterOuts: 21,
  starterEr: 0,
  oppStarterId: null,
  oppStarterOuts: 18,
  oppStarterEr: 1,
  oppStarterHand: 'L',
  battedAround: 0,
  oppBattedAround: 0,
  gameType: 'W',
  seriesGameNumber: 1,
  leagueId: 103,
  oppLeagueId: 104,
  ...over,
})

const stored = (teamId, oppId, date, p, result = 'W') => ({
  game_pk: 900000 + teamId, team_id: teamId, season: 2025, sport_id: 1, date, opp_id: oppId, result,
  payload_json: JSON.stringify(p),
})

test('only a game against the other league is interleague, by that season’s leagues', () => {
  const t = tagPostseasonSeries([{ ...row(), payload: payload() }])[0]
  assert.equal(shipPostseasonRow(t, new Map()).il, 1)
  const same = tagPostseasonSeries([{ ...row(), payload: payload({ oppLeagueId: 103 }) }])[0]
  assert.equal('il' in shipPostseasonRow(same, new Map()), false)
  // No league on file (an old feed) is not evidence of a league line.
  const unknown = tagPostseasonSeries([{ ...row(), payload: payload({ leagueId: null }) }])[0]
  assert.equal('il' in shipPostseasonRow(unknown, new Map()), false)
})

test('a shipped row names its game and its round', () => {
  const t = tagPostseasonSeries([{ ...row(), game_pk: 18554, payload: payload() }])[0]
  const shipped = shipPostseasonRow(t, new Map())
  assert.equal(shipped.pk, 18554)
  assert.equal(shipped.gt, 'W')
  const none = tagPostseasonSeries([{ ...row(), game_pk: 1, payload: payload({ gameType: null }) }])[0]
  assert.equal('gt' in shipPostseasonRow(none, new Map()), false)
})

test('a season file carries each club’s abbreviation for THAT season', () => {
  const raw = [
    stored(10, 20, '2003-10-01', payload({ abbr: 'FLA', oppAbbr: 'NYY' })),
    stored(20, 10, '2003-10-01', payload({ isHome: true, abbr: 'NYY', oppAbbr: 'FLA' }), 'L'),
  ]
  assert.deepEqual(buildSeasonFile(2003, raw, new Map()).abbrs, { 10: 'FLA', 20: 'NYY' })
  // A feed that carries no abbreviation gives an empty map, not a crash.
  assert.deepEqual(buildSeasonFile(2003, [stored(10, 20, '2003-10-01', payload())], new Map()).abbrs, {})
})

test('a postseason row has no getaway day', () => {
  const t = tagPostseasonSeries([{ ...row(), payload: payload() }])[0]
  assert.equal('ga' in shipPostseasonRow(t, new Map()), false)
})

test('a season file orders clubs and games, and the same rows rebuild byte-identical', () => {
  const raw = [
    stored(20, 10, '2025-10-02', payload({ isHome: true, seriesGameNumber: 2, leagueId: 104, oppLeagueId: 103 }), 'L'),
    stored(10, 20, '2025-10-02', payload({ seriesGameNumber: 2 })),
    stored(10, 20, '2025-10-01', payload({ seriesGameNumber: 1 })),
    stored(20, 10, '2025-10-01', payload({ isHome: true, seriesGameNumber: 1, leagueId: 104, oppLeagueId: 103 }), 'L'),
  ]
  const file = buildSeasonFile(2025, raw, new Map())
  assert.deepEqual(Object.keys(file.clubs), ['10', '20'])
  assert.equal(file.clubs[10].leagueId, 103)
  assert.deepEqual(file.clubs[10].games.map((g) => g.d), ['2025-10-01', '2025-10-02'])
  assert.deepEqual(file.clubs[10].games.map((g) => g.sg), [1, 2])
  assert.equal(file.clubs[10].games[1].fi, 1)
  assert.equal(JSON.stringify(buildSeasonFile(2025, [...raw].reverse(), new Map())), JSON.stringify(file))
})

test('the regular-season situational predicates read a postseason club unchanged', () => {
  const raw = [
    stored(10, 20, '2025-10-01', payload({ seriesGameNumber: 1 })),
    stored(10, 20, '2025-10-02', payload({ seriesGameNumber: 2 })),
  ]
  const club = buildSeasonFile(2025, raw, new Map()).clubs[10]
  const out = teamRecordsFor({ games: club.games, sportId: 1 })
  const row = out.groups.flatMap((g) => g.rows).find((r) => r.id === 'scored-first')
  assert.equal(row.v, '2-0')
  assert.deepEqual(sweepCounts(club.games), { swept: 1, sweptBy: 0 })
})

// ---------------------------------------------------------------------------
// The role table is the postseason's own
// ---------------------------------------------------------------------------

test('a postseason role refresh reads and writes the postseason tables only', async () => {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../scripts/lib/schema.sql', import.meta.url), 'utf8'))
  db.prepare(
    `INSERT INTO postseason_record_games
       (game_pk, team_id, season, sport_id, date, opp_id, result, payload_json)
     VALUES (1, 10, 2025, 1, '2025-10-01', 20, 'W', ?)`,
  ).run(JSON.stringify({ starterId: 100, oppStarterId: 200 }))
  await refreshRoleFacts(
    db, 2025, [1],
    async () => ({ 100: { gamesPlayed: 30, gamesStarted: 30 }, 999: { gamesPlayed: 5, gamesStarted: 0 } }),
    { games: 'postseason_record_games', roles: 'postseason_record_pitcher_roles' },
  )
  assert.deepEqual(
    db.prepare('SELECT person_id FROM postseason_record_pitcher_roles').all().map((r) => r.person_id),
    [100],
  )
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM team_record_pitcher_roles').get().n, 0)
  db.close()
})

// ---------------------------------------------------------------------------
// The committed files
// ---------------------------------------------------------------------------

const dir = new URL('../public/data/postseason-records/', import.meta.url)
const seasonFiles = readdirSync(dir).filter((f) => /^\d{4}\.json$/.test(f))

test('every season since 1995 is on file and the index names them', () => {
  const index = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'))
  assert.ok(index.generatedAt)
  assert.deepEqual(index.seasons, seasonFiles.map((f) => Number(f.slice(0, 4))).sort((a, b) => a - b))
  assert.equal(index.seasons[0], FIRST_SEASON)
})

test('each season’s wins equal its losses — every game is on file for both clubs', () => {
  for (const f of seasonFiles) {
    const { clubs } = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
    const all = Object.values(clubs).flatMap((c) => c.games)
    const w = all.filter((g) => g.r === 'W').length
    const l = all.filter((g) => g.r === 'L').length
    assert.equal(w, l, `${f}: ${w} wins vs ${l} losses`)
    assert.ok(w > 0, `${f}: empty season`)
  }
})

test('the 2025 postseason: 47 games, and the World Series is the only interleague series', () => {
  const { clubs } = JSON.parse(readFileSync(new URL('2025.json', dir), 'utf8'))
  const games = Object.values(clubs).reduce((n, c) => n + c.games.length, 0) / 2
  assert.equal(games, 47)
  // Los Angeles (119) beat Toronto (141) in seven: the only interleague series.
  const la = clubs[119].games.filter((g) => g.o === 141)
  assert.equal(la.length, 7)
  assert.equal(la.filter((g) => g.r === 'W').length, 4)
  assert.ok(la.every((g) => g.il === 1))
  assert.ok(clubs[119].games.filter((g) => g.o !== 141).every((g) => g.il == null))
})

test('every committed game names its pk and round, and every club its abbreviation', () => {
  for (const f of seasonFiles) {
    const { season, abbrs, clubs } = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
    for (const club of Object.values(clubs)) {
      assert.ok(abbrs[club.teamId], `${season}: no abbreviation for ${club.teamId}`)
      for (const g of club.games) {
        assert.ok(g.pk > 0, `${season}: a game with no pk`)
        assert.ok('FDLW'.includes(g.gt), `${season}: bad round ${g.gt}`)
        assert.ok(abbrs[g.o], `${season}: no abbreviation for opponent ${g.o}`)
      }
    }
  }
})

test('a game appears once for each club under the same pk', () => {
  for (const f of seasonFiles) {
    const { clubs } = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
    const counts = new Map()
    for (const club of Object.values(clubs)) for (const g of club.games) counts.set(g.pk, (counts.get(g.pk) ?? 0) + 1)
    assert.ok([...counts.values()].every((n) => n === 2), `${f}: a pk is not on exactly two clubs`)
  }
})
