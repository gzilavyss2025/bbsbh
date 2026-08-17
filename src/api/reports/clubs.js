// The one club-identity lookup the five report pages share.
//
// All five of them start from a bare teamId — gate.json, farm-system.json and
// workload.json each key on it and none of them ships a club name, which is
// correct: a name is identity data that already has a canonical home
// (public/data/teams.json, refreshed weekly by gen-teams.mjs) and copying it
// into three nightly files would give the app three answers to "what is club
// 158 called".
//
// So each page joins here instead. Same static file, same session memo, one
// shape: a Map from teamId to the fields a report row needs.
//
// SPOILER-FREE — names, abbreviations and division labels, nothing more.

import { fetchStaticTeams } from '../teams-static.js'

// MLB only. Every one of these pages is a thirty-club league board; a MiLB
// affiliate that appears on The Farm Report carries its own name inline from
// farm-system.json, so nothing here has to reach past sportId 1.
export async function loadClubs() {
  const data = await fetchStaticTeams()
  const teams = data?.bySportId?.['1'] ?? []
  const byId = new Map()
  for (const t of teams) {
    byId.set(t.id, {
      id: t.id,
      name: t.name,
      short: t.teamName ?? t.name,
      abbr: t.abbreviation ?? '',
      division: t.divisionName ?? '',
      league: t.leagueName ?? '',
    })
  }
  return byId
}

// A club's display name, degrading to the raw id rather than to an empty cell
// — a board row with no name is a bug worth seeing, not one worth hiding.
export function clubName(clubs, teamId) {
  return clubs?.get(teamId)?.name ?? `Club ${teamId}`
}

// The short name — 'Padres' rather than 'San Diego Padres'. What every board
// ROW uses, because the full name makes the club column wide enough on a phone
// to push all the numbers off the right edge, and the mark beside it already
// carries the city. Prose keeps clubName: a sentence saying a club drew the
// biggest crowd of the season should name it in full.
export function clubShort(clubs, teamId) {
  return clubs?.get(teamId)?.short ?? clubName(clubs, teamId)
}
