// The Notable games index (scripts/gen-notable.mjs, pure half in scripts/lib/notable/).
// Offline: every fixture is inline, and each case says which real game or rule it pins.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGameMap, gameFromRow, lastPlayedDate } from '../scripts/lib/notable/games.mjs'
import {
  battedInnings, cycleRows, isCycle, noHitSides, noHitterRow, pitchersFromBox, triplePlayRows,
} from '../scripts/lib/notable/kinds.mjs'
import {
  ALL_ALLOWED_KEYS, ALLOWED_KEYS, KINDS, applySeed, emptyDoc, mergeCoverage, mergeRows, serializeDoc, sortRows,
} from '../scripts/lib/notable/merge.mjs'
import { normalizeArgv, seasonsFromArgs, unknownFlags } from '../scripts/lib/notable/cli.mjs'
import { sweepSeason } from '../scripts/lib/notable/sweep.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---- fixtures ----

// A schedule row as statsapi returns it with hydrate=team,linescore. Hits and innings
// sit in the linescore; the club's league id sits on the hydrated team.
const club = (id, abbr, league = 103, score = 0) => ({
  team: { id, abbreviation: abbr, name: `${abbr} club`, league: { id: league } },
  score,
})
const frame = (awayRuns, awayHits, homeRuns, homeHits) => ({
  away: { runs: awayRuns, hits: awayHits },
  ...(homeRuns === undefined ? { home: { hits: homeHits } } : { home: { runs: homeRuns, hits: homeHits } }),
})
const nineInnings = () => Array.from({ length: 9 }, (_, i) => ({ num: i + 1, ...frame(0, 0, 0, 0) }))
function row(over = {}) {
  const { away = club(1, 'AAA'), home = club(2, 'HHH'), awayHits = 5, homeHits = 6, innings = nineInnings(), ...rest } = over
  return {
    gamePk: 1,
    officialDate: '2025-06-01',
    gameType: 'R',
    gameNumber: 1,
    status: { detailedState: 'Final', abstractGameState: 'Final' },
    teams: { away, home },
    linescore: { innings, teams: { away: { runs: away.score, hits: awayHits }, home: { runs: home.score, hits: homeHits } } },
    ...rest,
  }
}
const mapOf = (...rows) => buildGameMap([{ games: rows }])

// ---- played ----

test('played: a Forfeit is dropped, whatever abstractGameState says', () => {
  // gamePk 177426, 1979-07-12 DET@CWS: forfeit, 0-0, no innings, 0 hits for both sides,
  // abstractGameState "Final". The 0-hit rule alone would call it a no-hitter.
  const forfeit = row({ gamePk: 177426, status: { detailedState: 'Forfeit', abstractGameState: 'Final' }, awayHits: 0, homeHits: 0, innings: [] })
  assert.equal(mapOf(forfeit).size, 0)
})

test('played: a Postponed row that says Final in abstractGameState is dropped', () => {
  // A postponed or cancelled row says "Final" in abstractGameState (findings.md, Step 3).
  const postponed = row({ gamePk: 2, status: { detailedState: 'Postponed', abstractGameState: 'Final' } })
  const cancelled = row({ gamePk: 3, status: { detailedState: 'Cancelled', abstractGameState: 'Final' } })
  assert.equal(mapOf(postponed, cancelled).size, 0)
})

test('played: Final and Completed Early are kept', () => {
  // 2021 seven-inning games and rain-shortened games end as Completed Early.
  const early = row({ gamePk: 4, status: { detailedState: 'Completed Early', abstractGameState: 'Final' } })
  assert.deepEqual([...mapOf(row({ gamePk: 5 }), early).keys()], [5, 4])
})

// ---- dedupe ----

test('dedupe: a suspended game listed twice gives one game', () => {
  // 1975 lists 7 suspended games under the first date and again under the resume date,
  // with the same gamePk, clubs and score (1,941 rows, 1,934 distinct gamePks).
  const first = row({ gamePk: 168575, officialDate: '1975-05-14' })
  const resumed = row({ gamePk: 168575, officialDate: '1975-05-15' })
  const map = buildGameMap([{ games: [first] }, { games: [resumed] }])
  assert.equal(map.size, 1)
  assert.equal(map.get(168575).officialDate, '1975-05-14')
})

test('dedupe: a cycle and a triple play count once for each gamePk and player or club', () => {
  const map = mapOf(row({ gamePk: 9 }))
  const split = { game: { gamePk: 9 }, team: { id: 1 }, stat: { hits: 4, doubles: 1, triples: 1, homeRuns: 1, triplePlays: 1 } }
  const people = [{ id: 7, fullName: 'A Batter', stats: [{ splits: [split, split] }] }]
  assert.equal(cycleRows(people, map).length, 1)
  assert.equal(triplePlayRows([split, split], 1, map).length, 1)
})

// ---- league and game type ----

test('league: a Negro league game is dropped, and a World Series game is kept', () => {
  // 1927-07-04 has 12 Negro league games (league ids 427 and 430, e.g. gamePk 856407
  // KCM@CAG) beside 16 AL and NL games. A World Series game is AL against NL.
  const negro = row({ gamePk: 856407, away: club(10, 'KCM', 430), home: club(11, 'CAG', 430) })
  const oneNegro = row({ gamePk: 856408, away: club(10, 'KCM', 430), home: club(2, 'HHH', 103) })
  const series = row({ gamePk: 67524, gameType: 'W', away: club(119, 'BRO', 104), home: club(147, 'NYY', 103) })
  assert.deepEqual([...mapOf(negro, oneNegro, series).keys()], [67524])
})

test('game types: the regular season and the postseason stay, spring and All-Star do not', () => {
  const rows = ['R', 'F', 'D', 'L', 'W', 'S', 'E', 'A'].map((gameType, i) => row({ gamePk: 100 + i, gameType }))
  assert.deepEqual([...mapOf(...rows).values()].map((g) => g.gameType), ['R', 'F', 'D', 'L', 'W'])
})

// ---- no-hitter marks ----

const nohit = (over) => {
  const map = mapOf(row({ gamePk: 50, ...over }))
  const game = map.get(50)
  return { game, sides: noHitSides(game) }
}
const names = [{ id: 1, name: 'P One' }]

test('no-hitter: a side with 0 hits is a no-hitter, a missing hit total is not', () => {
  assert.deepEqual(nohit({ awayHits: 0, homeHits: 3 }).sides, ['away'])
  // Old linescores can lack the total. An absent number must not read as a zero.
  const game = gameFromRow(row({ gamePk: 51 }))
  game.away.hits = null
  assert.deepEqual(noHitSides(game), [])
  // A game with no innings was not played, whatever its state says.
  assert.deepEqual(nohit({ awayHits: 0, innings: [] }).sides, [])
})

test('no-hitter: the row names the side that threw it, with every pitcher in order', () => {
  // Combined no-hitter: Collin McHugh and four more, TB at home against CLE, 2021-07-07.
  const { game } = nohit({ away: club(1, 'CLE', 103, 0), home: club(2, 'TB', 103, 4), awayHits: 0, homeHits: 7 })
  const box = {
    teams: {
      away: { pitchers: [9], players: { ID9: { person: { fullName: 'Not This One' } } } },
      home: { pitchers: [3, 1], players: { ID3: { person: { fullName: 'Collin McHugh' } }, ID1: { person: { fullName: 'Pete Fairbanks' } } } },
    },
  }
  const pitchers = pitchersFromBox(box, 'home')
  assert.deepEqual(pitchers, [{ id: 3, name: 'Collin McHugh' }, { id: 1, name: 'Pete Fairbanks' }])
  const out = noHitterRow(game, 'away', pitchers)
  assert.equal(out.side, 'home')
  assert.equal(out.pitchers.length, 2)
  assert.equal(out.away.runs, 0)
  assert.equal(out.home.runs, 4)
})

test('no-hitter: shortened when the no-hit club batted fewer than 9 innings', () => {
  // A seven-inning game, the away club had 0 hits and batted 7 times (2021-04-25 ARI@ATL).
  const seven = nineInnings().slice(0, 7)
  const a = nohit({ away: club(1, 'ARI', 103, 7), home: club(2, 'ATL', 104, 0), awayHits: 8, homeHits: 0, innings: seven })
  assert.equal(noHitterRow(a.game, 'home', names).shortened, true)
  // Home club with 0 hits that leads after the top of the 9th never bats in the 9th:
  // the feed leaves `runs` off that half (Larsen, gamePk 67524). 8 innings, shortened.
  const eight = [...nineInnings().slice(0, 8), { num: 9, away: { runs: 0, hits: 0 }, home: { hits: 0 } }]
  const b = nohit({ away: club(1, 'AAA', 103, 0), home: club(2, 'HHH', 103, 2), awayHits: 0, homeHits: 3, innings: eight })
  assert.equal(battedInnings(b.game, 'away'), 9)
  assert.equal(noHitterRow(b.game, 'away', names).shortened, undefined)
  const c = nohit({ away: club(1, 'AAA', 103, 2), home: club(2, 'HHH', 103, 1), awayHits: 6, homeHits: 0, innings: eight })
  assert.equal(battedInnings(c.game, 'home'), 8)
  assert.equal(noHitterRow(c.game, 'home', names).shortened, true)
})

test('no-hitter: a full 9-inning game is not marked shortened, and the mark is absent, not false', () => {
  const { game } = nohit({ away: club(1, 'BRO', 104, 0), home: club(2, 'NYY', 103, 2), awayHits: 0, homeHits: 5 })
  assert.equal('shortened' in noHitterRow(game, 'away', names), false)
  assert.equal('lost' in noHitterRow(game, 'away', names), false)
})

test('no-hitter: lost when the club that threw it lost', () => {
  // The club with 0 hits can still win, on walks and errors. The pitchers who held it
  // hitless then lost, and the row says so.
  const won = nohit({ away: club(1, 'AAA', 103, 0), home: club(2, 'HHH', 103, 2), awayHits: 0, homeHits: 5 })
  const kept = noHitterRow(won.game, 'away', names)
  assert.equal(kept.side, 'home')
  assert.equal('lost' in kept, false)
  const lost = nohit({ away: club(1, 'AAA', 103, 3), home: club(2, 'HHH', 103, 2), awayHits: 0, homeHits: 6 })
  const out = noHitterRow(lost.game, 'away', names)
  assert.equal(out.side, 'home')
  assert.equal(out.lost, true)
})

// ---- cycles ----

const stat = (hits, doubles, triples, homeRuns) => ({ hits, doubles, triples, homeRuns })

test('cycle: single, double, triple and home run is a cycle', () => {
  assert.equal(isCycle(stat(4, 1, 1, 1)), true) // Brock Holt, gamePk 563375: 4 hits, 1 of each extra-base hit
})

test('cycle: 2B, 3B, HR, HR has no single, so it is not a cycle', () => {
  assert.equal(isCycle(stat(4, 1, 1, 2)), false) // 4 hits, no single
})

test('cycle: five hits with a cycle in them is a cycle', () => {
  assert.equal(isCycle(stat(5, 1, 1, 1)), true) // two singles
  assert.equal(isCycle(stat(3, 1, 1, 1)), false) // not enough hits to hold a single
  assert.equal(isCycle(stat('4', '1', '1', '1')), true) // the feed sends numbers; strings still count
  assert.equal(isCycle({}), false)
})

test('cycle: the side comes from the club in the game log, and a game outside the map is dropped', () => {
  const map = mapOf(row({ gamePk: 563375, gameType: 'D', away: club(111, 'BOS'), home: club(147, 'NYY') }))
  const holt = { id: 571788, fullName: 'Brock Holt', stats: [{ splits: [
    { game: { gamePk: 563375 }, team: { id: 111 }, stat: stat(4, 1, 1, 1) },
    { game: { gamePk: 999 }, team: { id: 111 }, stat: stat(4, 1, 1, 1) }, // not in the map
  ] }] }
  const rows = cycleRows([holt], map)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].side, 'away')
  assert.deepEqual(rows[0].player, { id: 571788, name: 'Brock Holt' })
})

// ---- triple plays ----

test('triple play: the club in the log is the fielding side, and a log with 0 is no row', () => {
  const map = mapOf(row({ gamePk: 716945, away: club(139, 'TB'), home: club(108, 'LAA') }))
  const splits = [{ game: { gamePk: 716945 }, stat: { doublePlays: 2, triplePlays: 0 } }]
  assert.deepEqual(triplePlayRows(splits, 108, map), []) // the Angels' log says 0 for this game
  const hit = [{ game: { gamePk: 716945 }, stat: { triplePlays: 1 } }]
  assert.equal(triplePlayRows(hit, 108, map)[0].side, 'home')
  assert.equal(triplePlayRows(hit, 139, map)[0].side, 'away')
  assert.deepEqual(triplePlayRows(hit, 5, map), []) // a club that was not in the game
})

// ---- the sweep: calls ----

test('sweep: one fielded call per need, game types as measured, no call for a dropped club', async () => {
  const urls = []
  const wsGame = row({ gamePk: 1, gameType: 'W', away: club(119, 'BRO', 104, 0), home: club(147, 'NYY', 103, 2), awayHits: 0, homeHits: 5 })
  const negro = row({ gamePk: 2, away: club(430, 'KCM', 430), home: club(431, 'CAG', 430) })
  const reg = row({ gamePk: 3, away: club(147, 'NYY', 103), home: club(119, 'BRO', 104) })
  const answers = [
    [/\/schedule\?/, { dates: [{ games: [wsGame, negro, reg] }] }],
    [/\/boxscore\?/, { teams: { away: { pitchers: [] }, home: { pitchers: [117514], players: { ID117514: { person: { fullName: 'Don Larsen' } } } } } }],
    [/\/sports\/1\/players/, { people: [{ id: 1 }, { id: 2 }] }],
    [/\/people\?/, { people: [] }],
    [/\/teams\/\d+\/stats/, { stats: [{ splits: [] }] }],
  ]
  const get = async (url) => {
    urls.push(url)
    return answers.find(([re]) => re.test(url))[1]
  }
  const swept = await sweepSeason(get, 1956)
  assert.equal(swept.rows.nohitters.length, 1)
  assert.equal(swept.rows.nohitters[0].pitchers[0].name, 'Don Larsen')
  assert.equal(swept.through, '2025-06-01')
  assert.ok(urls.every((u) => u.includes('fields=')), 'every call is fielded')
  assert.ok(urls[0].includes('gameType=R,F,D,L,W'))
  assert.ok(urls.some((u) => u.includes('hydrate=stats(group=[hitting],type=[gameLog],season=1956,gameType=[R,F,D,L,W])')))
  const teamLogs = urls.filter((u) => u.includes('/teams/'))
  // Two clubs: one regular-season log each, and one World Series log each. Never a list.
  assert.equal(teamLogs.length, 4)
  assert.ok(teamLogs.every((u) => !/gameType=[^&]*,/.test(u) && !u.includes('gameType=[')))
  assert.ok(!urls.some((u) => /\/teams\/43[01]\//.test(u)), 'a Negro league club gets no call')
})

test('sweep: a season with no kept game writes nothing', async () => {
  assert.equal(await sweepSeason(async () => ({ dates: [] }), 1900), null)
})

// ---- merge and seed ----

const tp = (gamePk, date, side = 'home') => ({
  gamePk, officialDate: date, gameType: 'R', gameNumber: 1,
  away: { id: 1, abbr: 'AAA', name: 'A', runs: 1 }, home: { id: 2, abbr: 'HHH', name: 'H', runs: 2 }, side,
})

test('merge: a re-run of one season replaces that season only', () => {
  const prev = [tp(10, '2024-05-01'), tp(11, '2025-05-01'), tp(12, '2025-06-01')]
  // 2025 is swept again and the API no longer lists game 11. No ghost row stays.
  const merged = mergeRows('tripleplays', prev, [2025], [tp(12, '2025-06-01'), tp(13, '2025-07-01')])
  assert.deepEqual(merged.map((r) => r.gamePk), [13, 12, 10])
})

test('merge: coverage lists the seasons swept, the through date never moves back', () => {
  const first = mergeCoverage(undefined, [2025], '2025-11-01')
  assert.deepEqual(first, { seasons: [2025], through: '2025-11-01', leagues: ['AL', 'NL'], gameTypes: ['R', 'F', 'D', 'L', 'W'] })
  const next = mergeCoverage(first, [1956], '1956-10-10')
  assert.deepEqual(next.seasons, [1956, 2025])
  assert.equal(next.through, '2025-11-01')
})

test('merge: rows are newest first, with a stable tiebreak', () => {
  const sorted = sortRows('tripleplays', [tp(1, '2020-01-01'), tp(3, '2021-01-01'), tp(2, '2021-01-01')])
  assert.deepEqual(sorted.map((r) => r.gamePk), [3, 2, 1])
})

test('seed: a row joins and takes its date, clubs and score from the season game map', () => {
  const map = mapOf(row({ gamePk: 716945, officialDate: '2023-08-18', away: club(139, 'TB', 103, 4), home: club(108, 'LAA', 103, 5) }))
  const seed = [{ gamePk: 716945, season: 2023, side: 'home', note: 'for people' }]
  const out = applySeed('tripleplays', [], seed, new Map([[2023, map]]))
  assert.equal(out.applied, 1)
  assert.equal(out.rows[0].officialDate, '2023-08-18')
  assert.equal(out.rows[0].home.runs, 5)
  assert.equal(out.rows[0].side, 'home')
  assert.equal('note' in out.rows[0], false, 'the note is never written')
  // A swept row for the same key wins: the seed does not duplicate it.
  const again = applySeed('tripleplays', out.rows, seed, new Map([[2023, map]]))
  assert.equal(again.rows.length, 1)
  assert.equal(again.applied, 0)
})

test('seed: a row for a season that was not swept waits', () => {
  const out = applySeed('tripleplays', [], [{ gamePk: 716945, season: 2023, side: 'home' }], new Map([[2025, mapOf(row())]]))
  assert.equal(out.rows.length, 0)
  assert.equal(out.waiting, 1)
})

test('seed: a row whose gamePk is not a played AL or NL game fails the run, naming the row', () => {
  const map = mapOf(row({ gamePk: 5 }))
  const bad = [{ gamePk: 856407, season: 2023, side: 'home' }]
  assert.throws(() => applySeed('tripleplays', [], bad, new Map([[2023, map]])), /gamePk 856407 is not a played AL or NL game of 2023/)
  assert.throws(() => applySeed('tripleplays', [], [{ gamePk: 5, season: 2023, side: 'left' }], new Map([[2023, map]])), /"side" must be/)
  assert.throws(() => applySeed('cycles', [], [{ gamePk: 5, season: 2023, side: 'home' }], new Map([[2023, map]])), /"player" needs/)
  assert.throws(() => applySeed('nohitters', [], [{ gamePk: 5, season: 2023, side: 'home' }], new Map([[2023, map]])), /"pitchers" needs/)
})

test('file: rows are written one to a line and read back whole, with no generatedAt', () => {
  const doc = { coverage: mergeCoverage(undefined, [2025], '2025-11-01'), rows: [tp(2, '2025-02-01'), tp(1, '2025-01-01')] }
  const text = serializeDoc(doc)
  assert.equal(text.trimEnd().split('\n').length, 4)
  assert.deepEqual(JSON.parse(text), doc)
  assert.equal('generatedAt' in JSON.parse(text), false)
  assert.deepEqual(JSON.parse(serializeDoc(emptyDoc())).rows, [])
  assert.equal(lastPlayedDate(mapOf(row({ gamePk: 1, officialDate: '2025-06-01' }), row({ gamePk: 2, officialDate: '2025-07-01' }))), '2025-07-01')
})

// ---- the flags ----

test('flags: the space form and the = form read the same, and a bad year fails', () => {
  assert.deepEqual(normalizeArgv(['--season', '2025', '--out=/tmp/x']), ['--season=2025', '--out=/tmp/x'])
  assert.deepEqual(normalizeArgv(['--from', '1901', '--to', '1910']), ['--from=1901', '--to=1910'])
  assert.deepEqual(seasonsFromArgs({}, 2026), [2026])
  assert.deepEqual(seasonsFromArgs({ season: '1956' }, 2026), [1956])
  assert.deepEqual(seasonsFromArgs({ from: '1901', to: '1903' }, 2026), [1901, 1902, 1903])
  assert.equal(seasonsFromArgs({ from: '2020' }, 2026).length, 7)
  assert.throws(() => seasonsFromArgs({ season: '1800' }, 2026), /from 1901/)
  assert.throws(() => seasonsFromArgs({ season: true }, 2026), /--season takes a year/)
  assert.throws(() => seasonsFromArgs({ season: '2020', from: '2019' }, 2026), /not both/)
  assert.throws(() => seasonsFromArgs({ from: '2020', to: '2019' }, 2026), /is after/)
  assert.deepEqual(unknownFlags({ season: '1', sezon: '2' }), ['sezon'])
})

// ---- the seed file ----

test('the seed file holds the one triple play the API misses, and a row per kind that fits', () => {
  const seed = JSON.parse(readFileSync(join(ROOT, 'scripts', 'notable-seed.json'), 'utf8'))
  assert.deepEqual(Object.keys(seed).sort(), [...KINDS].sort())
  assert.deepEqual(seed.tripleplays.map((s) => s.gamePk), [716945]) // 2023-08-18 TBA@ANA, Angels in the field
  assert.equal(seed.tripleplays[0].season, 2023)
  assert.equal(seed.tripleplays[0].side, 'home')
})

// THE VOCABULARY, on the files that actually ship (as test/long-at-bats.test.js does).
//
// A row carries the game's identity, its date, both clubs with the final score (D5) and
// the kind's own fields. The moment a file also carries an inning line, a hit total or
// another player, it stops being a list of feats and starts being a box score of a game
// the reader may still want to score. So this reads the bytes that are committed and
// states the allowed vocabulary positively: a key a later edit adds has to be added to
// ALLOWED_KEYS in scripts/lib/notable/merge.mjs, where the reason is written.
test('no committed file carries a key outside the allowlist, at any depth', () => {
  const dir = join(ROOT, 'public', 'data', 'notable')
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  assert.deepEqual(files, ['cycles.json', 'nohitters.json', 'tripleplays.json'])

  for (const file of files) {
    const kind = file.replace('.json', '')
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    assert.deepEqual(Object.keys(doc).sort(), [...ALLOWED_KEYS.doc].sort(), `${file} top level`)
    assert.deepEqual(Object.keys(doc.coverage).sort(), [...ALLOWED_KEYS.coverage].sort(), `${file} coverage`)
    assert.deepEqual(doc.coverage.leagues, ['AL', 'NL'])
    assert.deepEqual(doc.coverage.gameTypes, ['R', 'F', 'D', 'L', 'W'])
    assert.ok(doc.coverage.seasons.length > 0, `${file} sweeps no season`)
    assert.deepEqual([...doc.coverage.seasons].sort((a, b) => a - b), doc.coverage.seasons)
    assert.match(doc.coverage.through, /^\d{4}-\d{2}-\d{2}$/)

    // Every key at every depth, in case the shape is the thing that changes.
    const walk = (node, path) => {
      if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`))
      if (!node || typeof node !== 'object') return
      for (const [key, value] of Object.entries(node)) {
        assert.ok(ALL_ALLOWED_KEYS.has(key), `${file} carries a key off the allowlist at ${path}.${key}`)
        walk(value, `${path}.${key}`)
      }
    }
    walk(doc, file)

    let prev = null
    for (const r of doc.rows) {
      for (const key of Object.keys(r)) assert.ok(ALLOWED_KEYS.row.includes(key), `${file} row carries ${key}`)
      for (const side of ['away', 'home']) {
        assert.deepEqual(Object.keys(r[side]).sort(), [...ALLOWED_KEYS.club].sort(), `${file} ${side} club`)
        assert.ok(Number.isInteger(r[side].runs), `${file} ${side} has no score`)
      }
      assert.ok(['home', 'away'].includes(r.side))
      assert.ok(doc.coverage.seasons.includes(Number(r.officialDate.slice(0, 4))), `${file} row outside its coverage`)
      assert.ok(['R', 'F', 'D', 'L', 'W'].includes(r.gameType))
      if (kind === 'cycles') assert.deepEqual(Object.keys(r.player).sort(), ['id', 'name'])
      if (kind === 'nohitters') assert.ok(r.pitchers.length > 0 && r.pitchers.every((p) => Object.keys(p).length === 2))
      if (kind !== 'nohitters') assert.ok(!('pitchers' in r) && !('shortened' in r) && !('lost' in r))
      if (kind !== 'cycles') assert.ok(!('player' in r))
      // newest first
      if (prev) assert.ok(prev.officialDate >= r.officialDate, `${file} is not newest first`)
      prev = r
    }
  }
})
