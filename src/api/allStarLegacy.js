// Client-side aggregation over All-Star Rosters data (see allStarRosters.js —
// the same static public/data/all-star-rosters.json this reads) into two
// "who's ever been an All-Star" views the source page doesn't answer on its
// own: the all-time appearance leaders among CURRENTLY ACTIVE players, and
// every CURRENT roster's All-Star alumni — a player's honor travels with him
// to whichever club he's on today, not whoever he was wearing when he earned
// it (see currentRosterLegacyByTeam below).
//
// No new fetch/precompute needed for the historical half — the roster file
// already carries every season's (playerId, teamId) pairs back to 1933, so
// this is a pure re-shape of data the All-Star Rosters page already loads.
// The "current roster" half needs one live join against each club's roster
// (`fetchRosterIdsForTeams`, api/team.js), which the page fetches once and
// reuses for both sections.
//
// Selection membership carries no individual game's score (same footing as
// Awards History/League Leaders/WAR), so none of this needs spoiler gating.

const SECTIONS = ['starters', 'bullpen', 'substitutes']

// Every (player, season) recipient across every league/bucket, flattened once.
function flattenRecipients(rosters) {
  const out = []
  for (const [seasonStr, roster] of Object.entries(rosters ?? {})) {
    const season = Number(seasonStr)
    for (const leagueKey of ['AL', 'NL']) {
      const bucket = roster?.[leagueKey]
      if (!bucket) continue
      for (const sectionKey of SECTIONS) {
        for (const r of bucket[sectionKey] ?? []) {
          if (!r?.playerId) continue
          out.push({ season, playerId: r.playerId, name: r.name, teamId: r.teamId ?? null })
        }
      }
    }
  }
  return out
}

// playerId -> { playerId, name, seasons: Set<season>, teamIdBySeason: Map<season, teamId> }
function buildCareerIndex(rosters) {
  const byId = new Map()
  for (const r of flattenRecipients(rosters)) {
    let entry = byId.get(r.playerId)
    if (!entry) {
      entry = { playerId: r.playerId, name: r.name, seasons: new Set(), teamIdBySeason: new Map() }
      byId.set(r.playerId, entry)
    }
    entry.seasons.add(r.season)
    if (r.teamId) entry.teamIdBySeason.set(r.season, r.teamId)
  }
  return byId
}

function sortedYears(seasonsSet) {
  return Array.from(seasonsSet).sort((a, b) => a - b)
}

function mostRecentTeamId(entry, years) {
  for (let i = years.length - 1; i >= 0; i--) {
    const teamId = entry.teamIdBySeason.get(years[i])
    if (teamId) return teamId
  }
  return null
}

// Top `limit` all-time All-Star appearance leaders, restricted to a caller-
// supplied Set of active player ids (see fetchRosterIdsForTeams in
// api/team.js — the caller fans that out across ALL_MLB_TEAM_IDS with
// rosterType='40Man' so an injured active All-Star still counts, same
// convention as gen-callouts.mjs). Ranked by total career selections, not
// selections for any one club, since this is a career honor. Ties go to
// whoever got there first (earliest selection), so a newcomer tied on count
// doesn't leapfrog a veteran.
export function topActiveByAppearances(rosters, activeIds, limit = 10) {
  const byId = buildCareerIndex(rosters)
  const rows = []
  for (const entry of byId.values()) {
    if (!activeIds?.has(entry.playerId)) continue
    const years = sortedYears(entry.seasons)
    rows.push({
      playerId: entry.playerId,
      name: entry.name,
      count: years.length,
      years,
      teamId: mostRecentTeamId(entry, years),
    })
  }
  rows.sort((a, b) => b.count - a.count || a.years[0] - b.years[0])
  return rows.slice(0, limit)
}

// Every player CURRENTLY on a club's roster who has ever been named an
// All-Star — for ANY club, not just this one, so a veteran's honor travels
// with him to his new team's card rather than staying pinned to whoever he
// was wearing at selection time (a traded All-Star shows up on his new
// club's card, not his old one). `rosterEntriesByTeam` is the
// `{teamId: {id, position}[]}` shape `fetchRosterEntriesForTeams`
// (api/team.js) returns — the same current-roster fetch the page already
// needs for the active-leaders section above, reused here rather than
// fetched twice. `position` is his CURRENT roster position (for the card's
// position pill), not whatever he played the year he was selected. Sorted by
// total career appearance count (ties by most recent year). A teamId with no
// current honoree still gets an entry (empty array), so a caller can render
// all 30 cards unconditionally.
export function currentRosterLegacyByTeam(rosters, rosterEntriesByTeam) {
  const byId = buildCareerIndex(rosters)
  const perTeam = new Map()
  for (const [teamIdStr, entries] of Object.entries(rosterEntriesByTeam ?? {})) {
    const list = []
    for (const { id: playerId, position } of entries) {
      const entry = byId.get(playerId)
      if (!entry) continue
      const years = sortedYears(entry.seasons)
      list.push({ playerId: entry.playerId, name: entry.name, position, count: years.length, years })
    }
    list.sort((a, b) => b.count - a.count || b.years[b.years.length - 1] - a.years[a.years.length - 1])
    perTeam.set(Number(teamIdStr), list)
  }
  return perTeam
}
