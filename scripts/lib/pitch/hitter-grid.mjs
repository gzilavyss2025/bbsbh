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
// Counters per cell, all sums: pitches, swings, whiffs, PA-ending pitches, and
// the fixed part of the wOBA numerator. The xwOBA estimate for a ball in play
// is NOT here: the feed has none, and the route that supplies it is the
// owner's call (#1411). `pitch_hitter_cells.xwoba_bip` waits for it.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GRID, commandCell, normalizePitch } from '../../../src/lib/zone/zoneGeometry.js'
import { FOUL_CODES, WHIFF_CODES } from '../../../src/api/playbyplay/pitchInfo.js'
import { INPLAY_COMMAND_CODES, parseCells } from '../command-grid.mjs'
import { isPlateAppearance } from '../long-at-bats.mjs'
import { bucketsOf, writeSeasons, writeShards } from '../io.js'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data', 'hitter-grid')

// A counter's name in the file, and its column, index for index.
const FIELDS = ['pitches', 'swings', 'whiffs', 'paEnd', 'wobaFixed']
const COLS = ['pitches', 'swings', 'whiffs', 'pa_end', 'woba_fixed']
// Savant's woba_value for the PA ends that need no estimate: 0.7 for these,
// 0 for a strikeout and every other out (#1411, the Part C spike).
const WOBA_07 = new Set(['walk', 'hit_by_pitch', 'catcher_interf'])
// PA ends that an xwOBA mean leaves out: Savant's board skips sac bunts, and
// wOBA gives an intentional walk no denominator.
const NOT_IN_MEAN = new Set(['sac_bunt', 'sac_bunt_double_play', 'intent_walk'])
const round = (v) => Math.round(v * 1e4) / 1e4
const isHand = (c) => c === 'L' || c === 'R'

// Pure: one game's feed -> Map `${hitterId}:${code}:${pitcherHand}:${stand}` ->
// { pitches, swings, whiffs, paEnd, wobaFixed }, each 25 values. The hand and
// the side come from the MATCHUP, so a switch hitter counts on the side he took.
// ponytail: the play's final matchup names the hand, the side and the hitter for
// every pitch of the play, as the pitcher grids do. A mid-PA reliever or pinch
// hitter files the earlier pitches under the new man (0 such PAs in 8 sampled
// games). Split the play at a substitution event if the counts ever drift.
export function aggregateGameHitters(feed) {
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
      if (!out.has(key)) out.set(key, Object.fromEntries(FIELDS.map((f) => [f, new Array(GRID * GRID).fill(0)])))
      const b = out.get(key)
      const at = cell.index
      const call = e.details?.call?.code
      const inPlay = INPLAY_COMMAND_CODES.has(call)
      const whiff = WHIFF_CODES.has(call)
      b.pitches[at] += 1
      if (whiff) b.whiffs[at] += 1
      if (whiff || inPlay || FOUL_CODES.has(call)) b.swings[at] += 1
      // The PA ends on the play's last event. A PA that ended on a call with
      // no pitch (an automatic strike) has no PA-ending pitch.
      if (!isPa || e !== events.at(-1)) continue
      if (inPlay && type !== 'catcher_interf') {
        const hit = e.hitData
        if (typeof hit?.launchSpeed !== 'number' || typeof hit?.launchAngle !== 'number') continue
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
  return {
    hitterRead: db.prepare(`SELECT ${COLS.join(', ')} FROM pitch_hitter_cells WHERE ${key}`),
    hitterWrite: db.prepare(
      `INSERT INTO pitch_hitter_cells (season, scope, person_id, level, code, p_throws, stand, ${COLS.join(', ')})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(season, scope, person_id, level, code, p_throws, stand) DO UPDATE SET
         ${COLS.map((c) => `${c} = excluded.${c}`).join(', ')}`,
    ),
    markHitter: db.prepare('INSERT OR IGNORE INTO pitch_hitter_ingested_games (game_pk, level, date, season) VALUES (?, ?, ?, ?)'),
  }
}

// One game's hitter cells into its season's and scope's rows, read-modify-write
// like the command grid. Called inside foldGame's transaction.
export function foldHitters(stmts, { gamePk, level, date, season, scope, need }, hitters) {
  for (const [key, b] of hitters) {
    const [id, code, throws, stand] = key.split(':')
    const k = [season, scope, Number(id), level, code, throws, stand]
    const prior = stmts.hitterRead.get(...k)
    const merged = FIELDS.map((f, i) => {
      const was = parseCells(prior?.[COLS[i]])
      return b[f].map((v, j) => round(v + (was[j] ?? 0))).join(',')
    })
    stmts.hitterWrite.run(...k, ...merged)
  }
  if (need.hitter) stmts.markHitter.run(gamePk, level, date, season)
}

// --- export ----------------------------------------------------------------------
const rowsOf = (db, season, scope) =>
  db.prepare('SELECT * FROM pitch_hitter_cells WHERE season = ? AND scope = ? ORDER BY person_id, level, code, p_throws, stand').all(season, scope)

// One row into an entry { [level]: { [code]: { [pitcherHand]: { [stand]: counters } } } },
// adding onto what is there. An all-zero counter is left out.
function addRow(entry, r) {
  const into = ((((entry[r.level] ??= {})[r.code] ??= {})[r.p_throws] ??= {})[r.stand] ??= {})
  FIELDS.forEach((f, i) => {
    const arr = parseCells(r[COLS[i]])
    if (arr.some((v) => v > 0)) into[f] = arr.map((v, j) => round(v + (into[f]?.[j] ?? 0)))
  })
}

// One season and scope: `bat`, { [hitterId]: entry }, and `league`, every
// hitter's rows summed into ONE entry of the same shape, so the colour scale
// reads it with the same reader as a hitter.
export function exportHitterGrid(db, season, scope = 'R') {
  const bat = {}
  const league = {}
  for (const r of rowsOf(db, season, scope)) {
    addRow((bat[r.person_id] ??= {}), r)
    addRow(league, r)
  }
  return { bat, league }
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
  const league = { season, bat: reg.league, post: post.league }
  await writeShards(join(outDir, String(season)), [...bucketsOf({ season }, reg.bat, post.bat, 'bat'), ['league', league]])
  await writeSeasons(outDir, season)
}
