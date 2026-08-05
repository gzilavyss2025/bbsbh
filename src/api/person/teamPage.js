// Team page helpers. See ../person.js's header for the module's overall
// spoiler footing.

import { num, DASH } from './shared.js'
import { pitcherRole } from './identity.js'

export function ordinal(n) {
  const v = num(n)
  if (!v) return DASH
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return `${v}${s[(m - 20) % 10] ?? s[m] ?? s[0]}`
}

// This team's rank (1 = best) among all clubs for one stat. Lower-is-better for
// ERA/WHIP, higher-is-better otherwise. Returns null if the team isn't found.
export function rankTeam(leagueStats, teamId, key, lowerBetter = false) {
  const rows = (leagueStats ?? []).filter((r) => r.stat?.[key] != null)
  if (!rows.length) return null
  rows.sort((a, b) => {
    const av = num(a.stat[key])
    const bv = num(b.stat[key])
    return lowerBetter ? av - bv : bv - av
  })
  const idx = rows.findIndex((r) => r.teamId === teamId)
  return idx < 0 ? null : { rank: idx + 1, of: rows.length }
}

// The pitcher role chip label for a roster row, from hydrated season pitching.
// Select the pitching split by group name rather than by index: fetchTeamRoster
// now hydrates BOTH hitting and pitching, so stats[0] is no longer guaranteed to
// be the pitching split (a two-way arm carries a hitting split too).
export function rosterPitcherRole(rosterEntry) {
  const stats = rosterEntry?.person?.stats ?? []
  const pit = stats.find((s) => s.group?.displayName === 'pitching') ?? stats[0]
  return pitcherRole(pit?.splits?.[0]?.stat)
}

// "First Last" (natural title case) — the team page shows names this way, unlike
// the scorebook's surname-first lineup rows.
export function firstLast(person) {
  return person?.fullName ?? person?.useName ?? ''
}

// Roster sort order by position abbreviation — catcher through DH, the
// scorebook's usual reading order. Shared by the team page's roster cards and
// the pregame lineup page's full-roster fallback (see TeamInfo.jsx).
export const POS_ORDER = { C: 1, '1B': 2, '2B': 3, SS: 3.5, '3B': 4, LF: 6, CF: 7, RF: 8, OF: 6.5, DH: 9 }
