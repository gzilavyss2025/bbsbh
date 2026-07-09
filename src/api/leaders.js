// League / level / organization leader pools — the Phase 3 producer promised in
// api/teamLeaders.js. Assembles a MANY-team pool for a broader scope and hands
// it to the same computeLeaders + descriptors. Nothing here is score-revealing
// (season aggregates only — see teamLeaders.js's header), so no seals.
//
// The team list for every scope comes straight from the static teams snapshot
// (public/data/teams.json via fetchStaticTeams) — it already carries each MLB
// club's leagueId (103 AL / 104 NL) and each MiLB club's parentOrgId + sportId,
// so no live "list the teams at this level" call is needed. Every scope's pool
// is then built from each club's roster-INDEPENDENT season stats
// (loadCombinedPoolForTeams, api/statsLevels.js) rather than its current
// roster, so a player traded away, released, or promoted off a club still
// ranks — credited only for the stats he put up while there.

import { fetchStaticTeams } from './teams-static.js'
import { loadCombinedPoolForTeams } from './statsLevels.js'
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

// Assemble the PoolPlayer[] for a scope. Every scope — a single team level,
// MLB/AL/NL, or a club's whole 'org' — is built the same way now: each scope
// resolves to a set of clubs, and loadCombinedPoolForTeams (statsLevels.js)
// reads those clubs' roster-INDEPENDENT season stats rather than their
// current rosters. That's what makes a traded-away, released, or promoted-out
// player still rank — scoped to only the stats he put up on the club(s) in
// this scope — rather than dropping out the moment he's off the roster. The
// 'org' scope additionally sums a player's season across the club's
// affiliates into one row, so a prospect promoted mid-season ranks on his
// A+ + AA total. (The league-wide all-minors 'minors' board is the same idea
// but far heavier, so it's precomputed to a static file and read separately —
// see api/minorsLeaders.js — not produced here.)
export async function loadLeaderPool(scope, orgId, season) {
  const teams = await resolveScopeTeams(scope, orgId)
  if (teams.length === 0) return []
  return loadCombinedPoolForTeams(teams, season)
}
