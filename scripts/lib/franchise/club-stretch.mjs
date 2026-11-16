// The pure half of scripts/franchise/gen-club-stretch.mjs: one club's best runs of N games in a row
// (Gary, 2026-11-16). A run counts the player's own games played, crosses seasons, and ends
// when he plays a game for another club; a return stint starts a new run. AVG and OPS need
// 3.1 plate appearances per game (the batting-title rule). One row per player, top ten.
import { BAT_MEASURES } from '../../../src/api/streaks/bestStretch.js'

export const LENGTHS = [162, 154]
export const TOP = 10
// The run rules live in the app, so Best Stretch's club filter and these boards agree.
export { PA_PER_GAME, flooredMeasure, playerBest, stintsFor } from '../../../src/api/streaks/bestStretch.js'
import { playerBest } from '../../../src/api/streaks/bestStretch.js'

// One player's rows for one club: { "162:hr": row, ... }, a key only where he has a run.
export function playerRows({ id, name, games }, teamId) {
  const out = {}
  for (const n of LENGTHS) {
    for (const m of BAT_MEASURES) {
      const b = playerBest(games, teamId, n, m)
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

// players: [{ id, name, games }] -> the club's boards.
export const clubBoards = (players, teamId) => rankBoards(players.map((p) => playerRows(p, teamId)))
