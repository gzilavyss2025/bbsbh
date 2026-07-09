// League / level / organization leader pools — the Phase 3 producer promised in
// api/teamLeaders.js. Where normalizeRosterToPool builds a one-team pool, these
// assemble a MANY-team pool for a broader scope and hand it to the same
// computeLeaders + descriptors. Nothing here is score-revealing (season
// aggregates only — see teamLeaders.js's header), so no seals.
//
// The team list for every scope comes straight from the static teams snapshot
// (public/data/teams.json via fetchStaticTeams) — it already carries each MLB
// club's leagueId (103 AL / 104 NL) and each MiLB club's parentOrgId + sportId,
// so no live "list the teams at this level" call is needed. Only the per-team
// season stats are fetched, reusing fetchTeamRoster (hydrated + 15-min cached),
// fanned out with the same Promise.allSettled "degrade per team" idiom as
// fetchRosterIdsForTeams / ProspectsPage.

import { fetchStaticTeams } from './teams-static.js'
import { fetchTeamRoster } from './team.js'
import { normalizeRosterToPool } from './teamLeaders.js'
import { fetchTeamSeasonStats, combineToPool } from './statsLevels.js'
import { SPORT_IDS } from '../lib/teams.js'

// The league/level scopes, in the order the switcher shows them. Each resolves
// to a filter over the static teams snapshot. `org` (a club's whole farm system)
// and `minors` (every farm level, league-wide) both COMBINE a player's line
// across levels, so they carry no single sportId and are produced separately.
// `minors` heads the farm levels the way `mlb` heads AL/NL — the combined board
// before its per-level breakouts.
export const LEADER_SCOPES = [
  { key: 'mlb', label: 'MLB', title: 'MLB leaders', sportId: SPORT_IDS.MLB },
  { key: 'al', label: 'AL', title: 'American League leaders', sportId: SPORT_IDS.MLB, leagueId: 103 },
  { key: 'nl', label: 'NL', title: 'National League leaders', sportId: SPORT_IDS.MLB, leagueId: 104 },
  { key: 'minors', label: 'MiLB', title: 'Minor-league leaders · all levels combined' },
  { key: 'aaa', label: 'AAA', title: 'Triple-A leaders', sportId: SPORT_IDS.AAA },
  { key: 'aa', label: 'AA', title: 'Double-A leaders', sportId: SPORT_IDS.AA },
  { key: 'aplus', label: 'A+', title: 'High-A leaders', sportId: SPORT_IDS['A+'] },
  { key: 'a', label: 'A', title: 'Single-A leaders', sportId: SPORT_IDS.A },
]

// The four full-season farm levels, highest first — the org and all-minors
// combined scopes span exactly these (MiLB-only, mirroring AFFILIATE_SPORT_IDS
// in team.js; Rookie/complex ball is excluded from both, as it is everywhere).
const ORG_SPORT_IDS = [SPORT_IDS.AAA, SPORT_IDS.AA, SPORT_IDS['A+'], SPORT_IDS.A]

export function scopeMeta(key) {
  return LEADER_SCOPES.find((s) => s.key === key) ?? null
}

// A scope with a sportId other than MLB is a minor-league pool — it gets the
// prospect pills (and, when it spans levels, the level badge).
export function isMilbScope(key) {
  if (key === 'org' || key === 'minors') return true
  const meta = scopeMeta(key)
  return meta != null && meta.sportId !== SPORT_IDS.MLB
}

// Scopes whose pool combines a player across levels — each ranked row can span
// several levels, so it earns the multi-level badge ("A+·AA").
export function isMultiLevelScope(key) {
  return key === 'org' || key === 'minors'
}

// Resolve a scope to the clubs it covers: [{ id, abbreviation, sportId }].
// Reads only the static snapshot; degrades to [] if it's unavailable (callers
// then show an empty state rather than crashing).
export async function resolveScopeTeams(scope, orgId) {
  const { bySportId } = await fetchStaticTeams()
  const pick = (sid) => bySportId?.[String(sid)] ?? []
  const shape = (t, sid) => ({ id: t.id, abbreviation: t.abbreviation, sportId: sid })

  if (scope === 'org') {
    if (!orgId) return []
    return ORG_SPORT_IDS.flatMap((sid) =>
      pick(sid)
        .filter((t) => t.parentOrgId === orgId)
        .map((t) => shape(t, sid)),
    )
  }

  const meta = scopeMeta(scope)
  if (!meta) return []
  return pick(meta.sportId)
    .filter((t) => (meta.leagueId ? t.leagueId === meta.leagueId : true))
    .map((t) => shape(t, meta.sportId))
}

// Assemble the PoolPlayer[] for a scope. Two shapes:
//
// - The 'org' scope sums a player's season across the club's affiliates into one
//   row (see statsLevels.js), so a prospect who's been promoted mid-season ranks
//   on his A+ + AA total rather than whichever single stop he's currently
//   rostered at. (The league-wide all-minors 'minors' board is the same idea but
//   far heavier, so it's precomputed to a static file and read separately — see
//   api/minorsLeaders.js — not produced here.)
// - Every other scope (a single team level, or MLB/AL/NL) fans out
//   fetchTeamRoster over its clubs and concats one row per (player, club). Each
//   club is fetched at its OWN level (`sportId`) so a MiLB club's players are
//   ranked on their AAA/AA/A+/A line rather than an empty MLB one (without this a
//   level's leaders collapse to just the handful who've also logged MLB time),
//   and via the '40Man' roster so an injured leader still counts (see
//   fetchTeamRoster).
export async function loadLeaderPool(scope, orgId, season) {
  if (scope === 'org') return loadOrgCombinedPool(orgId, season)

  const teams = await resolveScopeTeams(scope, orgId)
  if (teams.length === 0) return []
  const results = await Promise.allSettled(
    teams.map((t) => fetchTeamRoster(t.id, season, { sportId: t.sportId, rosterType: '40Man' })),
  )
  return teams.flatMap((t, i) => {
    const roster = results[i].status === 'fulfilled' ? results[i].value : []
    return normalizeRosterToPool(roster, {
      id: t.id,
      abbreviation: t.abbreviation,
      sport: { id: t.sportId },
    })
  })
}

// One org's combined pool: its affiliates' season lines summed per player.
async function loadOrgCombinedPool(orgId, season) {
  const teams = await resolveScopeTeams('org', orgId)
  if (teams.length === 0) return []
  const [hit, pit] = await Promise.all([
    Promise.allSettled(teams.map((t) => fetchTeamSeasonStats(t.id, 'hitting', season))),
    Promise.allSettled(teams.map((t) => fetchTeamSeasonStats(t.id, 'pitching', season))),
  ])
  const settledFlat = (results) => results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  return combineToPool(settledFlat(hit), settledFlat(pit))
}
