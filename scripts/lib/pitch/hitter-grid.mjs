// THE HITTER GRID — the batter's half of the pitch sweep (#1411 Part B, ADR-0096).
//
// The command grid (../command-grid.mjs) counts where a PITCHER put each pitch.
// This counts the same pitches for the HITTER who saw them: by pitch type, by
// the pitcher's hand, by the side the hitter stood on, in the same 5x5 cells
// and the same feed frame. It reads the feed gen-pitch-arsenal.mjs already
// holds, so it costs no fetch for a new game. The Matchup Scout rolls the cells
// up into its 13 regions at read time (src/lib/zone/regions.js).
// MLB only for now: gen-pitch-arsenal.mjs asks this half of an MLB game only.
//
// Counters per cell, all sums: pitches, swings, whiffs, PA-ending pitches, the
// fixed part of the wOBA numerator, balls in play with no launch data, and the
// xwOBA (est.) of each tracked ball in play, from the table of the game's own
// season (./xwoba.mjs, ADR-0097). With no table on file, that last one is
// NULL: unknown, not 0. Then called strikes, balls in play and the start speed
// (#1911): a row swept before them holds NULL there, and stays NULL.
// A foul tip is a whiff here, as on Savant (#1911). The shared WHIFF_CODES leave it out.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GRID, commandCell, normalizePitch } from '../../../src/lib/zone/zoneGeometry.js'
import { FOUL_CODES, WHIFF_CODES } from '../../../src/api/playbyplay/pitchInfo.js'
import { CALLED_STRIKE_COMMAND_CODES, INPLAY_COMMAND_CODES, parseCells } from '../command-grid.mjs'
import { isPlateAppearance } from '../long-at-bats.mjs'
import { bucketsOf, writeSeasons, writeShards } from '../io.js'
import { xwobaOf } from './xwoba.mjs'
import { FIELDS, PLATE_FIELDS } from '../../../src/api/scout/hitterGrid.js'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data', 'hitter-grid')

// A counter's name in the file (the reader's list), and its column, index for index.
// The plate counters live in pitch_hitter_plate (see schema.sql), the rest in pitch_hitter_cells.
const COLS = FIELDS.map((f) => f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`))
const CELL_FIELDS = FIELDS.slice(0, FIELDS.length - PLATE_FIELDS.length)
const CELL_COLS = COLS.slice(0, CELL_FIELDS.length)
const PLATE_COLS = COLS.slice(CELL_COLS.length)
// Savant's woba_value for the PA ends that need no estimate: 0.7 for these,
// 0 for a strikeout and every other out (#1411, the Part C spike).
const WOBA_07 = new Set(['walk', 'hit_by_pitch', 'catcher_interf'])
// PA ends that an xwOBA mean leaves out: Savant's board skips sac bunts, and
// wOBA gives an intentional walk no denominator.
const NOT_IN_MEAN = new Set(['sac_bunt', 'sac_bunt_double_play', 'intent_walk'])
const round = (v) => Math.round(v * 1e4) / 1e4
const isHand = (c) => c === 'L' || c === 'R'

// Pure: one game's feed and its season's xwOBA table (null: none) -> Map `${hitterId}:${code}:${pitcherHand}:${stand}` ->
// { pitches, swings, whiffs, paEnd, wobaFixed, bipUntracked, xwobaBip, calledStrikes, inPlay, speedSum }, each
// 25 values, except xwobaBip: null with no table. The hand and
// the side come from the MATCHUP, so a switch hitter counts on the side he took.
// ponytail: the play's final matchup names the hand, the side and the hitter for
// every pitch of the play, as the pitcher grids do. A mid-PA reliever or pinch
// hitter files the earlier pitches under the new man (0 such PAs in 8 sampled
// games). Split the play at a substitution event if the counts ever drift.
export function aggregateGameHitters(feed, table = null) {
  const out = new Map()
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const hitterId = play.matchup?.batter?.id
    const throws = play.matchup?.pitchHand?.code
    const stand = play.matchup?.batSide?.code
    if (hitterId == null || !isHand(throws) || !isHand(stand)) continue
    const type = play.result?.eventType
    const events = play.playEvents ?? []
    // An allow list: a runner out that ends the half is no PA, and his at-bat goes on.
    const isPa = isPlateAppearance(play) && !NOT_IN_MEAN.has(type)
    for (const e of events) {
      if (!e.isPitch) continue
      const code = e.details?.type?.code
      const c = e.pitchData?.coordinates
      // No tracking, no cell, as in the command grid.
      const cell = code && commandCell(normalizePitch(c?.pX, c?.pZ, e.pitchData?.strikeZoneTop, e.pitchData?.strikeZoneBottom))
      if (!cell) continue
      const key = `${hitterId}:${code}:${throws}:${stand}`
      if (!out.has(key)) out.set(key, { ...Object.fromEntries(FIELDS.map((f) => [f, new Array(GRID * GRID).fill(0)])), ...(!table && { xwobaBip: null }) })
      const b = out.get(key)
      const at = cell.index
      const call = e.details?.call?.code
      const inPlay = INPLAY_COMMAND_CODES.has(call)
      const whiff = call === 'T' || WHIFF_CODES.has(call)
      const speed = e.pitchData?.startSpeed
      b.pitches[at] += 1
      if (whiff) b.whiffs[at] += 1
      if (whiff || inPlay || FOUL_CODES.has(call)) b.swings[at] += 1
      if (CALLED_STRIKE_COMMAND_CODES.has(call)) b.calledStrikes[at] += 1
      if (inPlay) b.inPlay[at] += 1
      // ponytail: a pitch with a cell nearly always has a speed (5 games, 1,395 located pitches: 0 without), so
      // `pitches` stands as the denominator. Add a speed count if that ever drifts.
      if (typeof speed === 'number') b.speedSum[at] = round(b.speedSum[at] + speed)
      // The PA ends on the play's last event. A PA that ended on a call with
      // no pitch (an automatic strike) has no PA-ending pitch.
      if (!isPa || e !== events.at(-1)) continue
      if (inPlay && type !== 'catcher_interf') {
        const hit = e.hitData
        if (typeof hit?.launchSpeed !== 'number' || typeof hit?.launchAngle !== 'number') {
          b.bipUntracked[at] += 1
          continue
        }
        if (table) b.xwobaBip[at] = round(b.xwobaBip[at] + xwobaOf(table, hit.launchSpeed, hit.launchAngle))
      } else if (WOBA_07.has(type)) {
        b.wobaFixed[at] = round(b.wobaFixed[at] + 0.7)
      }
      b.paEnd[at] += 1
    }
  }
  return out
}

export function hitterStmts(db) {
  const key = 'season = ? AND scope = ? AND person_id = ? AND level = ? AND code = ? AND p_throws = ? AND stand = ?'
  const upsert = (table, cols) =>
    db.prepare(
      `INSERT INTO ${table} (season, scope, person_id, level, code, p_throws, stand, ${cols.join(', ')})
       VALUES (${new Array(7 + cols.length).fill('?').join(', ')})
       ON CONFLICT(season, scope, person_id, level, code, p_throws, stand) DO UPDATE SET
         ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}`,
    )
  return {
    hitterRead: db.prepare(`SELECT ${CELL_COLS.join(', ')} FROM pitch_hitter_cells WHERE ${key}`),
    hitterWrite: upsert('pitch_hitter_cells', CELL_COLS),
    plateRead: db.prepare(`SELECT ${PLATE_COLS.join(', ')} FROM pitch_hitter_plate WHERE ${key}`),
    plateWrite: upsert('pitch_hitter_plate', PLATE_COLS),
    markHitter: db.prepare('INSERT OR IGNORE INTO pitch_hitter_ingested_games (game_pk, level, date, season) VALUES (?, ?, ?, ?)'),
  }
}

// One game's hitter cells into its season's and scope's rows, read-modify-write
// like the command grid. Called inside foldGame's transaction.
export function foldHitters(stmts, { gamePk, level, date, season, scope, need }, hitters) {
  for (const [key, b] of hitters) {
    const [id, code, throws, stand] = key.split(':')
    const k = [season, scope, Number(id), level, code, throws, stand]
    const sums = (fields, cols, prior) =>
      fields.map((f, i) => {
        // NULL (a game with no xwOBA table) stays NULL: the sum is unknown.
        if (b[f] == null || (prior && prior[cols[i]] == null)) return null
        const was = parseCells(prior?.[cols[i]])
        return b[f].map((v, j) => round(v + (was[j] ?? 0))).join(',')
      })
    const prior = stmts.hitterRead.get(...k)
    const plate = stmts.plateRead.get(...k)
    stmts.hitterWrite.run(...k, ...sums(CELL_FIELDS, CELL_COLS, prior))
    // A cells row with no plate row was swept before them: no game adds a partial sum.
    if (!prior || plate) stmts.plateWrite.run(...k, ...sums(PLATE_FIELDS, PLATE_COLS, plate))
  }
  if (need.hitter) stmts.markHitter.run(gamePk, level, date, season)
}

// --- export ----------------------------------------------------------------------
const JOIN = `pitch_hitter_cells c LEFT JOIN pitch_hitter_plate p
  USING (season, scope, person_id, level, code, p_throws, stand)`
const rowsOf = (db, season, scope) =>
  db.prepare(`SELECT c.*, ${PLATE_COLS.map((x) => `p.${x}`).join(', ')} FROM ${JOIN} WHERE c.season = ? AND c.scope = ? ORDER BY person_id, level, code, p_throws, stand`).all(season, scope)

// One row into an entry { [level]: { [code]: { [pitcherHand]: { [stand]: counters } } } },
// adding onto what is there. `fields` are the counters the entry takes: an
// all-zero counter is left out.
function addRow(entry, r, fields) {
  const into = ((((entry[r.level] ??= {})[r.code] ??= {})[r.p_throws] ??= {})[r.stand] ??= {})
  for (const f of fields) {
    const arr = parseCells(r[COLS[FIELDS.indexOf(f)]])
    if (arr.some((v) => v > 0)) into[f] = arr.map((v, j) => round(v + (into[f]?.[j] ?? 0)))
  }
}

// One season and scope: `bat`, { [hitterId]: entry }, and `league`, every
// hitter's rows summed into ONE entry of the same shape, so the colour scale
// reads it with the same reader as a hitter. `xwoba`: every hitter row of the
// season, both scopes, has its estimate. One NULL row and the season has none,
// and the base entries leave xwobaBip out.
// `plate`: { bat } with the plate counters alone (#1911, they are the sibling
// NN.plate.json file, not part of the base shards), or null unless every
// hitter row of the season has its plate row.
export function exportHitterGrid(db, season, scope = 'R') {
  const { n, noXwoba, noPlate } = db.prepare(
    `SELECT COUNT(*) AS n, COUNT(*) - COUNT(xwoba_bip) AS noXwoba, COUNT(*) - COUNT(p.called_strikes) AS noPlate FROM ${JOIN} WHERE c.season = ?`,
  ).get(season)
  const xwoba = n > 0 && noXwoba === 0
  const base = CELL_FIELDS.filter((f) => xwoba || f !== 'xwobaBip')
  const bat = {}
  const league = {}
  const plate = n > 0 && noPlate === 0 ? { bat: {} } : null
  for (const r of rowsOf(db, season, scope)) {
    addRow((bat[r.person_id] ??= {}), r, base)
    addRow(league, r, base)
    if (plate) addRow((plate.bat[r.person_id] ??= {}), r, PLATE_FIELDS)
  }
  return { bat, league, xwoba, plate }
}

// Forget a season's hitter half, so the next sweep re-walks it: after a new
// xwOBA table, run `gen-pitch-arsenal.mjs --clear-hitters=<season> --since=<its first day>`.
export function clearHitterSeason(db, season) {
  for (const t of ['pitch_hitter_cells', 'pitch_hitter_plate', 'pitch_hitter_ingested_games']) db.prepare(`DELETE FROM ${t} WHERE season = ?`).run(season)
}

// MLB games the arsenal half has and the hitter half does not. Not 0 means the
// season's re-walk has not run: a file from a few nights would read as the season.
export const hitterGamesMissing = (db, season) => db.prepare(
  `SELECT COUNT(*) AS n FROM pitch_arsenal_ingested_games a WHERE a.season = ? AND a.level = 'mlb'
     AND NOT EXISTS (SELECT 1 FROM pitch_hitter_ingested_games h WHERE h.game_pk = a.game_pk AND h.level = a.level)`,
).get(season).n

// hitter-grid/{season}/{NN}.json ({ season, bat, post }) and league.json beside them.
// Writes nothing until every MLB game of the season is in the hitter ledger.
export async function writeHitterGrid(db, season) {
  const missing = hitterGamesMissing(db, season)
  if (missing) return console.log(`hitter-grid/${season}/ not written: ${missing} MLB games still owe the hitter half`)
  const [reg, post] = ['R', 'P'].map((scope) => exportHitterGrid(db, season, scope))
  if (!Object.keys(reg.bat).length) return
  const head = { season, ...(reg.xwoba && { xwoba: true }) }
  if (!reg.xwoba) console.log(`hitter-grid/${season}/ written with no xwOBA: a row has no estimate (no table, or swept before it)`)
  if (!reg.plate) console.log(`hitter-grid/${season}/ written with no plate counters: a row was swept before them, so no NN.plate.json`)
  // The plate counters ride in NN.plate.json beside each bucket, in the same writeShards call
  // (it sweeps every file it did not write). With a row swept before them, no plate file is written.
  const plateFiles = reg.plate ? bucketsOf({ season }, reg.plate.bat, post.plate.bat, 'bat').map(([k, body]) => [`${k}.plate`, body]) : []
  await writeShards(join(outDir, String(season)), [
    ...bucketsOf(head, reg.bat, post.bat, 'bat'),
    ['league', { ...head, bat: reg.league, post: post.league }],
    ...plateFiles,
  ])
  await writeSeasons(outDir, season)
}
