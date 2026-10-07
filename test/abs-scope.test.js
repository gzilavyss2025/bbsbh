// ABS challenges keep the postseason BESIDE the regular season, never blended
// (#1514, ADR-0094's shape). The scope lives on the game (abs_ingested_games);
// a challenge row takes its game's scope through game_pk.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '../scripts/lib/db.js'
import { buildExport, ingestGame, inScope, restampGame, scopeOfGameType } from '../scripts/lib/abs/index.mjs'

const tmpDb = () => openDb(mkdtempSync(join(tmpdir(), 'abs-scope-')))

const row = (over) => ({
  game_pk: 1, seq: 0, season: 2026, level: 'MLB', date: '2026-04-01', team_id: 100, opp_id: 200,
  side: 'away', player_id: 11, player_name: 'A Hitter', role: 'batter',
  outcome: 'success', inning: 3, half: 'top', umpire_id: 7, umpire_name: 'An Umpire',
  call_type: 'strike', favor: -0.5, miss_inches: 0.5, ...over,
})
const game = (over) => ({
  game_pk: 1, date: '2026-04-01', season: 2026, level: 'MLB', away_team_id: 100, home_team_id: 200,
  umpire_id: 7, challenges: 1, final_inning: 9, bottom_played: 1, scheduled_innings: 9, ...over,
})
const target = (over) => ({
  season: 2026, gamePk: 9, date: '2026-10-03', level: 'MLB', scope: 'P',
  awayTeamId: 100, homeTeamId: 200, umpId: 7, umpName: 'An Umpire', ...over,
})
const shape = { finalInning: 9, bottomPlayed: 1, scheduledInnings: 9 }

test('scopeOfGameType: the regular season is R, every postseason round is P', () => {
  assert.equal(scopeOfGameType('R'), 'R')
  for (const t of ['F', 'D', 'L', 'W']) assert.equal(scopeOfGameType(t), 'P')
})

test('an old dump line that names no scope loads as the regular season', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abs-old-'))
  writeFileSync(
    join(dir, 'abs-challenges.sql'),
    "INSERT INTO abs_ingested_games (game_pk, date, season, level, away_team_id, home_team_id, umpire_id, challenges, final_inning, bottom_played, scheduled_innings) VALUES (5, '2026-04-01', 2026, 'MLB', 100, 200, 7, 0, 9, 1, 9);\n",
  )
  const db = await openDb(dir)
  assert.equal(db.prepare('SELECT scope FROM abs_ingested_games WHERE game_pk = 5').get().scope, 'R')
})

test('ingestGame: a postseason game goes on as P, and a second sweep adds nothing', async () => {
  const db = await tmpDb()
  const rows = [row({ game_pk: 9 }), row({ game_pk: 9, seq: 1, outcome: 'fail' })]
  ingestGame(db, target(), rows, shape)
  ingestGame(db, target(), rows, shape)
  assert.deepEqual(db.prepare('SELECT game_pk, scope, challenges FROM abs_ingested_games').all().map((r) => ({ ...r })), [
    { game_pk: 9, scope: 'P', challenges: 2 },
  ])
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM abs_challenges').get().n, 2)
})

test('restampGame: --recheck moves a postseason game swept as R, and never touches its challenges', async () => {
  const db = await tmpDb()
  ingestGame(db, target({ scope: 'R' }), [row({ game_pk: 9 })], { finalInning: null, bottomPlayed: null, scheduledInnings: null })
  restampGame(db, 9, { scope: 'P', shape })
  const g = db.prepare('SELECT scope, final_inning FROM abs_ingested_games WHERE game_pk = 9').get()
  assert.deepEqual({ ...g }, { scope: 'P', final_inning: 9 })
  // A schedule row with no linescore still sets the scope and keeps the length on file.
  restampGame(db, 9, { scope: 'P', shape: { finalInning: null } })
  assert.equal(db.prepare('SELECT final_inning FROM abs_ingested_games').get().final_inning, 9)
  // And a length already on file is never overwritten: the sweep read it off
  // the plays, which the schedule row does not carry.
  restampGame(db, 9, { scope: 'P', shape: { finalInning: 6, bottomPlayed: 0, scheduledInnings: 9 } })
  assert.equal(db.prepare('SELECT final_inning FROM abs_ingested_games').get().final_inning, 9)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM abs_challenges').get().n, 1)
})

test('inScope: a challenge row takes its game’s scope; a game with no scope is regular season', () => {
  const rows = [row({ game_pk: 1 }), row({ game_pk: 2 })]
  const games = [game({ game_pk: 1 }), game({ game_pk: 2, scope: 'P' })]
  assert.deepEqual(inScope(rows, games, 'R').rows.map((r) => r.game_pk), [1])
  assert.deepEqual(inScope(rows, games, 'P').rows.map((r) => r.game_pk), [2])
  assert.deepEqual(inScope(rows, games, 'all').rows.map((r) => r.game_pk), [1, 2])
})

test('buildExport: an orphan challenge row (no game record) is dropped by every scope, so All = Regular + Postseason (#1603)', () => {
  const orphan = row({ game_pk: 99, seq: 0 })
  const rows = [...all, orphan]
  const of = (scope) => buildExport(rows, allGames, { season: 2026, scope }).levels.MLB
  const [both, reg, post] = [of('all'), of('R'), of('P')]
  assert.equal(both.total, reg.total + post.total)
  assert.equal(both.success, reg.success + post.success)
  assert.equal(both.games, reg.games + post.games)
  assert.deepEqual(inScope(rows, allGames, 'all').rows.map((r) => r.game_pk).includes(99), false)
})

// Same club, same player, same umpire in both parts: a postseason row must not
// overwrite or add onto any regular-season figure.
const regRows = [row({}), row({ seq: 1, outcome: 'fail', favor: null }), row({ seq: 2, outcome: 'fail', favor: null }), row({ seq: 3 })]
const postRows = [row({ game_pk: 2, date: '2026-10-03' })]
const allGames = [game({ challenges: 4 }), game({ game_pk: 2, date: '2026-10-03', scope: 'P' })]
const all = [...regRows, ...postRows]

test('buildExport: the regular season never carries a postseason row, and the default is R', () => {
  const reg = buildExport(all, allGames, { season: 2026 })
  const alone = buildExport(regRows, [allGames[0]], { season: 2026 })
  assert.deepEqual(reg.levels, alone.levels)
  assert.deepEqual(reg.postGames, { MLB: 1 })
  const team = reg.levels.MLB.byTeam.find((t) => t.teamId === 100)
  assert.deepEqual([team.n, team.success, team.games], [4, 2, 1])
  assert.equal(reg.levels.MLB.lastDate, '2026-04-01')
})

test('buildExport: the postseason file holds the postseason alone', () => {
  const post = buildExport(all, allGames, { season: 2026, scope: 'P' })
  assert.deepEqual([post.levels.MLB.games, post.levels.MLB.total, post.levels.MLB.success], [1, 1, 1])
  assert.deepEqual(post.postGames, { MLB: 1 })
})

test('buildExport: All sums the counts and recomputes the rate, never a mean of the two rates', () => {
  const both = buildExport(all, allGames, { season: 2026, scope: 'all' }).levels.MLB
  const reg = buildExport(all, allGames, { season: 2026 }).levels.MLB
  const post = buildExport(all, allGames, { season: 2026, scope: 'P' }).levels.MLB
  assert.equal(both.total, reg.total + post.total)
  assert.equal(both.success, reg.success + post.success)
  assert.equal(both.games, reg.games + post.games)
  assert.equal(both.successRate, 3 / 5) // pooled; the mean of 0.5 and 1 would be 0.75
  assert.equal(both.perGame, 5 / 2)
})

// THE BACKFILL, PINNED ON THE COMMITTED DUMP. The 23 games below are every
// postseason game the schedule listed (gameType F, D, L, W, by gamePk) that was
// on file when the scope arrived. 2026's regular season ended on September 27
// (MLB) and September 20 (Triple-A), so no later game may still read 'R'.
test('the committed dump: every 2026 postseason game is P, and no October game is left in R', async () => {
  const db = await openDb()
  const scopeOf = new Map(db.prepare('SELECT game_pk, scope FROM abs_ingested_games').all().map((g) => [g.game_pk, g.scope]))
  const post = [
    849823, 849825, 849828, 849829, 849830, 849834, 849835, 849839, 849841, 849842, 849843, 849844,
    849845, 849846, 849848, 849849, 849851, 850987, 850988, 850989, 850991, 850992, 850993,
  ]
  for (const pk of post) assert.equal(scopeOf.get(pk), 'P', `${pk}`)
  const late = db
    .prepare("SELECT game_pk FROM abs_ingested_games WHERE season = 2026 AND scope = 'R' AND date > CASE level WHEN 'MLB' THEN '2026-09-27' ELSE '2026-09-20' END")
    .all()
  assert.deepEqual(late, [])
})

test('the reader picks one file a scope, and Regular is the default', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const body = url === '/data/abs/seasons.json' ? { seasons: [2026], current: 2026 } : { url }
    return { ok: true, status: 200, json: async () => body }
  })
  const { fetchAbsChallenges } = await import('../src/api/around-the-game/absChallenges.js')
  const fileOf = async (scope) => (await fetchAbsChallenges({ seasonYear: 2026, scope })).url
  assert.equal(await fileOf(undefined), '/data/abs/2026/abs-challenges.json')
  assert.equal(await fileOf('reg'), '/data/abs/2026/abs-challenges.json')
  assert.equal(await fileOf('post'), '/data/abs/2026/abs-challenges-post.json')
  assert.equal(await fileOf('all'), '/data/abs/2026/abs-challenges-all.json')
  assert.equal(await fileOf('nonsense'), '/data/abs/2026/abs-challenges.json')
})

// "ALDS • G1" under the biggest postseason overturn (Gary, 2026-10-06). Read
// live on gamePk 849829: gameType D, home league 103, seriesGameNumber 1.
test('roundShort: the round and the series game, short enough for a stat tile', async () => {
  const { roundShort } = await import('../src/lib/postseason/gameRound.js')
  const row = (gameType, league, n) => ({ gameType, seriesGameNumber: n, teams: { home: { team: { league: { id: league } } } } })
  assert.equal(roundShort(row('D', 103, 1)), 'ALDS \u2022 G1')
  assert.equal(roundShort(row('L', 104, 4)), 'NLCS \u2022 G4')
  assert.equal(roundShort(row('F', 103, 2)), 'AL Wild Card \u2022 G2')
  assert.equal(roundShort(row('W', 103, 7)), 'World Series \u2022 G7')
  assert.equal(roundShort(row('D', 103, null)), 'ALDS')
  assert.equal(roundShort(row('R', 103, 1)), '')
})

test('the address keeps ?scope= on /abs-challenges, and Regular is the bare address', async () => {
  const { parseRoute, absChallengesPath } = await import('../src/lib/route.js')
  assert.equal(absChallengesPath({ seasonYear: 2026, scope: 'post' }), '/abs-challenges/2026?scope=post')
  assert.equal(absChallengesPath({ scope: 'reg' }), '/abs-challenges')
  assert.equal(parseRoute('/abs-challenges?scope=all').scope, 'all')
  assert.equal(parseRoute('/abs-challenges?scope=bogus').scope, undefined)
})

// A bare /abs-challenges is Regular for everyone: no stored pick may change it.
test('the ABS page reads its scope from the address alone', () => {
  const page = readFileSync(new URL('../src/screens/around-the-game/AbsChallengesPage.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /localStorage/)
  assert.match(page, /scopeParam \?\? 'reg'/)
})

// Gary, 2026-10-06: under Postseason the umpire board's floor is 1 game. A plate
// umpire works a handful of October games at most, so 15 left the board empty.
test('umpireBoard: the postseason floor is 1 game, so a man with one October plate is on it', async () => {
  const { umpireBoard, MIN_UMPIRE_GAMES_POST } = await import('../src/api/around-the-game/absChallenges.js')
  const summary = { byUmpire: [{ umpireId: 7, name: 'An Umpire', games: 1, n: 3, success: 2, rate: 2 / 3, perGame: 3 }] }
  assert.equal(MIN_UMPIRE_GAMES_POST, 1)
  assert.deepEqual(umpireBoard(summary, 'rate', MIN_UMPIRE_GAMES_POST).map((u) => u.umpireId), [7])
  assert.deepEqual(umpireBoard(summary, 'rate').map((u) => u.umpireId), [])
})
