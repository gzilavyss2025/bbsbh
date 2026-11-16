// The pure half of scripts/franchise/gen-club-stretch.mjs: one club's best runs of N games in a row
// (Gary, 2026-11-16). A run counts the player's own games played, crosses seasons, and ends
// when he plays a game for another club; a return stint starts a new run. AVG and OPS need
// 3.1 plate appearances per game (the batting-title rule). One row per player, top twenty.
// Pitching (same day): 32 starts in a row, or 65 relief outings in a row, no innings floor.
// The run rules live in the app, so Best Stretch's club filter and these boards agree.
import { CLUB_PITCH_LENGTHS, MLB_SCOPE, bestInStints, clubPitchPool, measuresFor, stintsFor } from '../../../src/api/streaks/bestStretch.js'

export const LENGTHS = { hitting: [162, 154], pitching: [CLUB_PITCH_LENGTHS.starts, CLUB_PITCH_LENGTHS.relief] }
// Twenty a board: the page shows ten and a "Show 10 more" button the rest (Gary, 2026-11-16).
export const TOP = 20

// The MLB board's scope key (issue 3133): a run counts every MLB game, so it crosses trades.
export const MLB = MLB_SCOPE

// One player's rows for one club (or MLB): { "162:hr": row, ... }, a key only where he has a run.
export function playerRows({ id, name, games }, teamId, group = 'hitting') {
  const out = {}
  for (const n of LENGTHS[group]) {
    const pool = group === 'pitching' ? clubPitchPool(games, n) : games
    const stints = teamId === MLB ? [pool] : stintsFor(pool, teamId)
    for (const m of measuresFor(group)) {
      const b = bestInStints(stints, n, m, group)
      if (b) out[`${n}:${m.key}`] = { id, name, team: b.teams.join(' / '), first: b.first, last: b.last, raw: Number.isFinite(b.value) ? b.value : 1e9 /* an ERA with no outs: JSON cannot hold Infinity */, value: m.format(b.value) }
    }
  }
  return out
}

// Every player's rows for a club -> { 162: { hr: top TOP, ... }, 154: { ... } }. A tie keeps
// the earlier run, then the lower id, so a re-run writes the same bytes.
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0)

export function rankBoards(rowSets, group = 'hitting') {
  const boards = {}
  for (const n of LENGTHS[group]) {
    boards[n] = {}
    for (const m of measuresFor(group)) {
      const rows = rowSets.map((r) => r[`${n}:${m.key}`]).filter(Boolean)
      rows.sort((a, b) => cmp(m.lower ? a.raw : b.raw, m.lower ? b.raw : a.raw) || (a.first < b.first ? -1 : a.first > b.first ? 1 : a.id - b.id))
      boards[n][m.key] = rows.slice(0, TOP).map(({ raw, ...r }) => r)
    }
  }
  return boards
}

// The --cache file: one JSON line per player, { through, id, rows }. A line from a run with
// another --through is stale (his later games are missing), so it is not read.
// A line from the other --group is not read either (a line with no group is hitting).
// A line from older run rules is not read either: pitching rule 2 gives a run with a game
// missing earned runs no ERA (a rule-1 line holds its 0.00).
const RULE = { hitting: 1, pitching: 2 }
export const cacheLine = (through, id, rows, group = 'hitting') => `${JSON.stringify({ through, group, rule: RULE[group], id, rows })}\n`
export function readCache(text, through, group = 'hitting') {
  const rows = new Map()
  for (const line of text.split('\n')) {
    if (!line) continue
    const e = JSON.parse(line)
    if (e.through === through && (e.group ?? 'hitting') === group && (e.rule ?? 1) === RULE[group]) rows.set(e.id, e.rows)
  }
  return rows
}
