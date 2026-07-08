// The standalone "Rehab Assignments" page's data — the players currently on a
// major-league rehab assignment, league-wide. Unlike the player page (which
// reads one player's own transaction feed), this scans a recent window of EVERY
// club's roster moves in a single request, so it gets its own small module
// (mirroring prospects.js's split from the per-player fetchers). Spoiler-free:
// roster moves carry no score, same as the transaction timeline it shares logic
// with (see selectActiveRehabAssignments in person.js).

import { getJson } from './statsapi.js'
import { selectActiveRehabAssignments } from './person.js'
import { SPORT_LABEL } from '../lib/teams.js'

// A rehab assignment can't run longer than ~30 days (20 for a position player),
// so a 40-day window always contains the start of every currently-active stint —
// wide enough to catch one begun before the window without pulling needless
// history.
const REHAB_WINDOW_DAYS = 40

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgo(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// The 30 MLB club ids — the fromTeam set that marks a rehab as a big leaguer's
// (vs. a purely minor-league one). Degrades to an empty set, which just yields
// an empty list rather than an error.
async function fetchMlbTeamIds() {
  try {
    const data = await getJson('/api/v1/teams?sportId=1')
    return new Set((data.teams ?? []).map((t) => t.id))
  } catch {
    return new Set()
  }
}

// Every club's transactions across a date window, one request. Degrades to [].
async function fetchLeagueTransactions(startDate, endDate) {
  try {
    const data = await getJson(`/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`)
    return data.transactions ?? []
  } catch {
    return []
  }
}

// Primary position abbreviation per player, one batched request (the transaction
// feed's person object carries no position). Degrades to {}.
async function fetchPositions(ids) {
  const list = [...new Set((ids ?? []).filter(Boolean))]
  if (!list.length) return {}
  try {
    const data = await getJson(`/api/v1/people?personIds=${list.join(',')}`)
    const out = {}
    for (const p of data.people ?? []) out[p.id] = p.primaryPosition?.abbreviation || ''
    return out
  } catch {
    return {}
  }
}

// Level (sportId) per rehab club, one batched request — the affiliate the player
// is rehabbing at (its level isn't on the transaction row). Degrades to {}.
async function fetchTeamLevels(ids) {
  const list = [...new Set((ids ?? []).filter(Boolean))]
  if (!list.length) return {}
  try {
    const data = await getJson(`/api/v1/teams?teamId=${list.join(',')}`)
    const out = {}
    for (const t of data.teams ?? []) out[t.id] = t.sport?.id ?? null
    return out
  } catch {
    return {}
  }
}

// The whole page in a handful of cheap calls and NO per-player fetches: the MLB
// club ids + a ~40-day league transaction window find the rehabbers, then two
// batched lookups fold in each player's position and each rehab club's level.
export async function loadRehabAssignments() {
  const [mlbIds, txns] = await Promise.all([
    fetchMlbTeamIds(),
    fetchLeagueTransactions(daysAgo(REHAB_WINDOW_DAYS), isoToday()),
  ])
  const rows = selectActiveRehabAssignments(txns, mlbIds)
  const [positions, levels] = await Promise.all([
    fetchPositions(rows.map((r) => r.playerId)),
    fetchTeamLevels(rows.map((r) => r.clubId)),
  ])
  return {
    players: rows.map((r) => ({
      ...r,
      position: positions[r.playerId] || '',
      level: SPORT_LABEL[levels[r.clubId]] ?? '',
    })),
  }
}
