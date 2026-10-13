// Fouls by count (#1881) and per game (#1914), the half of gen-fouls.mjs that lives here so
// that file stays under its line budget: the walkers aggregateGameFouls calls, the two
// upserts, and the exports.
import { FOUL_CODES, WHIFF_CODES, pitchCallCode } from '../../../src/api/playbyplay.js'
import { HIT_EVENT_TYPES } from '../../../src/api/playbyplay/eventTypes.js'
import { INPLAY_COMMAND_CODES } from '../command-grid.mjs'
import { shardKey100 } from '../../../src/lib/shardKey.js'

const CELLS = 12 // balls 0-3 x strikes 0-2; the cell is balls * 3 + strikes
const KEYS = ['reach', 'fouls', 'swings', 'hit', 'walk', 'so', 'out']
const WALKS = new Set(['walk', 'intent_walk', 'hit_by_pitch'])
const STRIKEOUTS = new Set(['strikeout', 'strikeout_double_play'])

export const newCells = () => Object.fromEntries(KEYS.map((k) => [k, new Array(CELLS).fill(0)]))
// The batter's plate appearance in progress (`b.cur`): its count, and the cells it has been in
// (it starts in 0-0). A non-PA play (a steal) leaves it for the same batter's resumed at-bat.
const newPa = () => ({ balls: 0, strikes: 0, reached: new Set([0]) })

const endOf = (eventType) =>
  HIT_EVENT_TYPES.has(eventType) ? 'hit' : WALKS.has(eventType) ? 'walk' : STRIKEOUTS.has(eventType) ? 'so' : 'out'

// Walks one play's events for batter `b`; `fresh` starts a new plate appearance. The count
// BEFORE a pitch is the count of the event before it, pitch or not: a pitch-clock violation
// adds a ball with no pitch (gamePk 823035).
export function tallyPitches(b, fresh, play) {
  if (fresh) b.cur = newPa()
  const { cells, cur: pa } = b
  for (const e of play.playEvents ?? []) {
    if (e.isPitch) {
      const at = pa.balls * 3 + pa.strikes
      pa.reached.add(at)
      const call = pitchCallCode(e)
      const foul = !!call && FOUL_CODES.has(call)
      if (foul) cells.fouls[at] += 1
      if (foul || WHIFF_CODES.has(call) || INPLAY_COMMAND_CODES.has(call)) cells.swings[at] += 1
    }
    if (e.count) {
      pa.balls = e.count.balls ?? pa.balls
      pa.strikes = e.count.strikes ?? pa.strikes
      // A pitch-clock ball puts the PA in a count it throws from next, but the PA that began
      // at 0-0 and was given a ball before its first pitch was in 0-0 too (the start above).
      if (!e.isPitch && pa.balls < 4 && pa.strikes < 3) pa.reached.add(pa.balls * 3 + pa.strikes)
    }
  }
}

// The PA is over: it counts once in every cell it reached, under how it ended.
export function endPa({ cells, cur }, eventType) {
  const how = endOf(eventType)
  for (const at of cur.reached) {
    cells.reach[at] += 1
    cells[how][at] += 1
  }
}

// --- SQLite ------------------------------------------------------------------
export const countStatements = (db) => ({
  cells: db.prepare(
    `INSERT INTO foul_batter_counts (person_id, season, scope, count_idx, ${KEYS.join(', ')})
     VALUES (?, ?, ?, ?, ${KEYS.map(() => '?').join(', ')})
     ON CONFLICT(season, scope, person_id, count_idx) DO UPDATE SET
       ${KEYS.map((k) => `${k} = foul_batter_counts.${k} + excluded.${k}`).join(', ')}`,
  ),
  batterGame: db.prepare(
    `INSERT INTO foul_batter_games (game_pk, person_id, season, scope, pitches, fouls, whiffs)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_pk, person_id) DO UPDATE SET
       pitches = excluded.pitches, fouls = excluded.fouls, whiffs = excluded.whiffs`,
  ),
})

// One batter's game into both tables. Only the cells he reached get a row.
export function foldBatterCounts(stmts, gamePk, season, scope, id, b) {
  stmts.batterGame.run(gamePk, id, season, scope, b.pitchesSeen, b.fouls, b.whiffs)
  for (let at = 0; at < CELLS; at++) {
    if (b.cells.reach[at]) stmts.cells.run(id, season, scope, at, ...KEYS.map((k) => b.cells[k][at]))
  }
}

// --- exports -----------------------------------------------------------------
// personId -> its 12-cell arrays, for one season (or all, `season` null) and scope; and the
// league's, summed over everyone. `league` is null when no row is on file, which is every
// store until the full re-read.
export function exportByCount(db, season, scope) {
  const one = season != null
  const rows = db
    .prepare(`SELECT * FROM foul_batter_counts WHERE ${one ? 'season = ? AND' : ''} scope = ?`)
    .all(...(one ? [season] : []), scope)
  const byPerson = {}
  const league = newCells()
  for (const r of rows) {
    const cells = (byPerson[r.person_id] ??= newCells())
    for (const k of KEYS) {
      cells[k][r.count_idx] += r[k]
      league[k][r.count_idx] += r[k]
    }
  }
  return { byPerson, league: rows.length ? league : null }
}

// The middle of the best-plate-appearance foul counts of the hitters with 300+ PA, or null
// with none. `batterRows` are exportFouls' combined foul_batter_totals rows and
// `highByPerson` its personId -> foul_batter_pa_high map.
export function medianBestPa(batterRows, highByPerson) {
  const v = batterRows
    .filter((r) => r.pa >= 300)
    .map((r) => highByPerson.get(r.person_id)?.fouls ?? 0)
    .sort((a, b) => a - b)
  return v.length ? (v[(v.length - 1) >> 1] + v[v.length >> 1]) / 2 : null
}

// personId -> gamePk -> [pitches, fouls, whiffs]; both scopes, since a gamePk is in one.
export function exportGameFouls(db, season) {
  const out = {}
  for (const r of db.prepare('SELECT * FROM foul_batter_games WHERE season = ?').all(season)) {
    ;(out[r.person_id] ??= {})[r.game_pk] = [r.pitches, r.fouls, r.whiffs]
  }
  return out
}

// The per-game rows as shard entries for writeShards: `NN.games.json` beside each bucket's
// `NN.json`, because a busy bucket's per-game rows alone (about 1,300 of them) outweigh the
// bucket itself. `{ games: { personId: { gamePk: [pitches, fouls, whiffs] } } }`.
export function gameShards(byPerson, season, asOf) {
  const buckets = new Map()
  for (const [id, byGame] of Object.entries(byPerson)) {
    const key = `${shardKey100(id)}.games`
    if (!buckets.has(key)) buckets.set(key, { season, asOf, games: {} })
    buckets.get(key).games[id] = byGame
  }
  return [...buckets]
}
