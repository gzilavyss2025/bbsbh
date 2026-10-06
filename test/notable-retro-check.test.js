// The Retrosheet cross-check of the Notable games index
// (scripts/gen-notable.mjs --check-retrosheet, pure half in scripts/lib/notable/retro-*.mjs).
// Offline: every fixture is inline, and each case says which rule or real game it pins.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LABELS, RetroInputError, checkRetrosheet, indexOnlyRows, retroEntries,
} from '../scripts/lib/notable/retro-check.mjs'
import { countLabels, formatReport } from '../scripts/lib/notable/retro-report.mjs'
import { runRetroCheck } from '../scripts/lib/notable/retro-run.mjs'

// ---- fixtures ----

// One gameinfo.csv row, as parseCsv gives it (every cell a string). Defaults to Larsen's
// perfect game: 1956-10-08, Brooklyn (BRO) at New York (NYA), 0-2, a World Series game.
const gi = (over = {}) => ({
  gid: 'NYA195610080', visteam: 'BRO', hometeam: 'NYA', date: '19561008', number: '0',
  vruns: '0', hruns: '2', gametype: 'worldseries', forfeit: '', season: '1956', ...over,
})
// One teamstats.csv row: a club's hits and triple plays in the field, and its side.
const ts = (gid, vishome, over = {}) => ({ gid, team: vishome === 'v' ? 'BRO' : 'NYA', vishome, b_h: '5', d_tp: '0', ...over })
const larsenStats = (gid = 'NYA195610080') => [ts(gid, 'v', { b_h: '0' }), ts(gid, 'h')]

// An index file as the generator writes it: a coverage block and rows.
const indexRow = (gamePk, officialDate, awayRuns, homeRuns, side, gameNumber = 1) => ({
  gamePk, officialDate, gameType: 'R', gameNumber,
  away: { id: 1, abbr: 'AAA', name: 'A club', runs: awayRuns },
  home: { id: 2, abbr: 'HHH', name: 'H club', runs: homeRuns },
  side,
})
const doc = (seasons, rows) => ({ coverage: { seasons, through: '2025-11-01', leagues: ['AL', 'NL'], gameTypes: ['R'] }, rows })

// A schedule row as scheduleFor hands it back (games.mjs gameFromRow shape).
const club = (id, abbr, leagueId, runs) => ({ id, abbr, name: `${abbr} club`, leagueId, runs, hits: null })
const apiGame = (gamePk, officialDate, away, home, over = {}) => ({
  gamePk, officialDate, gameType: 'R', gameNumber: 1, state: 'Final', away, home, innings: [], ...over,
})
// A scheduleFor that counts its calls. `days` is { date: [games] }.
function scheduleOf(days = {}) {
  const calls = []
  const scheduleFor = async (date) => {
    calls.push(date)
    return days[date] ?? []
  }
  return { scheduleFor, calls }
}
const neverCalled = async (date) => {
  throw new Error(`scheduleFor(${date}) must not be called`)
}

const larsen = () => retroEntries('nohitters', [gi()], larsenStats())

// ---- reading the CSV rows ----

test('a no-hitter takes the side of the club that THREW it, not the club with 0 hits', () => {
  // The Retrosheet file has no "side" column. The club with 0 hits is found by b_h in
  // teamstats.csv. The index row's `side` is the club that threw it (kinds.mjs noHitterRow),
  // so the entry takes the OTHER side. Larsen: Brooklyn (the visitor) had 0 hits, so the
  // Yankees, the home club, threw it.
  const [e] = larsen()
  assert.equal(e.side, 'home')
  assert.equal(e.date, '1956-10-08')
  assert.deepEqual([e.vruns, e.hruns, e.season], [0, 2, 1956])
  const [home] = retroEntries('nohitters', [gi()], [ts('NYA195610080', 'v'), ts('NYA195610080', 'h', { b_h: '0' })])
  assert.equal(home.side, 'away')
})

test('a triple play is the club with d_tp above 0, on its own side', () => {
  // 1920-10-10 BRO@CLE, 1-8: Wambsganss turned it for Cleveland, the home club.
  const g = gi({ gid: 'CLE192010100', visteam: 'BRO', hometeam: 'CLE', date: '19201010', vruns: '1', hruns: '8', season: '1920' })
  const [e] = retroEntries('tripleplays', [g], [ts(g.gid, 'v'), ts(g.gid, 'h', { d_tp: '1' })])
  assert.equal(e.side, 'home')
  assert.equal(e.kind, 'tripleplays')
})

test('a game with no qualifying club stops the run, with the gid named', () => {
  // Retrosheet says every listed game qualifies. A game that does not means the file is
  // not the list this check was written for, and a guess would hide it.
  assert.throws(() => retroEntries('nohitters', [gi()], [ts('NYA195610080', 'v'), ts('NYA195610080', 'h')]), /NYA195610080/)
})

test('a missing teamstats.csv column fails with a clear message', () => {
  // The check needs b_h for no-hitters. A renamed column must stop the run, not read as 0.
  const bad = [{ gid: 'x', team: 'BRO', vishome: 'v', hits: '0' }]
  assert.throws(() => retroEntries('nohitters', [gi()], bad), (e) => {
    assert.ok(e instanceof RetroInputError)
    assert.match(e.message, /teamstats\.csv/)
    assert.match(e.message, /b_h/)
    return true
  })
  const noTp = [{ gid: 'x', team: 'BRO', vishome: 'v', b_h: '0' }]
  assert.throws(() => retroEntries('tripleplays', [gi()], noTp), /d_tp/)
})

test('a missing gameinfo.csv column fails with a clear message', () => {
  const { vruns, ...noVruns } = gi()
  assert.ok(vruns)
  assert.throws(() => retroEntries('nohitters', [noVruns], larsenStats()), /gameinfo\.csv.*vruns/)
})

// ---- the labels ----

test('matched: an index row of the same kind has the date, the score and the side', async () => {
  // Larsen, 0-2, Brooklyn no-hit. No API call: the index explains the game.
  const index = { nohitters: doc([1956], [indexRow(67524, '1956-10-08', 0, 2, 'home')]) }
  const { results } = await checkRetrosheet({ entries: larsen(), index, scheduleFor: neverCalled })
  assert.equal(results[0].label, 'matched')
  assert.deepEqual(results[0].gamePks, [67524])
})

test('matched: either game of a doubleheader day matches', async () => {
  // findings.md, the 1904-06-20 case: the API and Retrosheet number a doubleheader in
  // opposite orders. Retrosheet says game 1, the index holds the same score as game 2.
  const g = gi({ gid: 'X190406201', date: '19040620', number: '1', vruns: '3', hruns: '0', season: '1904', gametype: 'regular' })
  const entries = retroEntries('nohitters', [g], [ts(g.gid, 'v'), ts(g.gid, 'h', { b_h: '0' })])
  const index = { nohitters: doc([1904], [indexRow(11, '1904-06-20', 3, 0, 'away', 2)]) }
  const { results } = await checkRetrosheet({ entries, index, scheduleFor: neverCalled })
  assert.equal(results[0].label, 'matched')
})

test('side-differs: a score coincidence on the same date with the other side is not matched', async () => {
  // Same day, same 0-2 score, but the index has the AWAY club as the thrower. Calling it
  // matched would hide a wrong side, so it gets its own label.
  const index = { nohitters: doc([1956], [indexRow(67524, '1956-10-08', 0, 2, 'away')]) }
  const { results } = await checkRetrosheet({ entries: larsen(), index, scheduleFor: neverCalled })
  assert.equal(results[0].label, 'side-differs')
  assert.deepEqual(results[0].gamePks, [67524])
})

test('a row of the other kind does not match', async () => {
  // A triple-play row on the same date and score must not explain a no-hitter.
  const index = { nohitters: doc([1956], []), tripleplays: doc([1956], [indexRow(67524, '1956-10-08', 0, 2, 'home')]) }
  const api = scheduleOf()
  const { results } = await checkRetrosheet({ entries: larsen(), index, scheduleFor: api.scheduleFor })
  assert.notEqual(results[0].label, 'matched')
})

test('out-of-scope-type: an exhibition or All-Star game is never looked up', async () => {
  // D6/D13: the index holds no exhibition or All-Star game, so it is no miss. No call.
  const entries = [
    ...retroEntries('nohitters', [gi({ gametype: 'exhibition', gid: 'E1' })], larsenStats('E1')),
    ...retroEntries('nohitters', [gi({ gametype: 'allstar', gid: 'E2' })], larsenStats('E2')),
  ]
  const { results } = await checkRetrosheet({ entries, index: { nohitters: doc([1956], []) }, scheduleFor: neverCalled })
  assert.deepEqual(results.map((r) => r.label), ['out-of-scope-type', 'out-of-scope-type'])
})

test('season-not-swept: a season outside the coverage block is never looked up', async () => {
  // Before 1901 the index has no season. The coverage block is the index's own claim.
  const g = gi({ gid: 'C189709181', date: '18970918', season: '1897', gametype: 'regular' })
  const entries = retroEntries('nohitters', [g], larsenStats(g.gid))
  const { results } = await checkRetrosheet({ entries, index: { nohitters: doc([1956], []) }, scheduleFor: neverCalled })
  assert.equal(results[0].label, 'season-not-swept')
})

test('dropped-league: the API has the game, but a club is not in the AL or NL', async () => {
  // D6: a Negro league game of 1927 is in the sportId=1 schedule with league ids 427 and
  // 430. The index leaves it out on purpose.
  const g = gi({ gid: 'KCM192707041', visteam: 'CAG', hometeam: 'KCM', date: '19270704', vruns: '4', hruns: '1', season: '1927', gametype: 'regular' })
  const entries = retroEntries('nohitters', [g], [ts(g.gid, 'v', { b_h: '0' }), ts(g.gid, 'h')])
  const api = scheduleOf({ '1927-07-04': [apiGame(856407, '1927-07-04', club(9001, 'CAG', 427, 4), club(9002, 'KCM', 430, 1))] })
  const { results } = await checkRetrosheet({ entries, index: { nohitters: doc([1927], []) }, scheduleFor: api.scheduleFor })
  assert.equal(results[0].label, 'dropped-league')
  assert.deepEqual(results[0].gamePks, [856407])
})

test('not-in-api: the API has no game on that date with that score', async () => {
  // D7: Federal League games and anything before 1901. A game on the day with another
  // score does not explain it, and neither does an empty day.
  const other = apiGame(5, '1956-10-08', club(1, 'AAA', 103, 7), club(2, 'HHH', 104, 3))
  const api = scheduleOf({ '1956-10-08': [other] })
  const { results } = await checkRetrosheet({ entries: larsen(), index: { nohitters: doc([1956], []) }, scheduleFor: api.scheduleFor })
  assert.equal(results[0].label, 'not-in-api')
  assert.deepEqual(results[0].gamePks, [])
  const empty = await checkRetrosheet({ entries: larsen(), index: { nohitters: doc([1956], []) }, scheduleFor: scheduleOf().scheduleFor })
  assert.equal(empty.results[0].label, 'not-in-api')
})

test('missed: the API has a played AL or NL game with that date and score, and the index lacks it', async () => {
  // The seed candidate. The report must give the gamePk so a person checks it by hand.
  const game = apiGame(716945, '1956-10-08', club(1, 'AAA', 103, 0), club(2, 'HHH', 104, 2))
  const api = scheduleOf({ '1956-10-08': [game] })
  const { results } = await checkRetrosheet({ entries: larsen(), index: { nohitters: doc([1956], []) }, scheduleFor: api.scheduleFor })
  assert.equal(results[0].label, 'missed')
  assert.deepEqual(results[0].gamePks, [716945])
})

test('an API game that was not played does not make a miss', async () => {
  // A forfeit says "Final" in abstractGameState and "Forfeit" in detailedState. The
  // index counts only Final and Completed Early (rules.mjs), and so does this check.
  const game = apiGame(177426, '1956-10-08', club(1, 'AAA', 103, 0), club(2, 'HHH', 104, 2), { state: 'Forfeit' })
  const { results } = await checkRetrosheet({ entries: larsen(), index: { nohitters: doc([1956], []) }, scheduleFor: scheduleOf({ '1956-10-08': [game] }).scheduleFor })
  assert.equal(results[0].label, 'not-in-api')
})

test('two rows on one date make one scheduleFor call', async () => {
  // A day with two feats (or a doubleheader) must cost one API call, not two.
  const entries = [
    ...retroEntries('nohitters', [gi({ gid: 'A' })], larsenStats('A')),
    ...retroEntries('nohitters', [gi({ gid: 'B', vruns: '1', hruns: '0' })], [ts('B', 'v'), ts('B', 'h', { b_h: '0' })]),
  ]
  const api = scheduleOf()
  const { results } = await checkRetrosheet({ entries, index: { nohitters: doc([1956], []) }, scheduleFor: api.scheduleFor })
  assert.equal(results.length, 2)
  assert.deepEqual(api.calls, ['1956-10-08'])
})

test('every game gets exactly one label, and a label is one of the seven', async () => {
  const entries = [
    ...larsen(),
    ...retroEntries('nohitters', [gi({ gid: 'E', gametype: 'exhibition', date: '19560401' })], larsenStats('E')),
    ...retroEntries('nohitters', [gi({ gid: 'Z', date: '18970918', season: '1897' })], larsenStats('Z')),
  ]
  const index = { nohitters: doc([1956], [indexRow(67524, '1956-10-08', 0, 2, 'home')]) }
  const { results } = await checkRetrosheet({ entries, index, scheduleFor: scheduleOf().scheduleFor })
  assert.equal(results.length, entries.length)
  for (const r of results) assert.ok(LABELS.includes(r.label), r.label)
  assert.deepEqual(results.map((r) => r.label), ['matched', 'out-of-scope-type', 'season-not-swept'])
})

// ---- the reverse: index-only ----

test('index-only lists an index row that Retrosheet lacks', () => {
  // findings.md found one such row for 1901 to 1959. It is no error: a person reads it.
  // 2025 is outside the years the Retrosheet file holds (1956 only here), so a 2025 row
  // is not a gap. A row Retrosheet does hold is not listed.
  const entries = larsen()
  const nh = doc([1956, 2025], [
    indexRow(67524, '1956-10-08', 0, 2, 'home'), // Retrosheet holds it
    indexRow(900, '1956-05-01', 1, 0, 'home'), // Retrosheet does not
    indexRow(901, '2025-05-01', 1, 0, 'home'), // a season Retrosheet's file does not reach
  ])
  const out = indexOnlyRows(entries, { nohitters: nh })
  assert.deepEqual(out.map((r) => r.gamePk), [900])
  assert.equal(out[0].kind, 'nohitters')
})

test('index-only checks only the kinds that were given', () => {
  assert.deepEqual(indexOnlyRows(larsen(), { nohitters: doc([1956], []), cycles: doc([1956], [indexRow(1, '1956-01-01', 1, 0, 'home')]) }), [])
})

// ---- the report ----

test('countLabels gives every label, with 0 for the empty ones', async () => {
  const { results } = await checkRetrosheet({ entries: larsen(), index: { nohitters: doc([1956], [indexRow(67524, '1956-10-08', 0, 2, 'home')]) }, scheduleFor: neverCalled })
  const counts = countLabels(results)
  assert.deepEqual(Object.keys(counts), LABELS)
  assert.equal(counts.matched, 1)
  assert.equal(counts.missed, 0)
})

test('the report gives a missed row everything a person needs to check it', async () => {
  const game = apiGame(716945, '1956-10-08', club(1, 'AAA', 103, 0), club(2, 'HHH', 104, 2))
  const report = await checkRetrosheet({ entries: larsen(), index: { nohitters: doc([1956], []) }, scheduleFor: scheduleOf({ '1956-10-08': [game] }).scheduleFor })
  const text = formatReport(report)
  for (const needle of ['missed', 'NYA195610080', '1956-10-08', 'BRO', 'NYA', '0-2', '716945', 'nohitters']) {
    assert.ok(text.includes(needle), `report lacks ${needle}`)
  }
  // A matched row is a count, not a line.
  const matched = await checkRetrosheet({ entries: larsen(), index: { nohitters: doc([1956], [indexRow(67524, '1956-10-08', 0, 2, 'home')]) }, scheduleFor: neverCalled })
  assert.ok(!formatReport(matched).includes('NYA195610080'))
})

// ---- the run (files, exit codes) ----

const CSV_GAMEINFO = 'gid,visteam,hometeam,date,number,vruns,hruns,gametype,forfeit,season\nNYA195610080,BRO,NYA,19561008,0,0,2,worldseries,,1956\n'
const CSV_TEAMSTATS = 'gid,team,vishome,b_h,d_tp\nNYA195610080,BRO,v,0,0\nNYA195610080,NYA,h,5,0\n'
const scratch = () => mkdtempSync(join(tmpdir(), 'retro-check-test-'))
function listDir(gameinfo = CSV_GAMEINFO, teamstats = CSV_TEAMSTATS) {
  const dir = scratch()
  if (gameinfo !== null) writeFileSync(join(dir, 'gameinfo.csv'), gameinfo)
  if (teamstats !== null) writeFileSync(join(dir, 'teamstats.csv'), teamstats)
  return dir
}
function indexDir() {
  const dir = scratch()
  writeFileSync(join(dir, 'nohitters.json'), JSON.stringify(doc([1956], [indexRow(67524, '1956-10-08', 0, 2, 'home')])))
  return dir
}
const quiet = () => {
  const lines = []
  return { log: (s) => lines.push(s), lines }
}

test('runRetroCheck exits 0 when the inputs parse, whatever the labels say', async () => {
  const { log, lines } = quiet()
  const code = await runRetroCheck({ 'check-retrosheet': true, nohitters: listDir(), index: indexDir() }, { get: neverCalled, log })
  assert.equal(code, 0)
  assert.ok(lines.join('\n').includes('matched'))
})

test('runRetroCheck exits 1 when a file is missing', async () => {
  const { log, lines } = quiet()
  const code = await runRetroCheck({ 'check-retrosheet': true, nohitters: listDir(CSV_GAMEINFO, null), index: indexDir() }, { get: neverCalled, log })
  assert.equal(code, 1)
  assert.ok(lines.join('\n').includes('teamstats.csv'))
})

test('runRetroCheck exits 1 when a needed column is gone', async () => {
  const { log } = quiet()
  const code = await runRetroCheck({ 'check-retrosheet': true, nohitters: listDir(CSV_GAMEINFO, 'gid,team,vishome,hits\nNYA195610080,BRO,v,0\n'), index: indexDir() }, { get: neverCalled, log })
  assert.equal(code, 1)
})

test('runRetroCheck exits 1 when neither list is given', async () => {
  const { log } = quiet()
  assert.equal(await runRetroCheck({ 'check-retrosheet': true }, { get: neverCalled, log }), 1)
})

test('runRetroCheck refuses a report path inside the repo', async () => {
  // A Retrosheet-derived file must never land in the repo (ADR-0100). The report holds
  // Retrosheet game ids, so it goes outside.
  const { log, lines } = quiet()
  const code = await runRetroCheck(
    { 'check-retrosheet': true, nohitters: listDir(), index: indexDir(), report: fileURLToPath(new URL('../retro-report.json', import.meta.url)) },
    { get: neverCalled, log },
  )
  assert.equal(code, 1)
  assert.ok(lines.join('\n').includes('inside the repo'))
})

test('runRetroCheck writes the JSON report outside the repo', async () => {
  const out = join(scratch(), 'nested')
  mkdirSync(out)
  const file = join(out, 'report.json')
  const { log } = quiet()
  const code = await runRetroCheck({ 'check-retrosheet': true, nohitters: listDir(), index: indexDir(), report: file }, { get: neverCalled, log })
  assert.equal(code, 0)
  const written = JSON.parse((await import('node:fs')).readFileSync(file, 'utf8'))
  assert.equal(written.counts.matched, 1)
})
