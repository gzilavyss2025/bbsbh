// Team pages — identity, roster, standings, ranked team stats.

import { getJson } from './statsapi.js'
import { fetchStaticTeams } from './teams-static.js'

// Basic team identity, incl. league + division ids (needed to pull the right
// standings). Team identity barely ever changes mid-season, so this looks the
// id up across every level in the static weekly snapshot (see
// teams-static.js) first — synthesizing the same shape TeamPage's loadTeam()
// reads (name, sport.id, league.id/name, division.id/name, parentOrgId/Name)
// — and only falls back to the live endpoint if the id isn't found there
// (e.g. a team too new for a stale static file). Degrades to null.
export async function fetchTeam(teamId) {
  if (!teamId) return null
  const staticTeams = await fetchStaticTeams()
  for (const [sportId, bucket] of Object.entries(staticTeams?.bySportId ?? {})) {
    const t = bucket.find((x) => x.id === teamId)
    if (t) {
      return {
        id: t.id,
        name: t.name,
        teamName: t.teamName,
        abbreviation: t.abbreviation,
        sport: { id: Number(sportId) },
        league: { id: t.leagueId, name: t.leagueName },
        division: { id: t.divisionId, name: t.divisionName },
        parentOrgId: t.parentOrgId,
        parentOrgName: t.parentOrgName,
      }
    }
  }
  try {
    const data = await getJson(`/api/v1/teams/${teamId}`)
    return data.teams?.[0] ?? null
  } catch {
    return null
  }
}

// Session cache for fetchTeamRoster, keyed by `${teamId}:${season}`. Heavier
// (full roster + hydrated season pitching stats) and fresher-sensitive than
// the bare fetchTeamRosterIds call below — pitching lines drift daily — so
// this gets a shorter TTL: long enough that a same-session TeamPage visit
// followed shortly by that team's GameView load (or vice versa) reuses the
// fetch, short enough that stats don't go stale for long within a single
// evening of scoring. A failed fetch is never cached.
const TEAM_ROSTER_CACHE_TTL_MS = 15 * 60 * 1000
const teamRosterCache = new Map()

// The active roster, with each player's season hitting AND pitching lines
// hydrated: pitching so the team page can infer starter/reliever/closer (there
// is no role field in the API), hitting+pitching so the Team Leaders section can
// rank individual players by any season stat (see api/teamLeaders.js). Both
// groups arrive in one request; the API returns only the split(s) a given player
// has, so a position player carries just a hitting split and a pitcher just a
// pitching one (a two-way player carries both). Degrades to [].
export async function fetchTeamRoster(teamId, season) {
  if (!teamId || !season) return []
  const key = `${teamId}:${season}`
  const cached = teamRosterCache.get(key)
  if (cached && Date.now() - cached.ts < TEAM_ROSTER_CACHE_TTL_MS) return cached.data
  try {
    const data = await getJson(
      `/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person(stats(type=season,group=[hitting,pitching],season=${season}))`,
    )
    const roster = data.roster ?? []
    teamRosterCache.set(key, { ts: Date.now(), data: roster })
    return roster
  } catch {
    return []
  }
}

// Session cache for fetchTeamRosterIds, keyed by teamId. Active rosters only
// churn on transactions (call-ups/trades/IL moves) — a few times a week per
// team, not intraday — so a 30-minute TTL is long enough to spare a refetch
// on every slate re-render within a session, while staying short enough that
// a "roughly how many prospects" badge never goes stale for long. A failed
// fetch is never cached, so a transient network blip doesn't stick around
// for the full TTL.
const ROSTER_IDS_CACHE_TTL_MS = 30 * 60 * 1000
const rosterIdsCache = new Map()

// Just the active roster's person ids — no stat hydration — for the slate's
// "N prospects on this roster" badge, which only needs to know who's on the
// roster, not their stats. Lighter than fetchTeamRoster. Degrades to [].
export async function fetchTeamRosterIds(teamId) {
  if (!teamId) return []
  const cached = rosterIdsCache.get(teamId)
  if (cached && Date.now() - cached.ts < ROSTER_IDS_CACHE_TTL_MS) return cached.data
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=active`)
    const ids = (data.roster ?? []).map((r) => r.person?.id).filter(Boolean)
    rosterIdsCache.set(teamId, { ts: Date.now(), data: ids })
    return ids
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

// A club's full affiliate tree, read first from a static same-origin file
// (public/data/affiliates.json), falling back to the live dedicated
// /teams/affiliates endpoint (a plain team hydrate doesn't carry this) when
// the static file is missing, stale for the requested season, or doesn't
// cover the org. That file is regenerated weekly by scripts/gen-affiliates.mjs
// (see .github/workflows/update-affiliates.yml) from the SAME endpoint this
// fallback calls, shaped identically — an org's farm system changes at most
// once a year (the offseason PDC realignment), so it's safe to read the
// season snapshot rather than fetching live on every team-page visit AND
// every org fanned out across the Prospects page. The season check guards the
// one time this actually matters: a stale file spanning an offseason
// realignment boundary must not silently serve last year's tree.
// `hydrate=venue(location)` folds in each affiliate's ballpark city/state
// alongside its own team id (which already drives the logo CDN), so the team
// page's affiliates section needs no per-team follow-up fetch. Filtered to
// the four full-season farm levels (AAA/AA/A+/A, sportIds 11/12/13/14) — the
// endpoint also returns complex-league/DSL/alternate-site/"Prospects" entries
// that aren't proper affiliate clubs the rest of the app tracks (see
// MILB_LEVELS). Sorted highest level first. Degrades to [].
const AFFILIATE_SPORT_IDS = [11, 12, 13, 14]
let cachedAffiliates = null
async function fetchStaticAffiliates() {
  if (cachedAffiliates) return cachedAffiliates
  try {
    const res = await fetch('/data/affiliates.json')
    if (!res.ok) throw new Error(`affiliates.json ${res.status}`)
    cachedAffiliates = await res.json()
  } catch {
    cachedAffiliates = { season: null, byOrgId: {} }
  }
  return cachedAffiliates
}
export async function fetchAffiliates(teamId, season) {
  if (!teamId || !season) return []
  const staticData = await fetchStaticAffiliates()
  if (staticData.season === season && staticData.byOrgId?.[teamId]) {
    return staticData.byOrgId[teamId]
  }
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
//
// A dated response never changes once fetched (it's a fact about a day that's
// already over), so it's cached in-memory for the session, keyed on the full
// query tuple — same session-cache idiom as war.js/fetchTeamDirectory. Only a
// falsy `date` (StandingsPage's opt-in "Live" view, today's still-moving
// standings) skips the cache: that response can change all evening, so it's
// always fetched fresh. Failures aren't cached, so a flaky request gets
// retried on the next call instead of sticking as [].
const standingsCache = new Map()
export async function fetchStandings(leagueId, season, date, hydrate) {
  if (!leagueId || !season) return []
  const cacheKey = date ? `${leagueId}:${season}:${date}:${hydrate ?? ''}` : null
  if (cacheKey && standingsCache.has(cacheKey)) return standingsCache.get(cacheKey)
  try {
    const dateParam = date ? `&date=${date}` : ''
    const hydrateParam = hydrate ? `&hydrate=${hydrate}` : ''
    const data = await getJson(
      `/api/v1/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason${dateParam}${hydrateParam}`,
    )
    const records = data.records ?? []
    if (cacheKey) standingsCache.set(cacheKey, records)
    return records
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
//
// The payload doesn't depend on which team you're viewing, so it's cached
// in-memory per season for the session (standings-style data — updates
// roughly daily as games complete, not worth refetching on every team-page
// visit). A failed group isn't cached, so the next call retries it instead of
// pinning the degraded [] for the rest of the session.
const LEAGUE_TEAM_STATS_TTL_MS = 60 * 60 * 1000
let leagueTeamStatsCache = null // { season, ts, data }

export async function fetchLeagueTeamStats(season) {
  if (!season) return { hitting: [], pitching: [] }
  if (
    leagueTeamStatsCache?.season === season &&
    Date.now() - leagueTeamStatsCache.ts < LEAGUE_TEAM_STATS_TTL_MS
  ) {
    return leagueTeamStatsCache.data
  }
  let ok = true
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
      ok = false
      return []
    }
  }
  const [hitting, pitching] = await Promise.all([one('hitting'), one('pitching')])
  const result = { hitting, pitching }
  if (ok) leagueTeamStatsCache = { season, ts: Date.now(), data: result }
  return result
}
