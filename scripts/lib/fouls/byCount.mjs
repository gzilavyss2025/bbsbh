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
// adds a ball with no pitch (gamePk 823035). The pitcher `p` of the play gets the same
// tallies (#1993): the pitches he threw, so his cells sum to his own `fouls`.
export function tallyPitches(b, fresh, play, p) {
  if (fresh) b.cur = newPa()
  const sides = p ? [b.cells, p.cells] : [b.cells]
  const pa = b.cur
  for (const e of play.playEvents ?? []) {
    if (e.isPitch) {
      const at = pa.balls * 3 + pa.strikes
      pa.reached.add(at)
      const call = pitchCallCode(e)
      const foul = !!call && FOUL_CODES.has(call)
      const swing = foul || WHIFF_CODES.has(call) || INPLAY_COMMAND_CODES.has(call)
      for (const c of sides) {
        if (foul) c.fouls[at] += 1
        if (swing) c.swings[at] += 1
      }
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

// The PA is over: it counts once in every cell it reached, under how it ended, for the batter
// and for the pitcher `p` who finished it. A PA cut off by a caught stealing never gets here.
export function endPa({ cells, cur }, eventType, p) {
  const how = endOf(eventType)
  for (const c of p ? [cells, p.cells] : [cells]) {
    for (const at of cur.reached) {
      c.reach[at] += 1
      c[how][at] += 1
    }
  }
}

// --- SQLite ------------------------------------------------------------------
const cellsStatement = (db, table) =>
  db.prepare(
    `INSERT INTO ${table} (person_id, season, scope, count_idx, ${KEYS.join(', ')})
     VALUES (?, ?, ?, ?, ${KEYS.map(() => '?').join(', ')})
     ON CONFLICT(season, scope, person_id, count_idx) DO UPDATE SET
       ${KEYS.map((k) => `${k} = ${table}.${k} + excluded.${k}`).join(', ')}`,
  )
export const countStatements = (db) => ({
  cells: cellsStatement(db, 'foul_batter_counts'),
  pitcherCells: cellsStatement(db, 'foul_pitcher_counts'),
  batterGame: db.prepare(
    `INSERT INTO foul_batter_games (game_pk, person_id, season, scope, pitches, fouls, whiffs)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_pk, person_id) DO UPDATE SET
       pitches = excluded.pitches, fouls = excluded.fouls, whiffs = excluded.whiffs`,
  ),
})

// One player's game of cells into `stmt`'s table. Only the cells with a count get a row. `reach` alone
// is not the test: a PA that a caught stealing or a pickoff ends never ends as a PA, so its pitches
// are in `fouls`/`swings` with no `reach`, and dropping that row lost them from the cell sums.
function foldCells(stmt, season, scope, id, cells) {
  for (let at = 0; at < CELLS; at++) {
    if (KEYS.some((k) => cells[k][at])) stmt.run(id, season, scope, at, ...KEYS.map((k) => cells[k][at]))
  }
}

// One batter's game into both tables.
export function foldBatterCounts(stmts, gamePk, season, scope, id, b) {
  stmts.batterGame.run(gamePk, id, season, scope, b.pitchesSeen, b.fouls, b.whiffs)
  foldCells(stmts.cells, season, scope, id, b.cells)
}

// One batter's game into his season row, his best-PA row and his by-count rows; one pitcher's game
// into his season row. foldGame calls these for every ingested game, and so does --rebuild-counts,
// so the totals and the cells can never come from different rules.
export function foldBatterTotals(stmts, gamePk, season, scope, id, b) {
  stmts.batter.run(
    id, season, scope, b.name, b.teamId, b.pa, b.pitchesSeen, b.fouls, b.twoStrikeFouls,
    b.gameFouls, gamePk, b.pa, b.pitchesSeen, b.opponentId, b.gameHisScore, b.gameOppScore,
  )
  foldBatterCounts(stmts, gamePk, season, scope, id, b)
  if (b.bestPa) {
    const pa = b.bestPa
    stmts.batterPaHigh.run(
      id, season, scope, b.bestPaFouls, gamePk, pa.pitcherId, pa.pitcherName, pa.resultEvent,
      pa.resultType, pa.resultDescription, pa.paPitches, pa.inning, pa.half, pa.outs,
      pa.onFirst ? 1 : 0, pa.onSecond ? 1 : 0, pa.onThird ? 1 : 0, pa.awayScore,
      pa.homeScore, pa.battingTeamId, pa.opponentId,
    )
  }
}

export function foldPitcherTotals(stmts, season, scope, id, p) {
  stmts.pitcher.run(id, season, scope, p.name, p.teamId, p.isStarter ? 1 : 0, p.pitches, p.fouls, p.whiffs)
  foldCells(stmts.pitcherCells, season, scope, id, p.cells)
}

// --- exports -----------------------------------------------------------------
const sum = (a) => a.reduce((n, x) => n + x, 0)
// A batter's cells cover every PA he has when the 0-0 count (every PA starts there) is all of them.
// A pitcher's cover every pitch he threw when the fouls in the cells are all of his.
export const batterCovered = (cells, r) => cells.reach[0] === r.pa
export const pitcherCovered = (cells, r) => sum(cells.fouls) === r.fouls

// personId -> its 12-cell arrays, for one season (or all, `season` null) and scope; and the
// league's, summed over them. Only a player whose cells are `covered` by his season row is kept:
// a store part-read since the cells were added shows none until the full re-read, never a few
// nights' games as a season. `league` is null with none; only the batters' is read (#1993).
export function exportByCount(db, table, season, scope, totalRows, covered) {
  const one = season != null
  const rows = db
    .prepare(`SELECT * FROM ${table} WHERE ${one ? 'season = ? AND' : ''} scope = ?`)
    .all(...(one ? [season] : []), scope)
  const all = {}
  for (const r of rows) {
    const cells = (all[r.person_id] ??= newCells())
    for (const k of KEYS) cells[k][r.count_idx] += r[k]
  }
  const byPerson = {}
  const league = newCells()
  for (const r of totalRows) {
    const id = r.person_id
    if (!all[id] || !covered(all[id], r)) continue
    byPerson[id] = all[id]
    for (const k of KEYS) all[id][k].forEach((n, i) => (league[k][i] += n))
  }
  return { byPerson, league: Object.keys(byPerson).length ? league : null }
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
// bucket itself. No `asOf`: a bucket with no new game then stays byte for byte as it was.
// `{ games: { personId: { gamePk: [pitches, fouls, whiffs] } } }`.
export function gameShards(byPerson, season) {
  const buckets = new Map()
  for (const [id, byGame] of Object.entries(byPerson)) {
    const key = `${shardKey100(id)}.games`
    if (!buckets.has(key)) buckets.set(key, { season, games: {} })
    buckets.get(key).games[id] = byGame
  }
  return [...buckets]
}
