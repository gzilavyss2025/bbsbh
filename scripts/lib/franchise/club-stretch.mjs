// The pure half of scripts/franchise/gen-club-stretch.mjs: one club's best runs of N games in a row
// (Gary, 2026-11-16). A run counts the player's own games played, crosses seasons, and ends
// when he plays a game for another club; a return stint starts a new run. AVG and OPS need
// 3.1 plate appearances per game (the batting-title rule). One row per player, top ten.
import { BAT_MEASURES } from '../../../src/api/streaks/bestStretch.js'

export const LENGTHS = [162, 154]
export const TOP = 10
// The run rules live in the app, so Best Stretch's club filter and these boards agree.
import { bestInStints, stintsFor } from '../../../src/api/streaks/bestStretch.js'

// One player's rows for one club: { "162:hr": row, ... }, a key only where he has a run.
export function playerRows({ id, name, games }, teamId) {
  const out = {}
  const stints = stintsFor(games, teamId)
  for (const n of LENGTHS) {
    for (const m of BAT_MEASURES) {
      const b = bestInStints(stints, n, m)
      if (b) out[`${n}:${m.key}`] = { id, name, team: b.teams.join(' / '), first: b.first, last: b.last, raw: b.value, value: m.format(b.value) }
    }
  }
  return out
}

// Every player's rows for a club -> { 162: { hr: top ten, ... }, 154: { ... } }. A tie keeps
// the earlier run, then the lower id, so a re-run writes the same bytes.
export function rankBoards(rowSets) {
  const boards = {}
  for (const n of LENGTHS) {
    boards[n] = {}
    for (const m of BAT_MEASURES) {
      const rows = rowSets.map((r) => r[`${n}:${m.key}`]).filter(Boolean)
      rows.sort((a, b) => b.raw - a.raw || (a.first < b.first ? -1 : a.first > b.first ? 1 : a.id - b.id))
      boards[n][m.key] = rows.slice(0, TOP).map(({ raw, ...r }) => r)
    }
  }
  return boards
}

// The --cache file: one JSON line per player, { through, id, rows }. A line from a run with
// another --through is stale (his later games are missing), so it is not read.
export const cacheLine = (through, id, rows) => `${JSON.stringify({ through, id, rows })}\n`
export function readCache(text, through) {
  const rows = new Map()
  for (const line of text.split('\n')) {
    if (!line) continue
    const e = JSON.parse(line)
    if (e.through === through) rows.set(e.id, e.rows)
  }
  return rows
}
