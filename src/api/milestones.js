// The Milestone Watch data — every debuted player in an MLB org (active, IL,
// or in the minors) within reach of a round career-total milestone,
// league-wide — read from a static same-origin file
// (public/data/milestones.json) rather than computed live.
//
// Building the list needs a full MLB year-by-year stat line per debuted
// player (~1,700) plus each team's season schedule, to scale a
// projection by how often the player actually plays — dozens of statsapi
// calls per team, hundreds league-wide. scripts/gen-milestones.mjs does it on
// a cron and commits the shaped result (see .github/workflows/update-nightly-data.yml);
// this module just reads it. Same build-time-fetch pattern as rehab.js/war.js
// (see docs/data-enrichment.md §5). Counting-stat totals and projections carry
// no individual game's score — same footing as the (ungated) League Leaders
// and WAR pages — so this file needs no spoiler cutoff.
//
// Degrades to an empty list before the file exists or on any failure — a
// friendly empty state, not a broken page. Cached in-memory for the session
// since the file only changes once a day.

import { staticJson } from './staticJson.js'

export const loadMilestoneWatch = staticJson('/data/milestones.json', {
  shape: (d) => ({ players: d.players ?? [], season: d.season ?? null, generatedAt: d.generatedAt ?? null }),
  fallback: { players: [], season: null, generatedAt: null },
})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A future-season projection is just the year (per the product ask — a
// specific date two years out would be false precision); an in-season one
// gets the projected month, read off the team's actual remaining schedule.
// Shared by the player page's Milestone Watch card and the league-wide page.
export function formatMilestoneProjection(p) {
  if (!p) return null
  if (p.kind === 'year') return String(p.year)
  if (p.kind === 'date' && p.date) {
    const [y, m] = p.date.split('-')
    return m ? `${MONTHS[Number(m) - 1]} ${y}` : y
  }
  return null
}

// This one player's rows (he can be chasing more than one milestone at
// once — e.g. both 3,000 hits and 500 doubles), nearest-first. Used by the
// player page's Milestone Watch card.
export function milestonesForPlayer(watch, playerId) {
  const id = Number(playerId)
  return (watch?.players ?? [])
    .filter((p) => p.playerId === id)
    .sort((a, b) => a.remaining - b.remaining)
}

// Rows arrive one per (player, milestone) pair, already sorted rarest-club-
// first then nearest-first (see gen-milestones.mjs). A player chasing more
// than one milestone at once (e.g. both 3,000 hits and 500 doubles) would
// otherwise get one row per chase, fighting for grid space with everyone
// else — folded here into ONE card per player instead, its milestones nested
// as a stack inside, in the order they already arrived (so a group's own
// position — and the order of its milestones — stays rarity/nearest-ranked
// with no re-sort).
//
// A repeated (stat, threshold) inside one player's group is dropped, and that
// is not defensive tidiness: MLB lists a just-traded player on BOTH clubs'
// rosters for a while, so the generator saw him twice and wrote the same chase
// twice under two different clubs. gen-milestones.mjs now settles that at the
// source (dedupeRosterEntries), but the club a player is filed under is
// upstream data this app doesn't control, so the render keeps its own guard —
// the alternative was two identical lines in one card under a duplicate React
// key, which is unsupported reconciliation, not just an untidy list.
export function groupMilestoneRows(rows) {
  const groups = []
  const byId = new Map()
  for (const row of rows ?? []) {
    let group = byId.get(row.playerId)
    if (!group) {
      group = {
        playerId: row.playerId,
        playerName: row.playerName,
        teamId: row.teamId,
        teamName: row.teamName,
        position: row.position,
        milestones: [],
        seen: new Set(),
      }
      byId.set(row.playerId, group)
      groups.push(group)
    }
    const key = `${row.stat}-${row.threshold}`
    if (group.seen.has(key)) continue
    group.seen.add(key)
    group.milestones.push(row)
  }
  for (const group of groups) delete group.seen
  return groups
}
