// Unit coverage for src/api/player/prospectRankHistory.js -- the reading of one
// player's ranked years for the player page's "Prospect rankings" card
// (issue #1111). Every id below is a real player in the shipped file
// public/data/prospect-rank-history.json.
//
// The trap this file guards is a false story. The history stops at 2024, so a
// missing 2025 means "no data", and a card that drew a gap there would say a
// prospect fell off the list in a year nobody has pulled.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildProspectRankHistory } from '../scripts/lib/prospect-rank-history.mjs'
import { prospectRankView } from '../src/api/player/prospectRankHistory.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const history = JSON.parse(readFileSync(join(root, 'public/data/prospect-rank-history.json'), 'utf8'))

const view = (over) => prospectRankView({ history, currentSeason: 2026, ...over })
const ranks = (v) => v.entries.filter((e) => e.kind === 'rank').map((e) => [e.season, e.rank])

const TAILLON = 592791 // six rows, 2011-2016
const LEWIS = 668904 // six rows, 2018-2023, debuted mid-list
const PARKER = 519105 // 2008 Baseball America, then 2009-2012 MLB Pipeline
const WALCOTT = 806964 // today's #9, one history row (2024)
const CAHILL = 502239 // one row (2009, #17), not on today's list

// ---- the trajectory ----------------------------------------------------------

test('a six-year prospect reads as one row per year, in season order', () => {
  const v = view({ playerId: TAILLON, debutYear: 2016 })
  assert.deepEqual(ranks(v), [
    [2011, 18],
    [2012, 8],
    [2013, 15],
    [2014, 16],
    [2015, 31],
    [2016, 54],
  ])
})

test('each row says how deep that year\'s list ran', () => {
  const v = view({ playerId: TAILLON, debutYear: 2016 })
  const of = Object.fromEntries(v.entries.filter((e) => e.kind === 'rank').map((e) => [e.season, e.of]))
  assert.equal(of[2011], 50) // the 2009-2011 lists ran 50 deep
  assert.equal(of[2012], 100)
})

test('the debut season follows the last rank', () => {
  const v = view({ playerId: TAILLON, debutYear: 2016 })
  assert.deepEqual(v.entries.at(-1), { kind: 'debut', season: 2016 })
})

test('a debut in the middle of the years sits where it happened, not after the last rank', () => {
  const v = view({ playerId: LEWIS, debutYear: 2022 })
  const order = v.entries.map((e) => (e.kind === 'debut' ? 'debut' : e.season))
  assert.deepEqual(order, [2018, 2019, 2020, 2021, 2022, 'debut', 2023])
})

test('a player who has not debuted gets no debut row', () => {
  const v = view({ playerId: WALCOTT, debutYear: null })
  assert.equal(v.entries.some((e) => e.kind === 'debut'), false)
})

test('a single ranked year is still a card', () => {
  const v = view({ playerId: CAHILL, debutYear: 2009 })
  assert.deepEqual(ranks(v), [[2009, 17]])
  assert.equal(v.entries.find((e) => e.kind === 'rank').of, 50)
})

// ---- today's rank ------------------------------------------------------------

test('a current prospect with history ends with today\'s rank', () => {
  const v = view({ playerId: WALCOTT, currentRank: 9 })
  assert.deepEqual(ranks(v), [[2024, 71]])
  assert.deepEqual(v.entries.at(-1), { kind: 'today', rank: 9 })
})

test('today\'s rank comes after the debut row', () => {
  const v = view({ playerId: TAILLON, debutYear: 2016, currentRank: 12 })
  assert.deepEqual(v.entries.slice(-2).map((e) => e.kind), ['debut', 'today'])
})

test('no current rank, no today row', () => {
  const v = view({ playerId: WALCOTT, currentRank: null })
  assert.equal(v.entries.some((e) => e.kind === 'today'), false)
})

// ---- nothing to say ----------------------------------------------------------

test('a player with no ranked year gets no card', () => {
  assert.equal(view({ playerId: 1 }), null)
})

test('a current prospect with no history gets no card; the Prospect Card already covers him', () => {
  assert.equal(view({ playerId: 815908, currentRank: 1 }), null)
})

test('a missing file, or a malformed one, gets no card and does not throw', () => {
  assert.equal(prospectRankView({ history: null, playerId: TAILLON, currentSeason: 2026 }), null)
  assert.equal(prospectRankView({ history: {}, playerId: TAILLON, currentSeason: 2026 }), null)
  assert.equal(prospectRankView({ history: { players: {} }, playerId: TAILLON, currentSeason: 2026 }), null)
  assert.equal(view({ playerId: null }), null)
})

test('the id can arrive as a number or a string', () => {
  assert.deepEqual(ranks(view({ playerId: String(TAILLON) })), ranks(view({ playerId: TAILLON })))
})

// ---- sources and credit --------------------------------------------------------

test('a player who crosses sources names each year\'s source and credits both', () => {
  const v = view({ playerId: PARKER, debutYear: 2011 })
  const bySeason = Object.fromEntries(v.entries.filter((e) => e.kind === 'rank').map((e) => [e.season, e.sourceLabel]))
  assert.equal(bySeason[2008], 'Baseball America')
  assert.equal(bySeason[2009], 'MLB Pipeline')
  const credit = v.credits.join(' ')
  assert.match(credit, /Baseball America/)
  assert.match(credit, /MLB Pipeline/)
  assert.match(credit, /Chadwick/)
})

test('an MLB Pipeline only player is not credited to Baseball America or Chadwick', () => {
  const credit = view({ playerId: TAILLON }).credits.join(' ')
  assert.match(credit, /MLB Pipeline/)
  assert.doesNotMatch(credit, /Baseball America|Chadwick/)
})

test('each credit line prints once, oldest source first', () => {
  const { credits } = view({ playerId: PARKER })
  assert.equal(new Set(credits).size, credits.length)
  assert.match(credits[0], /Baseball America/)
})

test('a rank is a bare number: the house rule allows no "#" before it', () => {
  const v = view({ playerId: PARKER, debutYear: 2011, currentRank: 5 })
  assert.doesNotMatch(JSON.stringify(v), /#/)
})

// ---- the 2025 gap ---------------------------------------------------------------

test('the note names 2025 as no data, and never as a drop off the list', () => {
  const { note } = view({ playerId: TAILLON })
  assert.match(note, /2005/)
  assert.match(note, /2024/)
  assert.match(note, /no data for 2025/i)
  assert.doesNotMatch(note, /drop|fell|fall|left the list|out of the top/i)
})

test('the note says a missing year means he was not on that year\'s list', () => {
  assert.match(view({ playerId: TAILLON }).note, /not on that year's list/)
})

test('once the history reaches the season before this one, the note names no gap', () => {
  const { note } = view({ playerId: TAILLON, currentSeason: 2025 })
  assert.doesNotMatch(note, /no data/i)
})

test('a longer gap reads as a range', () => {
  assert.match(view({ playerId: TAILLON, currentSeason: 2027 }).note, /no data for 2025–2026/i)
})

// ---- 2005-2008 can go without a page change --------------------------------------

test('built without baseball-america, the same code reads the file with no trace of it', () => {
  const rows = JSON.parse(readFileSync(join(root, '.scratch/top-prospects-history/rows.json'), 'utf8'))
  const seasons = JSON.parse(readFileSync(join(root, '.scratch/top-prospects-history/seasons.json'), 'utf8'))
  const mlbOnly = buildProspectRankHistory({ rows, seasons, includeSources: ['mlb-pipeline'] })

  const parker = prospectRankView({ history: mlbOnly, playerId: PARKER, debutYear: 2011, currentSeason: 2026 })
  assert.deepEqual(ranks(parker), [
    [2009, 18],
    [2010, 21],
    [2011, 29],
    [2012, 26],
  ])
  assert.doesNotMatch(JSON.stringify(parker), /Baseball America|Chadwick|2005|2008/)
  assert.match(parker.note, /2009–2024/)
  // A player whose only rows were 2005-2008 is simply gone.
  const onlyOld = Object.entries(history.players).find(([, list]) => list.every((row) => row[0] <= 2008))[0]
  assert.equal(prospectRankView({ history: mlbOnly, playerId: onlyOld, currentSeason: 2026 }), null)
})

// Review of #1287: "and today's list" was in the note even with no current rank.
test('the note names today\'s list only when a current rank is drawn', () => {
  assert.doesNotMatch(view({ playerId: CAHILL }).note, /today/i)
  assert.match(view({ playerId: WALCOTT, currentRank: 9 }).note, /today's list/)
})
