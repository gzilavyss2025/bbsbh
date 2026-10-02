// The hitter grid (#1411 Part B, ADR-0096): the batter's half of the pitch
// sweep. A synthetic feed pins the counting rules, an empty database pins the
// store, and a mocked fetch pins the reader.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '../scripts/lib/db.js'
import { bucketsOf } from '../scripts/lib/io.js'
import { arsenalStatements, aggregateGamePitchTypes, exportCommandMap, exportPitchArsenal, foldGame } from '../scripts/gen-pitch-arsenal.mjs'
import { aggregateGameCommand } from '../scripts/lib/command-grid.mjs'
import { aggregateGameHitters, clearHitterSeason, exportHitterGrid, hitterGamesMissing } from '../scripts/lib/pitch/hitter-grid.mjs'
import { fitTable, xwobaOf } from '../scripts/lib/pitch/xwoba.mjs'
import { commandCell, normalizePitch } from '../src/lib/zone/zoneGeometry.js'
import { fetchHitterGridFor, fetchHitterLeague, flatRates, hitterCounters } from '../src/api/scout/hitterGrid.js'

const TOP = 3.4
const BOT = 1.6
const MID = [0, 2.5]
const UP = [0, 3.3]
const pitch = ([pX, pZ], call, hitData) => ({
  isPitch: true,
  details: { type: { code: 'FF', description: 'Four-Seam Fastball' }, call: { code: call } },
  pitchData: { coordinates: { pX, pZ }, strikeZoneTop: TOP, strikeZoneBottom: BOT, startSpeed: 95 },
  ...(hitData ? { hitData } : {}),
})
const TRACKED = { launchSpeed: 101.2, launchAngle: 14 }
const play = (events, eventType = 'field_out', { batter = 9, stand = 'R', throws = 'R' } = {}) => ({
  about: { halfInning: 'top' },
  matchup: {
    pitcher: { id: 1, fullName: 'Arm' },
    ...(batter == null ? {} : { batter: { id: batter } }),
    batSide: { code: stand },
    pitchHand: { code: throws },
  },
  result: { eventType },
  playEvents: events,
})
const feed = (plays) => ({ gameData: { teams: { away: { id: 1 }, home: { id: 2 } } }, liveData: { plays: { allPlays: plays } } })
const at = ([pX, pZ]) => commandCell(normalizePitch(pX, pZ, TOP, BOT)).index
const sum = (a) => a.reduce((x, y) => x + y, 0)
const cellOf = (out, key = '9:FF:R:R') => out.get(key)

test('each located pitch counts once, for the hitter, by pitcher hand and by the side he stood on', () => {
  const out = aggregateGameHitters(feed([
    play([pitch(MID, 'C'), pitch(UP, 'S'), pitch(MID, 'F'), pitch(UP, 'X', TRACKED)]),
    play([pitch(MID, 'B')], 'walk', { throws: 'L' }),
    play([pitch(MID, 'B')], 'walk', { stand: 'L', throws: 'L' }),
  ]))
  const r = cellOf(out)
  assert.equal(r.pitches[at(MID)], 2)
  assert.equal(r.pitches[at(UP)], 2)
  assert.equal(r.whiffs[at(UP)], 1)
  // A whiff, a foul and a ball in play are swings. A take is not.
  assert.equal(r.swings[at(UP)], 2)
  assert.equal(r.swings[at(MID)], 1)
  assert.equal(sum(cellOf(out, '9:FF:L:R').pitches), 1)
  assert.equal(sum(cellOf(out, '9:FF:L:L').pitches), 1)
  assert.equal(out.size, 3)
})

test('a foul tip is a swing and not a whiff, the same rule the pitcher grid uses', () => {
  const r = cellOf(aggregateGameHitters(feed([play([pitch(MID, 'T')], 'strikeout')])))
  assert.equal(r.swings[at(MID)], 1)
  assert.equal(r.whiffs[at(MID)], 0)
})

test('the PA-ending pitch is the last event of a plate appearance, and it carries the fixed wOBA weights', () => {
  const out = aggregateGameHitters(feed([
    play([pitch(MID, 'B'), pitch(UP, 'S')], 'strikeout'),
    play([pitch(UP, 'B')], 'walk'),
    play([pitch(UP, 'H')], 'hit_by_pitch'),
    // Catcher interference ends on an in-play code but takes 0.7, as Savant's woba_value does.
    play([pitch(MID, 'X')], 'catcher_interf'),
  ]))
  const r = cellOf(out)
  assert.equal(r.paEnd[at(UP)], 3)
  assert.equal(r.paEnd[at(MID)], 1)
  assert.equal(r.wobaFixed[at(UP)], 1.4)
  assert.equal(r.wobaFixed[at(MID)], 0.7)
})

test('a ball in play is a PA end with no fixed weight; a sac bunt or an untracked ball is not counted', () => {
  const out = aggregateGameHitters(feed([
    play([pitch(MID, 'X', TRACKED)], 'single'),
    play([pitch(UP, 'X', TRACKED)], 'sac_bunt'),
    play([pitch(UP, 'X', { launchSpeed: 88 })], 'field_out'),
  ]))
  const r = cellOf(out)
  assert.equal(r.paEnd[at(MID)], 1)
  assert.equal(r.wobaFixed[at(MID)], 0)
  assert.equal(r.paEnd[at(UP)], 0)
  assert.equal(r.pitches[at(UP)], 2)
})

// A one-value table: every ball in play estimates at 0.512.
const TABLE = fitTable([[101.2, 14, 0.512], [101.2, 14, 0.512], [101.2, 14, 0.512]])

test('a tracked ball in play adds the table\'s estimate in its cell; an untracked one adds nothing and is counted', () => {
  const plays = [
    play([pitch(MID, 'X', TRACKED)], 'single'),
    play([pitch(UP, 'X', { launchSpeed: 88 })], 'field_out'),
    play([pitch(UP, 'S')], 'strikeout'),
  ]
  const r = cellOf(aggregateGameHitters(feed(plays), TABLE))
  assert.equal(r.xwobaBip[at(MID)], xwobaOf(TABLE, 101.2, 14))
  assert.equal(r.xwobaBip[at(MID)], 0.512)
  assert.equal(sum(r.xwobaBip), 0.512)
  assert.equal(r.bipUntracked[at(UP)], 1)
  assert.equal(r.paEnd[at(UP)], 1)
  // No table for the season: the estimate is unknown, not 0. The untracked count needs no table.
  const none = cellOf(aggregateGameHitters(feed(plays)))
  assert.equal(none.xwobaBip, null)
  assert.equal(none.bipUntracked[at(UP)], 1)
})

test('no PA end for a baserunning play, an intentional walk, or a PA that ended on a call with no pitch', () => {
  const automatic = { isPitch: false, details: { call: { code: 'AC' } } }
  const out = aggregateGameHitters(feed([
    play([pitch(MID, 'B')], 'caught_stealing_2b'),
    // A half can end on a runner out that NON_PA_EVENT_TYPES does not name.
    play([pitch(MID, 'B')], 'other_out'),
    // wOBA leaves an intentional walk out of its denominator.
    play([pitch(MID, 'B')], 'intent_walk'),
    play([pitch(MID, 'S'), automatic], 'strikeout'),
  ]))
  const r = cellOf(out)
  assert.equal(r.pitches[at(MID)], 4)
  assert.equal(sum(r.paEnd), 0)
})

test('no hitter, no pitcher hand, no side or no location: the pitch is not counted', () => {
  const untracked = { isPitch: true, details: { type: { code: 'FF' }, call: { code: 'C' } }, pitchData: {} }
  const out = aggregateGameHitters(feed([
    play([pitch(MID, 'C')], 'strikeout', { batter: null }),
    play([pitch(MID, 'C')], 'strikeout', { throws: null }),
    play([pitch(MID, 'C')], 'strikeout', { stand: 'S' }),
    play([untracked], 'strikeout'),
  ]))
  assert.equal(out.size, 0)
})

// --- the store ------------------------------------------------------------------
const emptyDb = () => openDb(mkdtempSync(join(tmpdir(), 'hitter-grid-')))
const game = (plays) => {
  const f = feed(plays)
  return [aggregateGamePitchTypes(f), aggregateGameCommand(f), aggregateGameHitters(f)]
}
const atBat = (cell, eventType = 'strikeout') => play([pitch(cell, 'S')], eventType)

test('a game folds into the hitter rows of its own scope; the postseason never adds onto the regular season', async () => {
  const db = await emptyDb()
  const stmts = arsenalStatements(db)
  const fold = (gamePk, scope, plays) =>
    foldGame(db, stmts, { gamePk, level: 'mlb', date: '2026-09-30', season: 2026, scope }, ...game(plays))
  fold(1, 'R', [atBat(MID), atBat(MID)])
  fold(2, 'R', [atBat(UP)])
  const regular = exportHitterGrid(db, 2026, 'R').bat
  const counters = regular[9].mlb.FF.R.R
  assert.equal(counters.pitches[at(MID)], 2)
  assert.equal(counters.pitches[at(UP)], 1)
  assert.equal(sum(counters.paEnd), 3)

  // Same hitter, pitch type, hand and side: the one key a postseason row could overwrite.
  fold(3, 'P', [atBat(UP)])
  assert.deepEqual(exportHitterGrid(db, 2026, 'R').bat, regular)
  assert.equal(sum(exportHitterGrid(db, 2026, 'P').bat[9].mlb.FF.R.R.pitches), 1)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pitch_hitter_ingested_games').get().n, 3)
})

test('the hitter re-walk folds no pitch type and no command cell a second time', async () => {
  const db = await emptyDb()
  const stmts = arsenalStatements(db)
  const g = { gamePk: 1, level: 'mlb', date: '2026-06-01', season: 2026 }
  const plays = [atBat(MID), atBat(UP)]
  foldGame(db, stmts, { ...g, need: { arsenal: true, command: true, hitter: false } }, ...game(plays).slice(0, 2), new Map())
  const arsenal = exportPitchArsenal(db, {}, 2026).pit
  const grid = exportCommandMap(db, 2026)
  assert.deepEqual(exportHitterGrid(db, 2026, 'R').bat, {})
  // The arsenal has the game and the hitter grid does not: no hitter file may be written yet.
  assert.equal(hitterGamesMissing(db, 2026), 1)

  // The re-walk: what ingestGame builds when only the hitter half is owed.
  foldGame(db, stmts, { ...g, need: { arsenal: false, command: false, hitter: true } }, new Map(), new Map(), game(plays)[2])
  assert.deepEqual(exportPitchArsenal(db, {}, 2026).pit, arsenal)
  assert.deepEqual(exportCommandMap(db, 2026), grid)
  assert.equal(sum(exportHitterGrid(db, 2026, 'R').bat[9].mlb.FF.R.R.pitches), 2)
  assert.equal(hitterGamesMissing(db, 2026), 0)
})

test('the export drops all-zero counters, and keeps the xwOBA numerator out until a route fills it', async () => {
  const db = await emptyDb()
  const stmts = arsenalStatements(db)
  foldGame(db, stmts, { gamePk: 1, level: 'mlb', date: '2026-06-01', season: 2026 }, ...game([play([pitch(MID, 'B')], 'walk')]))
  assert.deepEqual(Object.keys(exportHitterGrid(db, 2026, 'R').bat[9].mlb.FF.R.R), ['pitches', 'paEnd', 'wobaFixed'])
  assert.equal(db.prepare('SELECT xwoba_bip FROM pitch_hitter_cells').get().xwoba_bip, null)
})

test('a game swept with no table leaves its rows\' xwOBA unknown, and the export says so', async () => {
  const db = await emptyDb()
  const stmts = arsenalStatements(db)
  const plays = [play([pitch(MID, 'X', TRACKED)], 'single'), play([pitch(MID, 'B')], 'walk')]
  const fold = (gamePk, table) => {
    const f = feed(plays)
    foldGame(db, stmts, { gamePk, level: 'mlb', date: '2026-06-01', season: 2026 },
      aggregateGamePitchTypes(f), aggregateGameCommand(f), aggregateGameHitters(f, table))
  }
  fold(1, TABLE)
  let out = exportHitterGrid(db, 2026, 'R')
  assert.equal(out.xwoba, true)
  assert.equal(out.bat[9].mlb.FF.R.R.xwobaBip[at(MID)], 0.512)
  assert.equal(out.league.mlb.FF.R.R.xwobaBip[at(MID)], 0.512)
  fold(2, null)
  fold(3, TABLE)
  // One game with no estimate makes the sum unknown: NULL stays NULL.
  assert.equal(db.prepare('SELECT xwoba_bip FROM pitch_hitter_cells').get().xwoba_bip, null)
  out = exportHitterGrid(db, 2026, 'R')
  assert.equal(out.xwoba, false)
  assert.equal(out.bat[9].mlb.FF.R.R.xwobaBip, undefined)
  assert.equal(out.bat[9].mlb.FF.R.R.paEnd[at(MID)], 6)

  // The fix: clear the season's hitter half, then re-walk with the table.
  clearHitterSeason(db, 2026)
  assert.equal(hitterGamesMissing(db, 2026), 3)
  for (const gamePk of [1, 2, 3]) {
    const f = feed(plays)
    foldGame(db, stmts, { gamePk, level: 'mlb', date: '2026-06-01', season: 2026, need: { arsenal: false, command: false, hitter: true } },
      new Map(), new Map(), aggregateGameHitters(f, TABLE))
  }
  out = exportHitterGrid(db, 2026, 'R')
  assert.equal(out.xwoba, true)
  assert.equal(out.bat[9].mlb.FF.R.R.xwobaBip[at(MID)], 1.536)
  assert.equal(out.bat[9].mlb.FF.R.R.paEnd[at(MID)], 6)
  assert.equal(hitterGamesMissing(db, 2026), 0)
})

test('the league is every hitter summed, in the same shape as one hitter', async () => {
  const db = await emptyDb()
  const stmts = arsenalStatements(db)
  foldGame(db, stmts, { gamePk: 1, level: 'mlb', date: '2026-06-01', season: 2026 }, ...game([
    atBat(MID),
    play([pitch(MID, 'S')], 'strikeout', { batter: 7 }),
    play([pitch(UP, 'B')], 'walk', { batter: 7, stand: 'L', throws: 'L' }),
  ]))
  const { league } = exportHitterGrid(db, 2026, 'R')
  assert.equal(league.mlb.FF.R.R.pitches[at(MID)], 2)
  assert.equal(league.mlb.FF.R.R.whiffs[at(MID)], 2)
  assert.equal(league.mlb.FF.L.L.wobaFixed[at(UP)], 0.7)
  assert.deepEqual(exportHitterGrid(db, 2026, 'P').league, {})
})

test('a hitter bucket keeps the postseason beside `bat`', () => {
  const buckets = Object.fromEntries(bucketsOf({ season: 2026 }, { 100: 'reg' }, { 100: 'post', 201: 'post only' }, 'bat'))
  assert.deepEqual(buckets['00'], { season: 2026, bat: { 100: 'reg' }, post: { 100: 'post' } })
  assert.deepEqual(buckets['01'], { season: 2026, bat: {}, post: { 201: 'post only' } })
})

// --- the reader -----------------------------------------------------------------
const z = (i, n) => Array.from({ length: 25 }, (_, j) => (j === i ? n : 0))
const entry = (n) => ({
  mlb: {
    FF: {
      R: { L: { pitches: z(0, n), swings: z(0, 2), whiffs: z(0, 1), paEnd: z(0, 1), wobaFixed: z(0, 0.7) } },
      L: { R: { pitches: z(1, n) }, L: { pitches: z(1, 1) } },
    },
    SL: { R: { L: { pitches: z(2, n), swings: z(2, 4) } } },
  },
})
const grid = { season: 2026, reg: entry(10), post: entry(3) }

test('hitterCounters sums the scopes, hands and types asked for, and names the stances it pooled', () => {
  const all = hitterCounters(grid, { code: 'FF' })
  assert.equal(all.pitches[0], 13)
  assert.equal(all.pitches[1], 15)
  assert.deepEqual(all.stands, ['L', 'R'])
  const vsR = hitterCounters(grid, { code: 'FF', hand: 'R', scope: 'R' })
  assert.equal(sum(vsR.pitches), 10)
  assert.equal(vsR.whiffs[0], 1)
  assert.equal(vsR.wobaFixed[0], 0.7)
  assert.deepEqual(vsR.stands, ['L'])
  // The league's colour scale compares like with like: one stance.
  assert.equal(sum(hitterCounters(grid, { code: 'FF', hand: 'L', stand: 'L' }).pitches), 2)
  assert.equal(sum(hitterCounters(grid, { scope: 'P' }).pitches), 10)
  // Until the xwOBA route lands, no wOBA sum: a partial sum would read as a low xwOBA.
  assert.equal(vsR.wobaSum, null)
  assert.equal(hitterCounters(grid, { code: 'CU' }), null)
  assert.equal(hitterCounters({ season: 2026, reg: null, post: null }, {}), null)
})

test('with the season\'s xwOBA on file, wobaSum is wobaFixed plus the estimate, cell by cell', () => {
  const withBip = { mlb: { FF: { R: { L: { pitches: z(0, 4), paEnd: z(0, 4), wobaFixed: z(0, 0.7), xwobaBip: z(0, 1.1), bipUntracked: z(0, 1) } } } } }
  const covered = { season: 2026, reg: withBip, post: entry(3), xwoba: true }
  const c = hitterCounters(covered, { code: 'FF', scope: 'R' })
  assert.equal(c.wobaSum[0], 1.8)
  assert.equal(sum(c.wobaSum), 1.8)
  assert.equal(c.bipUntracked[0], 1)
  assert.equal(flatRates(c).xwoba, 0.45)
  // The postseason part has walks and no ball in play: its sum is its fixed part.
  assert.equal(hitterCounters(covered, { code: 'FF', scope: 'P' }).wobaSum[0], 0.7)
  // No flag, no sum, even when the file holds estimates.
  assert.equal(hitterCounters({ ...covered, xwoba: undefined }, { code: 'FF' }).wobaSum, null)
})

test('flatRates is the whole-type rate per metric, wherever the pitch was thrown', () => {
  const c = hitterCounters(grid, { code: 'SL', scope: 'R' })
  assert.deepEqual(flatRates(c), { xwoba: null, whiff: 0, swing: 0.4 })
  assert.deepEqual(flatRates({ ...c, swings: z(0, 0) }), { xwoba: null, whiff: null, swing: 0 })
  // A pitch type he never saw: no counters, so no rates, and no crash.
  assert.equal(flatRates(hitterCounters(grid, { code: 'CU' })), null)
})

test('the reader reads one season, and degrades to null when the store is absent', async (t) => {
  const fetched = []
  const files = {
    '/data/hitter-grid/seasons.json': { seasons: [2026], current: 2026 },
    '/data/hitter-grid/2026/71.json': { season: 2026, bat: { 660271: entry(5) }, post: {} },
    '/data/hitter-grid/2026/league.json': { season: 2026, bat: entry(500), post: entry(50) },
    '/data/hitter-grid/2027/71.json': { season: 2027, xwoba: true, bat: { 660271: entry(5) }, post: {} },
  }
  t.mock.method(globalThis, 'fetch', async (url) => {
    fetched.push(url)
    return files[url] ? { ok: true, status: 200, json: async () => files[url] } : { ok: false, status: 404, json: async () => null }
  })
  assert.deepEqual(await fetchHitterGridFor(660271), { season: 2026, reg: entry(5), post: null })
  assert.deepEqual(await fetchHitterLeague(), { season: 2026, reg: entry(500), post: entry(50) })
  assert.equal(await fetchHitterGridFor(123), null)
  assert.equal(await fetchHitterGridFor(660271, 2025), null)
  // The file says when the season's xwOBA is on file, and the grid carries it to hitterCounters.
  assert.deepEqual(await fetchHitterGridFor(660271, 2027), { season: 2027, reg: entry(5), post: null, xwoba: true })
  assert.equal(await fetchHitterGridFor(null), null)
  assert.ok(fetched.includes('/data/hitter-grid/2026/71.json'))
})
