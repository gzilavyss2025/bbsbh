// The rarity count for a natural cycle or an unassisted triple play (#2968):
// src/api/notable/rarityCount.js and the generator's flags (scripts/lib/notable/flags.mjs).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildRarityNotes, detectRareFeats, floorYear, gameHasUnassistedTriplePlay, isNaturalCycle, isUnassistedTriplePlay,
} from '../src/api/notable/rarityCount.js'
import { flagRow, flagRows } from '../scripts/lib/notable/flags.mjs'

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
