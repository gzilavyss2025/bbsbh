// Team pages — identity, roster, standings, ranked team stats.

import { getJson } from './statsapi.js'

// Basic team identity, incl. league + division ids (needed to pull the right
// standings). Degrades to null.
export async function fetchTeam(teamId) {
  if (!teamId) return null
  try {
    const data = await getJson(`/api/v1/teams/${teamId}`)
    return data.teams?.[0] ?? null
  } catch {
    return null
  }
}

// The active roster, with each player's season pitching line hydrated so the
// team page can infer starter/reliever/closer (there is no role field in the
// API). Position players simply carry no pitching stats. Degrades to [].
export async function fetchTeamRoster(teamId, season) {
  if (!teamId || !season) return []
  try {
    const data = await getJson(
      `/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person(stats(type=season,group=pitching,season=${season}))`,
    )
    return data.roster ?? []
  } catch {
    return []
  }
}

// Just the active roster's person ids — no stat hydration — for the slate's
// "N prospects on this roster" badge, which only needs to know who's on the
// roster, not their stats. Lighter than fetchTeamRoster. Degrades to [].
export async function fetchTeamRosterIds(teamId) {
  if (!teamId) return []
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=active`)
    return (data.roster ?? []).map((r) => r.person?.id).filter(Boolean)
  } catch {
    return []
  }
}

// Fan out fetchTeamRosterIds across every team on the current slate — same
// Promise.allSettled "degrade per item" idiom as fetchTeamDirectory /
// fetchMilbYearByYear, since there's no batched multi-team roster endpoint.
export async function fetchRosterIdsForTeams(teamIds) {
  const results = await Promise.allSettled(teamIds.map((id) => fetchTeamRosterIds(id)))
  const out = {}
  teamIds.forEach((id, i) => {
    out[id] = results[i].status === 'fulfilled' ? results[i].value : []
  })
  return out
}

// A club's full affiliate tree in one request, via the dedicated
// /teams/affiliates endpoint (a plain team hydrate doesn't carry this).
// `hydrate=venue(location)` folds in each affiliate's ballpark city/state
// alongside its own team id (which already drives the logo CDN), so the team
// page's affiliates section needs no per-team follow-up fetch. Filtered to
// the four full-season farm levels (AAA/AA/A+/A, sportIds 11/12/13/14) — the
// endpoint also returns complex-league/DSL/alternate-site/"Prospects" entries
// that aren't proper affiliate clubs the rest of the app tracks (see
// MILB_LEVELS). Sorted highest level first. Degrades to [].
const AFFILIATE_SPORT_IDS = [11, 12, 13, 14]
export async function fetchAffiliates(teamId, season) {
  if (!teamId || !season) return []
  try {
    const data = await getJson(
      `/api/v1/teams/affiliates?teamIds=${teamId}&season=${season}&hydrate=venue(location)`,
    )
    const teams = data.teams ?? []
    return teams
      .filter((t) => t.id !== teamId && AFFILIATE_SPORT_IDS.includes(t.sport?.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        sportId: t.sport?.id,
        city: t.venue?.location?.city || t.locationName || '',
        state: t.venue?.location?.stateAbbrev || t.venue?.location?.state || '',
      }))
      .sort((a, b) => AFFILIATE_SPORT_IDS.indexOf(a.sportId) - AFFILIATE_SPORT_IDS.indexOf(b.sportId))
  } catch {
    return []
  }
}

// Division standings AS OF a date. The `date` param is honored by the API
// (verified: a June-1 query returns the June-1 record, not today's, and it
// folds in games THROUGH the end of that day), which is what makes this
// spoiler-safe — pass the day BEFORE the game being scored so a team you
// haven't revealed never shows a record that folds tonight's result. Optional
// `hydrate` ('division' fills in the division name/abbrev the per-team records
// omit — the standings page needs it; TeamPage doesn't and passes none).
// Returns the raw division records array; person.js/TeamPage pick the team's
// own division. Degrades to [].
export async function fetchStandings(leagueId, season, date, hydrate) {
  if (!leagueId || !season) return []
  try {
    const dateParam = date ? `&date=${date}` : ''
    const hydrateParam = hydrate ? `&hydrate=${hydrate}` : ''
    const data = await getJson(
      `/api/v1/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason${dateParam}${hydrateParam}`,
    )
    return data.records ?? []
  } catch {
    return []
  }
}

// Both leagues' division standings AS OF a date, in one flat records array for
// the standings page. The /standings endpoint takes exactly one leagueId, so
// this fans out over the AL (103) and NL (104) in parallel — the same
// degrade-per-item idiom as resolveGame. `hydrate=division` carries the
// division name each record is grouped under (see api/standings.js for the
// shaping). Same `date` semantics + spoiler stance as fetchStandings: the
// standings page defaults `date` to yesterday ("entering today") so a slate the
// user is mid-scoring never leaks. Degrades per league (a failed league just
// contributes no records).
const STANDINGS_LEAGUE_IDS = [103, 104]
export async function fetchLeagueStandings(season, date) {
  if (!season) return []
  const results = await Promise.allSettled(
    STANDINGS_LEAGUE_IDS.map((leagueId) =>
      fetchStandings(leagueId, season, date, 'division'),
    ),
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

// Every MLB club's season hitting+pitching totals, so the team page can rank
// one team league-wide (there's no per-team "rank" field). Ranking is computed
// in person.js. Only meaningful at MLB (sportId 1); MiLB team-stat coverage is
// thin, so callers gate on level and this degrades to []. Returns
// { hitting: [{teamId, stat}], pitching: [...] }.
export async function fetchLeagueTeamStats(season) {
  if (!season) return { hitting: [], pitching: [] }
  const one = async (group) => {
    try {
      const data = await getJson(
        `/api/v1/teams/stats?season=${season}&sportIds=1&group=${group}&stats=season`,
      )
      return (data.stats?.[0]?.splits ?? []).map((s) => ({
        teamId: s.team?.id,
        stat: s.stat,
      }))
    } catch {
      return []
    }
  }
  const [hitting, pitching] = await Promise.all([one('hitting'), one('pitching')])
  return { hitting, pitching }
}
