// THE TWELVE-PITCH AT-BATS (issue #1078) — the three things about this note
// that can be wrong without a run's console output showing it: which season it
// is about, what counts as a plate appearance, and what the committed file is
// allowed to contain.
//
// The last test is the one that matters most. This is the second static dataset
// in the repo built by walking finished games (the picked-game pool was the
// first, ADR-0080), and the only thing standing between it and a spoiler is
// which fields the generator chose to copy. A generator that started storing
// `result.event` would break nothing, render nothing and spoil every at-bat in
// the file.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALL_GAME_TYPES,
  POSTSEASON_GAME_TYPES,
  REGULAR_SEASON_GAME_TYPES,
  buildSeasonDoc,
  gamesToRead,
  isPlateAppearance,
  noteSeasonFor,
  pitchesIn,
  playedGamesOf,
  scanGamePlays,
  scopeOfGameType,
  sortRows,
} from '../scripts/lib/long-at-bats.mjs'
import { POSTSEASON_GAME_TYPES as SHARED_POSTSEASON } from '../scripts/lib/records/postseason.mjs'
import { atBatGamePath, ageGap, count, defaultLeagueId, years } from '../src/api/notebook.js'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// A play as the trimmed play-by-play returns it.
function play(eventType, pitches, extra = {}) {
  return {
    result: { type: 'atBat', eventType },
    about: { halfInning: 'top' },
    matchup: { batter: { id: 1, fullName: 'A Batter' }, pitcher: { id: 2, fullName: 'A Pitcher' } },
    pitchIndex: Array.from({ length: pitches }, (_, i) => i),
    ...extra,
  }
}

test('the note names the season that ENDED, not the calendar year it is read in', () => {
  // November and December: the winter has opened and it belongs to this year.
  assert.equal(noteSeasonFor({ seasonEnded: 2026 }, 2026), 2026)
  // January: statsapi has rolled the season over, the page still says 2026, and
  // so must the file. Naming 2027 here is exactly the trap #1122 found in
  // gen-minors-leaders.mjs — an empty board held until April.
  assert.equal(noteSeasonFor({ seasonEnded: 2026 }, 2027), 2026)
  // Inside the season: no phase, and the sweep is filling in the season being
  // played so the file is ready the day the winter opens.
  assert.equal(noteSeasonFor(null, 2026), 2026)
})

test('a baserunning play is not a plate appearance, though the feed types it as one', () => {
  // Every top-level play comes back with result.type 'atBat' — verified across
  // 72 games, 10 of which held one of these — so the eventType is the only
  // thing that separates them, and getting it wrong inflates the denominator.
  assert.equal(isPlateAppearance(play('strikeout', 3)), true)
  assert.equal(isPlateAppearance(play('walk', 4)), true)
  assert.equal(isPlateAppearance(play('caught_stealing_2b', 2)), false)
  assert.equal(isPlateAppearance(play('pickoff_1b', 1)), false)
  assert.equal(isPlateAppearance(play('wild_pitch', 1)), false)
  assert.equal(isPlateAppearance(play('game_advisory', 0)), false)
  assert.equal(isPlateAppearance({}), false)
})

test('a top-level play the block list never named is not a plate appearance either', () => {
  // Review of #1295: statsapi's own eventTypes list flags each of these
  // plateAppearance: false, and a block list let them through as PAs.
  for (const code of ['other_out', 'defensive_indiff', 'pickoff_error_1b', 'runner_double_play', 'stolen_base']) {
    assert.equal(isPlateAppearance(play(code, 1)), false, code)
  }
  assert.equal(isPlateAppearance(play('grounded_into_triple_play', 2)), true)
  assert.equal(isPlateAppearance(play('sac_bunt', 1)), true)
})

test('a play with no pitchIndex counts no pitches rather than crashing', () => {
  assert.equal(pitchesIn(play('single', 5)), 5)
  assert.equal(pitchesIn({ result: { eventType: 'single' } }), 0)
  assert.equal(pitchesIn(null), 0)
})

test('a game tallies its plate appearances, its long ones, and the ones with no pitches', () => {
  const plays = [
    play('strikeout', 12),
    play('single', 3),
    play('caught_stealing_2b', 2), // not a PA, and not eligible however long
    play('walk', 13, { about: { halfInning: 'bottom' } }),
    play('field_out', 0), // a PA the feed carried no pitch events for
  ]
  const out = scanGamePlays(plays, 12)
  assert.equal(out.plateAppearances, 4)
  assert.equal(out.withoutPitches, 1)
  assert.deepEqual(
    out.long.map((l) => [l.pitches, l.top]),
    [
      [12, true],
      [13, false],
    ],
  )
  assert.deepEqual(scanGamePlays(null, 12), { plateAppearances: 0, withoutPitches: 0, long: [] })
})

test('a twelve-pitch play that is a baserunning event is never a twelve-pitch at-bat', () => {
  // The pitches thrown during an inning-ending caught stealing are real, and
  // they belong to that play — but the play is not an at-bat, so it cannot
  // qualify. The batter starts a NEW at-bat next inning on a fresh count.
  const out = scanGamePlays([play('caught_stealing_3b', 14)], 12)
  assert.equal(out.long.length, 0)
  assert.equal(out.plateAppearances, 0)
})

test('the list is longest first, and ties are kept rather than trimmed', () => {
  const rows = [
    { pitches: 12, date: '2026-05-02', batter: { name: 'B' } },
    { pitches: 14, date: '2026-07-01', batter: { name: 'C' } },
    { pitches: 12, date: '2026-04-01', batter: { name: 'A' } },
  ]
  assert.deepEqual(
    sortRows(rows).map((r) => [r.pitches, r.date]),
    [
      [14, '2026-07-01'],
      [12, '2026-04-01'],
      [12, '2026-05-02'],
    ],
  )
})

test('a row opens its game at the address the slate would build', () => {
  const row = { date: '2026-07-05', away: { abbr: 'MIL' }, home: { abbr: 'ARI' } }
  assert.equal(atBatGamePath(row), '/07052026/milari/lineup1')
  assert.equal(atBatGamePath({ ...row, g: 2 }), '/07052026/milari-2/lineup1')
  assert.equal(atBatGamePath({ date: '2026-07-05' }), null)
  assert.equal(atBatGamePath(null), null)
})

test('the note formats an age as a measurement and a denominator as a count', () => {
  assert.equal(years(24), '24.0')
  assert.equal(years(19.35), '19.4')
  assert.equal(years(null), '—')
  assert.equal(count(173710), '173,710')
  assert.equal(count(undefined), '—')
  assert.equal(ageGap(19.4, 22.5), -3.1)
  assert.equal(ageGap(26, null), null)
})

test('the age note opens on the reader’s own league, not on the first in the file', () => {
  const leagues = [
    { leagueId: 116, regulars: 100, orgIds: [111, 112] },
    { leagueId: 118, regulars: 105, orgIds: [158, 119] },
    { leagueId: 126, regulars: 57, orgIds: [136] },
  ]
  // A Brewers reader lands in the league Wisconsin plays in, whatever its size.
  assert.equal(defaultLeagueId(leagues, 158), 118)
  // A reader whose club has no affiliate here gets the league standing on the
  // most players — never leagues[0], which statsapi orders arbitrarily.
  assert.equal(defaultLeagueId(leagues, 147), 118)
  assert.equal(defaultLeagueId(leagues, null), 118)
  assert.equal(defaultLeagueId([], 158), null)
})

// THE SPOILER INVARIANT, on the file that actually ships.
//
// A twelve-pitch at-bat is a LENGTH. The moment the file also carries what the
// at-bat DID — an event, an inning, a score — it stops being a length and
// starts being the play-by-play of a game the reader may still want to score.
// So this reads the bytes that are committed and states the allowed vocabulary
// positively: anything a future edit adds has to be added here too.
//
// The postseason part (ADR-0104) is held to the same list. It is checked on a
// built doc as well as on the committed files, because the committed files
// carry no `post` until the nightly run has swept a postseason game.
const BANNED =
  /^(runs|score|scores|winner|loser|isTie|inning|innings|halfInning|outs|rbi|event|eventType|result|description|linescore|decisions|awayScore|homeScore|top|gameType|series|round)$/i
const DOC_KEYS = ['season', 'generatedAt', 'threshold', 'coverage', 'rows', 'post']
const COVERAGE_KEYS = ['games', 'playedGames', 'plateAppearances', 'plateAppearancesWithoutPitches', 'complete']
const ROW_KEYS = ['pk', 'date', 'g', 'away', 'home', 'batter', 'pitcher', 'pitches']
const CLUB_KEYS = ['id', 'abbr']
const PERSON_KEYS = ['id', 'name', 'teamId']

function assertLengthOnly(doc, label) {
  for (const key of Object.keys(doc)) assert.ok(DOC_KEYS.includes(key), `${label} carries ${key}`)
  const parts = [[doc, label]]
  if (doc.post) {
    for (const key of Object.keys(doc.post)) {
      assert.ok(['coverage', 'rows'].includes(key), `${label}.post carries ${key}`)
    }
    parts.push([doc.post, `${label}.post`])
  }
  for (const [part, name] of parts) {
    for (const key of Object.keys(part.coverage)) {
      assert.ok(COVERAGE_KEYS.includes(key), `${name}.coverage carries ${key}`)
    }
    for (const row of part.rows) {
      assert.ok(row.pitches >= doc.threshold, `${name} carries a ${row.pitches}-pitch at-bat`)
      for (const key of Object.keys(row)) {
        assert.ok(ROW_KEYS.includes(key), `${name} row carries an unexpected field: ${key}`)
      }
      for (const side of ['away', 'home']) {
        for (const key of Object.keys(row[side])) {
          assert.ok(CLUB_KEYS.includes(key), `${name} ${side} carries ${key}`)
        }
      }
      for (const who of ['batter', 'pitcher']) {
        for (const key of Object.keys(row[who])) {
          assert.ok(PERSON_KEYS.includes(key), `${name} ${who} carries ${key}`)
        }
      }
    }
  }

  // And the same question asked of every key at every depth, in case the
  // shape above is the thing that changes.
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`))
    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node)) {
      assert.ok(!BANNED.test(key), `${label} carries a result-bearing key at ${path}.${key}`)
      walk(value, `${path}.${key}`)
    }
  }
  walk(doc, label)
}

test('no committed season carries anything that could say how an at-bat or a game went', () => {
  const dir = join(ROOT, 'public', 'data', 'long-at-bats')
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  assert.ok(files.length > 0, 'no seasons are committed')

  for (const file of files) {
    const doc = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    assert.equal(doc.season, Number(file.replace('.json', '')))
    assert.equal(doc.threshold, 12)
    assert.ok(doc.rows.length > 0, `${file} has no at-bats`)
    assertLengthOnly(doc, file)
  }
})

// THE POSTSEASON BESIDE THE REGULAR SEASON (ADR-0104, #1542).

// A schedule row as playedGames asks for it.
function game(pk, gameType, extra = {}) {
  return {
    gamePk: pk,
    gameType,
    officialDate: '2026-09-30',
    status: { abstractGameState: 'Final' },
    linescore: { innings: [{ num: 1 }] },
    teams: { away: { team: { id: 10, abbreviation: 'AAA' } }, home: { team: { id: 20, abbreviation: 'HHH' } } },
    ...extra,
  }
}

// One scan entry as the generator stores it: a tally and its long at-bats.
const tally = (pa, pitches = []) => ({
  pa,
  noPitch: 0,
  long: pitches.map((n) => ({
    pitches: n,
    top: true,
    batter: { id: 1, fullName: 'A Batter' },
    pitcher: { id: 2, fullName: 'A Pitcher' },
  })),
})

const build = (scanGames, games) =>
  buildSeasonDoc({ season: 2026, threshold: 12, generatedAt: 'T', scanGames, games })

test('the game-type lists are pinned: the regular season, and the four postseason rounds', () => {
  assert.equal(REGULAR_SEASON_GAME_TYPES, 'R')
  // Wild Card, Division, League Championship, World Series — never the umbrella
  // 'P' (src/api/boxlines/rows.js): it selects the same games but a pitching
  // log echoes it back as the row's own type, which hides the round.
  assert.equal(POSTSEASON_GAME_TYPES, 'F,D,L,W')
  assert.ok(!POSTSEASON_GAME_TYPES.split(',').includes('P'))
  // The same list the other postseason sweeps read; this file cannot import it
  // (a cycle through team-records.mjs), so the two are pinned equal instead.
  assert.equal(POSTSEASON_GAME_TYPES, SHARED_POSTSEASON)
  assert.equal(ALL_GAME_TYPES, 'R,F,D,L,W')
})

test('a game’s scope comes from its own gameType', () => {
  for (const t of ['F', 'D', 'L', 'W']) assert.equal(scopeOfGameType(t), 'P', t)
  for (const t of ['R', 'S', 'E', undefined]) assert.equal(scopeOfGameType(t), 'R', String(t))
})

test('a game still in play, or never played, is not counted — in either scope', () => {
  const dates = [
    {
      games: [
        game(1, 'R'),
        game(2, 'D'),
        game(3, 'D', { status: { abstractGameState: 'Live' } }),
        game(4, 'W', { status: { abstractGameState: 'Preview' } }),
        game(5, 'L', { linescore: { innings: [] } }), // Final / Postponed: no innings
        game(6, 'F', { linescore: undefined }),
      ],
    },
  ]
  assert.deepEqual(playedGamesOf(dates).map((g) => g.gamePk), [1, 2])
})

test('a game on two schedule dates is read once, from its first entry', () => {
  const dates = [
    { games: [game(7, 'D', { officialDate: '2026-10-07' })] },
    { games: [game(7, 'D', { officialDate: '2026-10-08' })] },
  ]
  const out = playedGamesOf(dates)
  assert.equal(out.length, 1)
  assert.equal(out[0].officialDate, '2026-10-07')
  assert.deepEqual(playedGamesOf(undefined), [])
})

test('a second sweep reads nothing; --rescan reads every game', () => {
  const games = [game(1, 'R'), game(2, 'D')]
  assert.deepEqual(gamesToRead(games, {}, false).map((g) => g.gamePk), [1, 2])
  const scanned = { 1: tally(30), 2: tally(30, [12]) }
  assert.deepEqual(gamesToRead(games, scanned, false), [])
  assert.deepEqual(gamesToRead(games, scanned, true).map((g) => g.gamePk), [1, 2])
})

test('a regular-season-only scan builds the file it always built, with no postseason key', () => {
  const doc = build({ 1: tally(38, [13]), 2: tally(40) }, [game(1, 'R'), game(2, 'R'), game(3, 'R')])
  assert.equal(
    JSON.stringify(doc),
    JSON.stringify({
      season: 2026,
      generatedAt: 'T',
      threshold: 12,
      coverage: { games: 2, playedGames: 3, plateAppearances: 78, plateAppearancesWithoutPitches: 0, complete: false },
      rows: [
        {
          pk: 1,
          date: '2026-09-30',
          away: { id: 10, abbr: 'AAA' },
          home: { id: 20, abbr: 'HHH' },
          batter: { id: 1, name: 'A Batter', teamId: 10 },
          pitcher: { id: 2, name: 'A Pitcher', teamId: 20 },
          pitches: 13,
        },
      ],
    }),
  )
  assert.ok(!('post' in doc))
})

test('a postseason game never adds to, or overwrites, a regular-season figure', () => {
  const regularScan = { 1: tally(38, [13]), 2: tally(40, [12]) }
  const regularGames = [game(1, 'R'), game(2, 'R')]
  const regularOnly = build(regularScan, regularGames)

  // Same at-bat length, same batter, a postseason game beside them.
  const both = build({ ...regularScan, 3: tally(35, [14, 12]) }, [...regularGames, game(3, 'D')])

  assert.deepEqual(
    { ...both, post: undefined },
    { ...regularOnly, post: undefined },
    'the regular-season part moved when a postseason game arrived',
  )
  assert.equal(both.rows.length, 2)
  assert.equal(both.coverage.plateAppearances, 78)
  assert.equal(both.coverage.complete, true)
  assert.equal(both.post.rows.length, 2)
  assert.deepEqual(both.post.rows.map((r) => r.pitches), [14, 12])
  assert.deepEqual(both.post.coverage, {
    games: 1,
    playedGames: 1,
    plateAppearances: 35,
    plateAppearancesWithoutPitches: 0,
    complete: true,
  })
})

test('a postseason game still being swept holds back only its own coverage', () => {
  const doc = build({ 1: tally(38, [13]), 3: tally(35) }, [game(1, 'R'), game(3, 'D'), game(4, 'D')])
  assert.equal(doc.coverage.complete, true) // regular season: every game read
  assert.equal(doc.post.coverage.complete, false) // game 4 is not read yet
  assert.equal(doc.post.coverage.playedGames, 2)
})

test('a postseason game the schedule no longer returns drops out, as a regular one does', () => {
  const doc = build({ 1: tally(38), 3: tally(35, [12]) }, [game(1, 'R')])
  assert.ok(!('post' in doc))
})

test('the postseason part passes the same vocabulary test as the committed files', () => {
  assertLengthOnly(build({ 1: tally(38, [13]), 3: tally(35, [14]) }, [game(1, 'R'), game(3, 'W')]), 'built doc')
  // And the check itself bites: a result key on a postseason row is caught.
  const doc = build({ 3: tally(35, [14]) }, [game(3, 'W')])
  doc.post.rows[0].result = 'strikeout'
  assert.throws(() => assertLengthOnly(doc, 'built doc'))
})
