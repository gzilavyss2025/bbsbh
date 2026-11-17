// The rarity count (#2968): natural cycle, unassisted triple play, immaculate inning, four-homer game, four straight home runs, six-plus double plays, home run on a first MLB pitch:
// src/api/notable/rarityCount.js and the generator's flags (scripts/lib/notable/flags.mjs).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildRarityNotes, detectRareFeats, earlierList, insideParkSlams, firstPitchHomer, floorYear, gameHasUnassistedTriplePlay, fourStraightHomers, immaculateInnings, isNaturalCycle, sixDoublePlays, isUnassistedTriplePlay,
} from '../src/api/notable/rarityCount.js'
import { flagRow, flagRows } from '../scripts/lib/notable/flags.mjs'
import { candidateGames, fetchFourStraight, fourStraightRows } from '../scripts/lib/notable/fourstraight.mjs'
import { fetchImmaculate, gamesToRead, mergeWindow, readFrom } from '../scripts/lib/notable/immaculate.mjs'
import { fetchFirstPitch, firstPaCandidate, priorPlateAppearances } from '../scripts/lib/notable/rarity/firstpitch.mjs'
import { fetchItpSlams, slamCandidates } from '../scripts/lib/notable/rarity/itpslam.mjs'

const BATTER = 1
const play = (i, eventType, { batter = BATTER, half = 'top', runners = [] } = {}) => ({
  about: { atBatIndex: i, halfInning: half, inning: i + 1 },
  result: { eventType },
  matchup: { batter: { id: batter, fullName: 'Pat Hitter' } },
  runners,
})
const hits = (...types) => types.map((t, i) => play(i, t))
const credit = (id, c) => ({ player: { id }, credit: c })

test('a natural cycle is single, double, triple, home run in order', () => {
  assert.equal(isNaturalCycle(hits('single', 'double', 'triple', 'home_run'), BATTER), true)
  // other hits may fall between
  assert.equal(isNaturalCycle(hits('single', 'single', 'double', 'field_out', 'triple', 'home_run'), BATTER), true)
  // a regular cycle is not natural
  assert.equal(isNaturalCycle(hits('home_run', 'triple', 'double', 'single'), BATTER), false)
  assert.equal(isNaturalCycle(hits('double', 'single', 'triple', 'home_run'), BATTER), false)
  // only the hits up to the one that completes the cycle: HR, 1B, 2B, 3B finishes a regular
  // cycle on the triple, and a later home run does not make it natural
  assert.equal(isNaturalCycle(hits('home_run', 'single', 'double', 'triple', 'home_run'), BATTER), false)
  // another batter's hits do not count
  assert.equal(isNaturalCycle([play(0, 'single'), play(1, 'double', { batter: 2 }), play(2, 'triple'), play(3, 'home_run')], BATTER), false)
  // no plays: unknown, never false
  assert.equal(isNaturalCycle([], BATTER), null)
})

test('an unassisted triple play has one fielder on every putout and assist', () => {
  const solo = play(0, 'triple_play', { runners: [{ credits: [credit(9, 'f_putout')] }, { credits: [credit(9, 'f_putout')] }, { credits: [credit(9, 'f_putout')] }] })
  const relay = play(0, 'triple_play', { runners: [{ credits: [credit(5, 'f_assist'), credit(4, 'f_putout')] }, { credits: [credit(4, 'f_assist'), credit(3, 'f_putout')] }] })
  assert.equal(isUnassistedTriplePlay(solo), true)
  assert.equal(isUnassistedTriplePlay(relay), false)
  // the fielding side is the one not at bat: a top-half play is the home club's
  assert.equal(gameHasUnassistedTriplePlay([solo], 'home'), true)
  assert.equal(gameHasUnassistedTriplePlay([solo], 'away'), false)
  assert.equal(gameHasUnassistedTriplePlay([], 'home'), null)
  // credits with no fielder id name nobody: never one fielder by default
  const anon = play(0, 'triple_play', { runners: [{ credits: [{ credit: 'f_assist' }, { credit: 'f_putout' }] }, { credits: [{ credit: 'f_putout' }] }] })
  assert.equal(isUnassistedTriplePlay(anon), false)
  // every triple-play event type counts, as detectPlayFeat reads it
  assert.equal(gameHasUnassistedTriplePlay([{ ...solo, result: { eventType: 'grounded_into_triple_play' } }], 'home'), true)
})

test('flagRow writes the flag only when the play-by-play says', () => {
  const row = { gamePk: 7, officialDate: '2003-06-24', player: { id: BATTER }, side: 'away' }
  assert.equal(flagRow('cycles', row, { allPlays: hits('single', 'double', 'triple', 'home_run') }).natural, true)
  assert.equal(flagRow('cycles', row, { allPlays: hits('home_run', 'triple', 'double', 'single') }).natural, false)
  assert.equal('natural' in flagRow('cycles', { ...row, natural: true }, { allPlays: [] }), false)
})

test('flagRows makes one play-by-play call per game', async () => {
  const calls = []
  const get = async (path) => (calls.push(path), { allPlays: hits('single', 'double', 'triple', 'home_run') })
  const rows = [{ gamePk: 7, player: { id: BATTER } }, { gamePk: 7, player: { id: 2 } }]
  const out = await flagRows(get, 'cycles', rows)
  assert.equal(calls.length, 1)
  assert.deepEqual(out.map((r) => r.natural), [true, false])
})

test('the floor is the first year every later row is flagged', () => {
  const r = (date, natural) => ({ officialDate: date, ...(natural === undefined ? {} : { natural }) })
  assert.equal(floorYear([r('1940-05-01'), r('1950-06-25', true), r('1960-01-01', false)], 'natural'), 1950)
  // an unflagged row in a later year moves the floor past it
  assert.equal(floorYear([r('1950-06-25', true), r('1955-07-19'), r('1955-08-01', false), r('1960-01-01', true)], 'natural'), 1956)
  assert.equal(floorYear([r('1950-06-25')], 'natural'), null)
})

// ---- the note ----
const row = (gamePk, date, teamId, natural) => ({
  gamePk, officialDate: date, gameNumber: 1, away: { id: teamId }, home: { id: 999 }, side: 'away', player: { id: gamePk }, natural,
})
const docs = {
  cycles: {
    rows: [
      { ...row(1, '1940-01-01', 158), natural: undefined },
      row(2, '1950-06-25', 134, true),
      row(3, '1966-07-17', 158, true),
      row(4, '1990-01-01', 158, false),
      row(5, '2006-09-13', 140, true),
      row(6, '2026-08-01', 158, true), // tonight's own row, already in the index
    ],
  },
}
const feed = {
  gamePk: 6,
  gameData: { datetime: { officialDate: '2026-08-01' }, game: { gameNumber: 1 }, teams: { away: { id: 158, teamName: 'Brewers' } } },
}

test('the note reads the Nth since the floor and the club count, tonight not counted twice', () => {
  const [note] = buildRarityNotes(docs, feed, { kind: 'cycles', side: 'away', player: { id: 77, name: 'Pat Hitter' } })
  assert.equal(note.text, "The 4th natural cycle since 1950, the Brewers' 2nd.")
  assert.equal(note.kind, 'rarityCount')
  assert.equal(note.link, null)
})

test('no floor, no note: it never invents a count', () => {
  const bare = { cycles: { rows: docs.cycles.rows.map(({ natural, ...r }) => r) } }
  assert.deepEqual(buildRarityNotes(bare, feed, { kind: 'cycles', side: 'away' }), [])
  assert.deepEqual(buildRarityNotes(null, feed, { kind: 'cycles', side: 'away' }), [])
})

test('detectRareFeats finds a natural cycle and an unassisted triple play, and skips a regular cycle', () => {
  const solo = [{ credits: [credit(9, 'f_putout')] }]
  const plays = [...hits('single', 'double', 'triple', 'home_run'), play(4, 'triple_play', { half: 'bottom', batter: 3, runners: solo })]
  const feats = detectRareFeats({ liveData: { plays: { allPlays: plays } } })
  assert.deepEqual(feats.map((f) => [f.kind, f.side]), [['cycles', 'away'], ['tripleplays', 'away']])
  const regular = detectRareFeats({ liveData: { plays: { allPlays: hits('home_run', 'triple', 'double', 'single') } } })
  assert.deepEqual(regular, [])
})

test('the committed index flags known games (slice 1)', () => {
  const cycles = JSON.parse(readFileSync(new URL('../public/data/notable/cycles.json', import.meta.url))).rows
  const tps = JSON.parse(readFileSync(new URL('../public/data/notable/tripleplays.json', import.meta.url))).rows
  // Jim Hickman, 1963-08-07: natural. Ralph Kiner, 1950-06-25 (HR, 1B, 2B, 3B, then HR): the
  // cycle completes out of order, so not natural. JJ Bleday, 2026-08-22: not natural.
  assert.equal(cycles.find((r) => r.player.name === 'Jim Hickman' && r.officialDate === '1963-08-07').natural, true)
  assert.equal(cycles.find((r) => r.player.name === 'Ralph Kiner' && r.officialDate === '1950-06-25').natural, false)
  assert.equal(cycles.find((r) => r.player.name === 'JJ Bleday').natural, false)
  // Eric Bruntlett, 2009-08-23 (gamePk 246049): unassisted.
  assert.equal(tps.find((r) => r.gamePk === 246049).unassisted, true)
})

// ---- immaculate inning (slice 3) ----
const PITCHER = { id: 50, fullName: 'Sam Arm' }
const k = (i, { half = 'top', inning = 1, pitches = 3, pitcher = PITCHER, eventType = 'strikeout', runners = [] } = {}) => ({
  about: { atBatIndex: i, halfInning: half, inning },
  result: { eventType },
  matchup: { batter: { id: 100 + i }, pitcher },
  playEvents: Array.from({ length: pitches }, () => ({ isPitch: true })).concat([{ isPitch: false }]),
  runners,
})
// One real 1-1 count elsewhere in the game, so the game reads as one with real pitch sequences.
const SEQ = {
  about: { atBatIndex: 99, halfInning: 'bottom', inning: 9 }, result: { eventType: 'single' },
  matchup: { pitcher: { id: 9 } }, playEvents: [{ isPitch: true, count: { balls: 1, strikes: 1 } }],
}

test('an immaculate inning is three strikeouts on nine pitches by one pitcher', () => {
  assert.deepEqual(immaculateInnings([SEQ, k(0), k(1), k(2)]), [{ side: 'home', player: { id: 50, name: 'Sam Arm' } }])
  // a bottom half is the away club pitching
  assert.deepEqual(immaculateInnings([SEQ, k(0, { half: 'bottom' }), k(1, { half: 'bottom' }), k(2, { half: 'bottom' })]).map((f) => f.side), ['away'])
  // ten pitches is not immaculate
  assert.deepEqual(immaculateInnings([SEQ, k(0), k(1, { pitches: 4 }), k(2)]), [])
  // a fourth batter, or an out that is not a strikeout, is not
  assert.deepEqual(immaculateInnings([SEQ, k(0), k(1), k(2), k(3)]), [])
  assert.deepEqual(immaculateInnings([SEQ, k(0), k(1, { eventType: 'field_out' }), k(2)]), [])
  // two pitchers in the half is not
  assert.deepEqual(immaculateInnings([SEQ, k(0), k(1, { pitcher: { id: 51 } }), k(2)]), [])
  // a reliever who comes in with the bases loaded and no outs and strikes out three on nine
  // pitches counts (Brad Boxberger, gamePk 381051, 2014-05-08)
  const starter = { id: 60, fullName: 'Pat Start' }
  const onBase = (i) => k(i, { pitcher: starter, eventType: 'single', runners: [{ movement: { start: null, end: '1B' } }] })
  const held = (i) => k(i, { runners: [{ movement: { start: null, end: null } }, { movement: { start: '1B', end: '1B' } }] })
  assert.deepEqual(immaculateInnings([SEQ, onBase(0), onBase(1), onBase(2), held(3), held(4), held(5)]).map((f) => f.player.id), [50])
  // a strikeout batter who reached base is not an out
  assert.deepEqual(immaculateInnings([SEQ, k(0), k(1, { runners: [{ movement: { start: null, end: '1B' } }] }), k(2)]), [])
  // no plays: unknown
  assert.equal(immaculateInnings([]), null)
})

test('a made-up inning of nine swinging strikes with no pitch speed is unknown, not immaculate', () => {
  // The 1990s feeds fill a missing extra inning with S, S, S for each strikeout (gamePk 2342,
  // 1999-07-10, the 10th) inside a game of real sequences. A real one carries other codes or a speed.
  const ev = (code, speed) => ({ isPitch: true, details: { code }, ...(speed ? { pitchData: { startSpeed: speed } } : {}) })
  const swing = (i, speed) => ({ ...k(i), playEvents: [ev('S', speed), ev('S', speed), ev('S', speed)] })
  assert.deepEqual(immaculateInnings([SEQ, swing(0), swing(1), swing(2)]), [])
  assert.equal(immaculateInnings([SEQ, swing(0, 95), swing(1, 95), swing(2, 95)]).length, 1)
  assert.equal(immaculateInnings([SEQ, { ...swing(0), playEvents: [ev('C'), ev('S'), ev('S')] }, swing(1), swing(2)]).length, 1)
})

test('a game of stub pitches (before about 1988) is unknown, never immaculate', () => {
  // The old feeds make up a minimal count for every plate appearance: three strikes for a
  // strikeout, four balls for a walk. No pitch ever has both a ball and a strike on the count.
  const stub = [k(0), k(1), k(2), { ...k(3, { half: 'bottom', eventType: 'walk' }) }]
  assert.equal(immaculateInnings(stub), null)
  // one real 1-1 count anywhere in the game marks it as a game with real sequences
  const real = [...stub, { ...k(4, { half: 'bottom', eventType: 'single' }), playEvents: [{ isPitch: true, count: { balls: 1, strikes: 1 } }] }]
  assert.equal(immaculateInnings(real).length, 1)
})

test('the immaculate count runs from the first swept season, with the club tally', () => {
  const r = (gamePk, date, teamId) => ({ gamePk, officialDate: date, gameNumber: 1, away: { id: 999 }, home: { id: teamId }, side: 'home', player: { id: gamePk } })
  const idx = { immaculate: { coverage: { seasons: Array.from({ length: 37 }, (_, i) => 1990 + i) }, rows: [r(1, '1990-05-01', 158), r(2, '2001-05-01', 140), r(6, '2026-08-01', 158)] } }
  const night = { gamePk: 6, gameData: { datetime: { officialDate: '2026-08-01' }, game: { gameNumber: 1 }, teams: { home: { id: 158, teamName: 'Brewers' } } } }
  const [note] = buildRarityNotes(idx, night, { kind: 'immaculate', side: 'home', player: PITCHER })
  assert.equal(note.text, "The 3rd immaculate inning since 1990, the Brewers' 2nd.")
  assert.deepEqual(buildRarityNotes({ immaculate: { coverage: { seasons: [] }, rows: [] } }, night, { kind: 'immaculate', side: 'home' }), [])
})

test('detectRareFeats finds an immaculate inning', () => {
  const feats = detectRareFeats({ liveData: { plays: { allPlays: [k(0), k(1), k(2), SEQ] } } })
  assert.deepEqual(feats.map((f) => [f.kind, f.side, f.player.id]), [['immaculate', 'home', 50]])
})

test('the generator reads only games after `through` on an incremental run, and logs stub games', async () => {
  const game = (gamePk, officialDate) => ({
    gamePk, officialDate, gameType: 'R', gameNumber: 1,
    away: { id: 1, abbr: 'A', name: 'Away', runs: 0 }, home: { id: 2, abbr: 'H', name: 'Home', runs: 1 },
  })
  const map = new Map([[1, game(1, '2026-05-01')], [2, game(2, '2026-05-02')], [3, game(3, '2026-05-03')]])
  assert.deepEqual(gamesToRead(map, '2026-05-02').map((g) => g.gamePk), [2, 3])
  assert.equal(gamesToRead(map).length, 3)
  const pbp = { 2: { allPlays: [k(0), k(1), k(2), SEQ] }, 3: { allPlays: [k(0), k(1), k(2)] } }
  const calls = []
  const get = async (path) => (calls.push(path), pbp[Number(/game\/(\d+)\//.exec(path)[1])])
  const { rows, unknown } = await fetchImmaculate(get, gamesToRead(map, '2026-05-02'))
  assert.equal(calls.length, 2)
  assert.deepEqual(rows.map((r) => [r.gamePk, r.side, r.player.id]), [[2, 'home', 50]])
  assert.deepEqual(unknown, [3]) // stub pitches: never counted
})

test('only a run with no season flags is incremental, and it re-reads the last three days', () => {
  const cov = { seasons: [2025, 2026], through: '2026-06-10' }
  // a game still going when `through` was set is read again the next nights
  assert.equal(readFrom({}, cov, 2026), '2026-06-07')
  // a hand run reads every game: --season, --from with or without --to
  assert.equal(readFrom({ season: '2026' }, cov, 2026), '')
  assert.equal(readFrom({ from: '2001' }, cov, 2026), '')
  // a season the file has never swept is read whole
  assert.equal(readFrom({}, { seasons: [2025], through: '2025-10-01' }, 2026), '')
})

test('the re-read window replaces its rows, so a corrected row leaves no ghost', () => {
  const r = (gamePk, officialDate, id) => ({ gamePk, officialDate, side: 'home', player: { id } })
  const prev = [r(1, '2026-06-01', 7), r(2, '2026-06-09', 8)]
  // game 2 re-read: the pitcher credit moved to 9
  assert.deepEqual(mergeWindow(prev, '2026-06-07', [r(2, '2026-06-09', 9)]).map((x) => x.player.id), [9, 7])
  assert.deepEqual(mergeWindow(prev, '', [r(3, '2026-06-02', 5)]).map((x) => x.gamePk), [3])
})

test("a reliever's count holds only his own pitches", () => {
  // he comes in at 0-2 and fans the batter on one pitch, then two more on three each: 7 of his own
  const sub = { isPitch: false, details: { eventType: 'pitching_substitution' } }
  const mid = { ...k(0), playEvents: [{ isPitch: true }, { isPitch: true }, sub, { isPitch: true }] }
  assert.deepEqual(immaculateInnings([SEQ, mid, k(1), k(2)]), [])
})

test('the floor is the first season of an unbroken run to the newest', () => {
  const r = { gamePk: 1, officialDate: '2026-05-01', gameNumber: 1, away: { id: 999 }, home: { id: 158 }, side: 'home', player: { id: 1 } }
  const night = { gamePk: 6, gameData: { datetime: { officialDate: '2026-08-01' }, game: { gameNumber: 1 }, teams: { home: { id: 158, teamName: 'Brewers' } } } }
  const [note] = buildRarityNotes({ immaculate: { coverage: { seasons: [2001, 2025, 2026] }, rows: [r] } }, night, { kind: 'immaculate', side: 'home' })
  assert.equal(note.text, "The 2nd immaculate inning since 2025, the Brewers' 2nd.")
})

// ---- four-homer game (slice 4) ----

test('detectRareFeats finds the home run that makes four for one batter, once', () => {
  const hr = (i, batter = BATTER) => play(i, 'home_run', { batter, half: 'bottom' })
  const plays = [hr(0), hr(1), play(2, 'single'), hr(3), hr(4), hr(5), hr(6, 2)]
  const feats = detectRareFeats({ liveData: { plays: { allPlays: plays } } }).filter((f) => f.kind === 'fourhr')
  assert.deepEqual(feats.map((f) => [f.side, f.player.id]), [['home', BATTER]])
  assert.deepEqual(detectRareFeats({ liveData: { plays: { allPlays: [hr(0), hr(1), hr(2)] } } }), [])
})

test('the four-homer count runs from the first swept season, tonight not counted twice', () => {
  const r = (pk, date, club) => ({ gamePk: pk, officialDate: date, gameNumber: 1, side: 'away', away: { id: club }, home: { id: 1 } })
  const idx = { fourhr: { coverage: { seasons: Array.from({ length: 126 }, (_, i) => 1901 + i) }, rows: [r(1, '1932-06-03', 158), r(2, '2003-05-01', 140), r(6, '2026-08-01', 158)] } }
  const [note] = buildRarityNotes(idx, feed, { kind: 'fourhr', side: 'away', player: { id: 77, name: 'Pat Hitter' } })
  assert.equal(note.text, "The 3rd four-homer game since 1901, the Brewers' 2nd.")
})

test('the committed four-homer index matches the published list (slice 4)', () => {
  const doc = JSON.parse(readFileSync(new URL('../public/data/notable/fourhr.json', import.meta.url)))
  const names = doc.rows.map((r) => r.player.name)
  for (const n of ['Lou Gehrig', 'Willie Mays', 'Mike Cameron', 'J.D. Martinez']) assert.ok(names.includes(n), n)
  // 19 four-homer games from 1901 through 2025 (Wikipedia, single-game records: 21 all-time; Lowe 1894 and Delahanty 1896 are before 1901).
  assert.equal(doc.rows.filter((r) => r.officialDate < '2026').length, 19)
})

// ---- four straight home runs (slice 5) ----

test('four straight home runs is four plate appearances of one club in a row, each a home run', () => {
  const at = (i, eventType, half = 'top') => play(i, eventType, { batter: 10 + i, half })
  const hr = (i, half) => at(i, 'home_run', half)
  assert.deepEqual(fourStraightHomers([hr(0), hr(1), hr(2), hr(3)]), [{ side: 'away' }])
  // a fifth adds nothing; a new run after an out counts again
  assert.deepEqual(fourStraightHomers([hr(0), hr(1), hr(2), hr(3), hr(4), at(5, 'field_out'), hr(6), hr(7), hr(8), hr(9)]), [{ side: 'away' }, { side: 'away' }])
  // an out between breaks the run; three is not four
  assert.deepEqual(fourStraightHomers([hr(0), hr(1), at(2, 'walk'), hr(3), hr(4), hr(5)]), [])
  // the other club batting between does not break a club's run (it cannot, but the count is per club)
  assert.deepEqual(fourStraightHomers([hr(0, 'bottom'), hr(1, 'bottom'), hr(2, 'bottom'), hr(3, 'bottom')]), [{ side: 'home' }])
  assert.equal(fourStraightHomers([]), null)
})

test('detectRareFeats finds four straight home runs by the batting club', () => {
  const plays = [0, 1, 2, 3].map((i) => play(i, 'home_run', { batter: 10 + i, half: 'bottom' }))
  assert.deepEqual(detectRareFeats({ liveData: { plays: { allPlays: plays } } }), [{ kind: 'fourstraight', side: 'home' }])
})

test('the four-straight count runs from the first swept season, tonight not counted twice', () => {
  const r = (pk, date, club) => ({ gamePk: pk, officialDate: date, gameNumber: 1, side: 'away', away: { id: club }, home: { id: 1 } })
  const idx = { fourstraight: { coverage: { seasons: Array.from({ length: 126 }, (_, i) => 1901 + i) }, rows: [r(1, '1961-06-08', 158), r(2, '2006-09-18', 140), r(6, '2026-08-01', 158)] } }
  const [note] = buildRarityNotes(idx, feed, { kind: 'fourstraight', side: 'away' })
  assert.equal(note.text, "The 3rd set of four straight home runs since 1901, the Brewers' 2nd.")
  assert.equal(note.personId, null)
})

test('the four-straight sweep reads the play-by-play only of a club game with 4 or more home runs', async () => {
  const game = (pk) => ({ gamePk: pk, officialDate: '2025-05-01', gameType: 'R', gameNumber: 1, away: { id: 1, abbr: 'A', name: 'A', runs: 9 }, home: { id: 2, abbr: 'H', name: 'H', runs: 1 }, innings: [] })
  const map = new Map([[11, game(11)], [12, game(12)], [13, game(13)]])
  assert.deepEqual(candidateGames([{ stat: { homeRuns: 4 }, game: { gamePk: 11 } }, { stat: { homeRuns: 3 }, game: { gamePk: 12 } }, { stat: { homeRuns: 5 }, game: { gamePk: 99 } }], map), [11])
  const hrs = [0, 1, 2, 3].map((i) => play(i, 'home_run', { batter: 10 + i }))
  const asked = []
  const get = async (url) => {
    asked.push(url)
    if (url.includes('/teams/1/')) return { stats: [{ splits: [{ stat: { homeRuns: 4 }, game: { gamePk: 11 } }, { stat: { homeRuns: 4 }, game: { gamePk: 13 } }] }] }
    if (url.includes('/teams/')) return { stats: [{ splits: [] }] }
    if (url.includes('/game/11/')) return { allPlays: hrs }
    return { allPlays: [] }
  }
  const { rows, unknown } = await fetchFourStraight(get, map, 2025)
  assert.deepEqual(rows.map((r) => [r.gamePk, r.side]), [[11, 'away']])
  assert.deepEqual(unknown, [13])
  assert.ok(!asked.some((u) => u.includes('/game/12/')))
  assert.equal(fourStraightRows(game(11), { allPlays: [] }), null)
})

test('the committed four-straight index matches the published list from the floor (slice 5)', () => {
  const doc = JSON.parse(readFileSync(new URL('../public/data/notable/fourstraight.json', import.meta.url)))
  const runs = doc.rows.map((r) => `${r.officialDate} ${r[r.side].abbr}`).sort()
  // Wikipedia, single-game records (10 through 2020, three before 1967) plus the Cardinals, 2022-07-02.
  assert.deepEqual(runs, ['2006-09-18 LAD', '2007-04-22 BOS', '2008-08-14 CWS', '2010-08-11 AZ', '2017-07-27 WSH', '2019-06-09 WSH', '2020-08-16 CWS', '2022-07-02 STL'])
  assert.equal(doc.coverage.seasons[0], 1967)
})

// ---- six or more double plays by one club (slice 6) ----

test('six-plus double plays: every double-play event counts for the fielding club, once a game', () => {
  const dp = (i, eventType, half) => play(i, eventType, { batter: 10 + i, half })
  // the 2018 Cubs at Pittsburgh (gamePk 531236): 6 GIDP and 1 DP fielded in the bottom halves
  const cubs = [0, 1, 2, 3, 4, 5].map((i) => dp(i, 'grounded_into_double_play', 'bottom'))
  const plays = [...cubs, dp(6, 'strikeout_double_play', 'bottom'), dp(7, 'double_play', 'top'), dp(8, 'triple_play', 'top')]
  assert.deepEqual(sixDoublePlays(plays), [{ side: 'away' }])
  assert.deepEqual(sixDoublePlays(cubs.slice(1)), []) // five is not six
  assert.equal(sixDoublePlays([]), null)
  assert.deepEqual(detectRareFeats({ liveData: { plays: { allPlays: plays } } }), [{ kind: 'sixdp', side: 'away' }])
})

test('six-plus double plays: a double play inside another event counts, two separate outs do not', () => {
  const out = (playIndex) => ({ movement: { isOut: true }, details: { playIndex } })
  const gidp = (i) => play(i, 'grounded_into_double_play', { batter: 10 + i, half: 'bottom' })
  // gamePk 23759 (2005): a single where the batter is doubled off rounding second, eventType 'single'
  const singleDp = play(5, 'single', { half: 'bottom', runners: [out(0), out(0)] })
  assert.deepEqual(sixDoublePlays([0, 1, 2, 3, 4].map(gidp).concat(singleDp)), [{ side: 'away' }])
  // a pickoff, then a strikeout in the same plate appearance: two outs, two events, no double play
  const twoOuts = play(5, 'strikeout', { half: 'bottom', runners: [out(1), out(4)] })
  assert.deepEqual(sixDoublePlays([0, 1, 2, 3, 4].map(gidp).concat(twoOuts)), [])
})

test('the six-plus double play count runs from the first swept season, tonight not counted twice', () => {
  const r = (pk, date, club) => ({ gamePk: pk, officialDate: date, gameNumber: 1, side: 'away', away: { id: club }, home: { id: 1 } })
  const idx = { sixdp: { coverage: { seasons: Array.from({ length: 126 }, (_, i) => 1901 + i) }, rows: [r(1, '1942-08-14', 147), r(2, '1990-05-01', 158), r(6, '2026-08-01', 158)] } }
  const [note] = buildRarityNotes(idx, feed, { kind: 'sixdp', side: 'away' })
  assert.equal(note.text, "The 3rd game with six or more double plays since 1901, the Brewers' 2nd.")
})

test('the committed six-plus double play index holds the 7-DP games (slice 6)', () => {
  const doc = JSON.parse(readFileSync(new URL('../public/data/notable/sixdp.json', import.meta.url)))
  const games = doc.rows.map((r) => `${r.officialDate} ${r[r.side].abbr}`)
  // ESPN (#2968 sources): three clubs turned 7 in a nine-inning game.
  for (const g of ['1942-08-14 NYY', '1969-05-04 HOU', '2018-08-17 CHC']) assert.ok(games.includes(g), g)
  assert.equal(doc.coverage.seasons[0], 1901)
})

// ---- a home run on a first MLB pitch (slice 7) ----

const pitch = () => ({ isPitch: true })
const pa = (i, eventType, pitches, opts) => ({ ...play(i, eventType, opts), playEvents: Array.from({ length: pitches }, pitch) })

test('a first-pitch home run: the first plate appearance of the game is one pitch and a homer', () => {
  assert.equal(firstPitchHomer([pa(0, 'home_run', 1)], BATTER), true)
  assert.equal(firstPitchHomer([pa(0, 'home_run', 3)], BATTER), false)
  // a one-pitch homer in his second plate appearance is not his first pitch
  assert.equal(firstPitchHomer([pa(0, 'field_out', 2), pa(1, 'home_run', 1)], BATTER), false)
  assert.equal(firstPitchHomer([pa(0, 'home_run', 1, { batter: 2 })], BATTER), null)
  // a pinch hitter in at 1-0 homers on his own first pitch
  const pinch = { ...play(0, 'home_run'), playEvents: [pitch(), { details: { eventType: 'offensive_substitution' } }, pitch()] }
  assert.equal(firstPitchHomer([pinch], BATTER), true)
})

// A Final feed: the batter debuted this season, and the box score's season line (as of the game,
// read on gamePk 447906) says whether he batted before tonight.
const debutFeed = ({ debut = '2026-08-01', seasonPa = 4, tonightPa = 4, plays = [pa(0, 'home_run', 1)], type = 'R', sport = 1 } = {}) => ({
  gameData: { game: { type }, teams: { home: { sport: { id: sport } } }, datetime: { officialDate: '2026-08-01' }, players: { [`ID${BATTER}`]: { mlbDebutDate: debut } } },
  liveData: {
    plays: { allPlays: plays },
    boxscore: { teams: { away: { players: { [`ID${BATTER}`]: { seasonStats: { batting: { plateAppearances: seasonPa } }, stats: { batting: { plateAppearances: tonightPa } } } } }, home: { players: {} } } },
  },
})
const firstPitchFeats = (f) => detectRareFeats(f).filter((x) => x.kind === 'firstpitch')

test('the page finds a first-pitch home run only when it was his first plate appearance', () => {
  assert.deepEqual(firstPitchFeats(debutFeed()), [{ kind: 'firstpitch', side: 'away', player: { id: BATTER, name: 'Pat Hitter' } }])
  // debuted off the bench two days earlier, no plate appearance (Willson Contreras, 2016)
  assert.equal(firstPitchFeats(debutFeed({ debut: '2026-07-30' })).length, 1)
  // batted in an earlier game this season (game 1 of a doubleheader)
  assert.equal(firstPitchFeats(debutFeed({ seasonPa: 7 })).length, 0)
  // debuted in an earlier season: the page cannot tell, so it says nothing
  assert.equal(firstPitchFeats(debutFeed({ debut: '2025-09-01' })).length, 0)
  // a postseason or minor-league box score's season line cannot rule out an earlier MLB plate appearance
  assert.equal(firstPitchFeats(debutFeed({ type: 'F' })).length, 0)
  assert.equal(firstPitchFeats(debutFeed({ sport: 11 })).length, 0)
  // a one-pitch homer that was not his first plate appearance of the game
  assert.equal(firstPitchFeats(debutFeed({ plays: [pa(0, 'single', 2), pa(1, 'home_run', 1)] })).length, 0)
})

test('the generator takes his first game with a plate appearance, and only when it holds a homer', () => {
  const g = (pk, date, n = 1) => [pk, { gamePk: pk, officialDate: date, gameNumber: n, gameType: 'R', away: { id: 158 }, home: { id: 112 } }]
  const map = new Map([g(1, '2026-05-01'), g(2, '2026-05-02', 1), g(3, '2026-05-02', 2)])
  const split = (pk, paCount, hr) => ({ game: { gamePk: pk }, team: { id: 158 }, stat: { plateAppearances: paCount, homeRuns: hr } })
  const person = (splits) => ({ id: 9, fullName: 'Pat Hitter', mlbDebutDate: '2026-05-01', stats: [{ splits }] })
  // no plate appearance in game 1 (a defensive debut), his first comes in game 2 of the doubleheader
  assert.equal(firstPaCandidate(person([split(3, 4, 1), split(1, 0, 0), split(2, 3, 1)]), map).game.gamePk, 2)
  assert.equal(firstPaCandidate(person([split(2, 3, 0), split(3, 4, 1)]), map), null)
  const career = { stats: [{ splits: [{ season: '2024', stat: { plateAppearances: 0 } }, { season: '2025', stat: { plateAppearances: 2 } }, { season: '2026', stat: { plateAppearances: 9 } }] }] }
  assert.equal(priorPlateAppearances(career, 2026), 2)
  assert.equal(priorPlateAppearances(career, 2025), 0)
})

test('fetchFirstPitch keeps a debut first-pitch homer and checks a veteran pitcher\'s career', async () => {
  const map = new Map([[1, { gamePk: 1, officialDate: '2026-05-01', gameNumber: 1, gameType: 'R', away: { id: 158, abbr: 'MIL', name: 'Milwaukee Brewers', runs: 3 }, home: { id: 112, abbr: 'CHC', name: 'Chicago Cubs', runs: 2 } }]])
  const split = { game: { gamePk: 1 }, team: { id: 158 }, stat: { plateAppearances: 1, homeRuns: 1 } }
  const get = async (path) => {
    if (path.includes('/sports/1/players')) return { people: [{ id: 1 }, { id: 2 }] }
    if (path.includes('/people?')) return { people: [{ id: 1, fullName: 'Rook', mlbDebutDate: '2026-05-01', stats: [{ splits: [split] }] }, { id: 2, fullName: 'Vet', mlbDebutDate: '2020-05-01', stats: [{ splits: [split] }] }] }
    if (path.includes('/playByPlay')) return { allPlays: [pa(0, 'home_run', 1, { batter: 1 }), pa(1, 'home_run', 1, { batter: 2 })] }
    if (path.includes('/people/2/stats')) return { stats: [{ splits: [{ season: '2020', stat: { plateAppearances: 3 } }] }] }
    throw new Error(path)
  }
  const people = (await get('/people?')).people
  const { rows } = await fetchFirstPitch(get, map, 2026, people)
  assert.deepEqual(rows.map((r) => r.player.name), ['Rook'])
  assert.equal(rows[0].side, 'away')
})

test('the first-pitch home run count runs from 2001, tonight not counted twice', () => {
  const r = (pk, date, club) => ({ gamePk: pk, officialDate: date, gameNumber: 1, side: 'away', player: { id: pk, name: pk === 2 ? 'Akil Baddoo' : 'Kevin Kouzmanoff' }, away: { id: club }, home: { id: 1 } })
  const idx = { firstpitch: { coverage: { seasons: Array.from({ length: 26 }, (_, i) => 2001 + i) }, rows: [r(1, '2006-09-02', 114), r(2, '2021-04-04', 158), r(6, '2026-08-01', 158)] } }
  const [note] = buildRarityNotes(idx, feed, { kind: 'firstpitch', side: 'away', player: { id: 6, name: 'Pat Hitter' } })
  assert.equal(note.text, "The 3rd player since 2001 to homer on his first MLB pitch, 2nd for the Brewers.")
})

test('the committed first-pitch index holds the known 2001 to 2021 home runs (slice 7)', () => {
  const doc = JSON.parse(readFileSync(new URL('../public/data/notable/firstpitch.json', import.meta.url)))
  const names = doc.rows.map((r) => r.player.name)
  for (const n of ['Gene Stechschulte', 'Kazuo Matsui', 'Adam Wainwright', 'Kevin Kouzmanoff', 'Willson Contreras', 'Akil Baddoo']) assert.ok(names.includes(n), n)
  assert.equal(doc.coverage.seasons[0], 2001)
})

test('the fold lists every earlier player of the club, none for a club kind', () => {
  const row = (name, date) => ({ officialDate: date, gameNumber: 1, away: { abbr: 'STL' }, home: { abbr: 'CHC' }, player: { id: 1, name } })
  const three = [row('A', '2020-05-01'), row('B', '2010-05-01'), row('C', '2005-05-01')]
  const list = earlierList(three)
  assert.deepEqual(list.map((e) => `${e.name} ${e.year}`), ['A 2020', 'B 2010', 'C 2005'])
  assert.ok(list[0].path)
  assert.equal(earlierList([]), null)
  assert.equal(earlierList([{ officialDate: '2001-01-01' }]), null)
  // a row the feed left unnamed stays in the list, so it matches the count
  assert.equal(earlierList([...three, row('', '2001-05-01')])[3].name, 'Name not listed')
})

// ---- inside-the-park grand slams (slice 8) ----

const hr = (i, rbi, description, half = 'top') => ({ ...play(i, 'home_run', { half }), result: { eventType: 'home_run', rbi, description } })

test('an inside-the-park grand slam: a home run with 4 RBI whose play text says inside-the-park', () => {
  // Raimel Tapia, gamePk 663222 (2022-07-22)
  const slam = hr(0, 4, 'Raimel Tapia hits an inside-the-park grand slam (5) on a fly ball to center field.')
  assert.deepEqual(insideParkSlams([slam]), [{ side: 'away', player: { id: BATTER, name: 'Pat Hitter' } }])
  assert.deepEqual(insideParkSlams([hr(0, 4, 'Pat Hitter hits a grand slam (3) to left field.')]), [])
  assert.deepEqual(insideParkSlams([hr(0, 2, 'Pat Hitter hits an inside-the-park home run (5) on a fly ball.')]), [])
  assert.equal(insideParkSlams([]), null)
  assert.equal(insideParkSlams([hr(0, 4, 'Pat Hitter hits an inside the park grand slam (2).')]).length, 1)
  // a minor-league or spring game has no MLB count to give
  const aaa = { gameData: { teams: { home: { sport: { id: 11 } } }, game: { type: 'R' } }, liveData: { plays: { allPlays: [slam] } } }
  assert.deepEqual(detectRareFeats(aaa), [])
  assert.deepEqual(detectRareFeats({ gameData: { game: { type: 'S' } }, liveData: { plays: { allPlays: [slam] } } }), [])
  assert.deepEqual(detectRareFeats({ liveData: { plays: { allPlays: [slam] } } }).map((f) => f.kind), ['itpslam'])
})

test('the slam generator reads only games where a player homered and drove in 4 or more', async () => {
  const head = (pk) => [pk, { gamePk: pk, officialDate: '2026-05-19', gameNumber: 1, gameType: 'R', away: { id: 120, abbr: 'WSH', name: 'Washington Nationals', runs: 9 }, home: { id: 158, abbr: 'MIL', name: 'Milwaukee Brewers', runs: 2 } }]
  const map = new Map([head(1), head(2), head(3)])
  const split = (pk, homeRuns, rbi) => ({ game: { gamePk: pk }, stat: { homeRuns, rbi } })
  const people = [{ id: 1, stats: [{ splits: [split(1, 1, 4), split(2, 1, 3), split(3, 0, 5)] }] }]
  assert.deepEqual(slamCandidates(people, map), [1])
  const read = []
  const get = async (path) => {
    if (path.includes('/sports/1/players')) return { people: [{ id: 1 }] }
    if (path.includes('/people?')) return { people }
    read.push(path)
    return { allPlays: [hr(0, 4, 'Pat Hitter hits an inside-the-park grand slam (8) on a line drive.')] }
  }
  const { rows } = await fetchItpSlams(get, map, people)
  assert.equal(read.length, 1)
  assert.equal(rows[0].player.name, 'Pat Hitter')
  assert.equal(rows[0].side, 'away')
})

test('the committed slam index holds the 2001-2026 finds and counts from 2001', () => {
  const doc = JSON.parse(readFileSync(new URL('../public/data/notable/itpslam.json', import.meta.url)))
  const names = doc.rows.map((r) => r.player.name)
  for (const n of ['Aaron Altherr', 'Michael A. Taylor', 'Raimel Tapia']) assert.ok(names.includes(n), n)
  assert.equal(doc.coverage.seasons[0], 2001)
  const r = (pk, date, club) => ({ gamePk: pk, officialDate: date, gameNumber: 1, side: 'away', player: { id: pk, name: `P${pk}` }, away: { id: club }, home: { id: 1 } })
  const idx = { itpslam: { coverage: doc.coverage, rows: [r(1, '2015-09-25', 143), r(2, '2017-09-08', 158), r(6, '2026-08-01', 158)] } }
  const [note] = buildRarityNotes(idx, feed, { kind: 'itpslam', side: 'away', player: { id: 6, name: 'Pat Hitter' } })
  assert.equal(note.text, "The 3rd inside-the-park grand slam since 2001, the Brewers' 2nd.")
  assert.equal(note.earlier.length, 1)
})
