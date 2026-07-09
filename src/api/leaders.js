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
import { SPORT_IDS } from '../lib/teams.js'

// The league/level scopes, in the order the switcher shows them. Each resolves
// to a filter over the static teams snapshot. `org` is handled separately (it
// needs a team id), so it isn't listed here.
export const LEADER_SCOPES = [
  { key: 'mlb', label: 'MLB', title: 'MLB leaders', sportId: SPORT_IDS.MLB },
  { key: 'al', label: 'AL', title: 'American League leaders', sportId: SPORT_IDS.MLB, leagueId: 103 },
  { key: 'nl', label: 'NL', title: 'National League leaders', sportId: SPORT_IDS.MLB, leagueId: 104 },
  { key: 'aaa', label: 'AAA', title: 'Triple-A leaders', sportId: SPORT_IDS.AAA },
  { key: 'aa', label: 'AA', title: 'Double-A leaders', sportId: SPORT_IDS.AA },
  { key: 'aplus', label: 'A+', title: 'High-A leaders', sportId: SPORT_IDS['A+'] },
  { key: 'a', label: 'A', title: 'Single-A leaders', sportId: SPORT_IDS.A },
]

// The four full-season farm levels, highest first — the org scope spans exactly
// these (MiLB-only, mirroring AFFILIATE_SPORT_IDS in team.js).
const ORG_SPORT_IDS = [SPORT_IDS.AAA, SPORT_IDS.AA, SPORT_IDS['A+'], SPORT_IDS.A]

export function scopeMeta(key) {
  return LEADER_SCOPES.find((s) => s.key === key) ?? null
}

// A scope with a sportId other than MLB is a minor-league pool — it gets the
// level badge (org) and prospect pills.
export function isMilbScope(key) {
  const meta = scopeMeta(key)
  return key === 'org' || (meta != null && meta.sportId !== SPORT_IDS.MLB)
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

// Assemble the PoolPlayer[] for a scope: fan out fetchTeamRoster over every club
// (each response already hydrated with season hitting+pitching), normalize each
// with the club's identity + level stamped on, and concat. Degrades per team.
//
// Each club is fetched at its OWN level (`sportId`) so a MiLB club's players are
// ranked on their AAA/AA/A+/A line rather than an empty MLB one (without this a
// level's leaders collapse to just the handful who've also logged MLB time), and
// via the '40Man' roster so an injured leader still counts (see fetchTeamRoster).
export async function loadLeaderPool(scope, orgId, season) {
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
