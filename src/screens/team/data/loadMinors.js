import {
  fetchTeam,
  fetchTeamRoster,
  fetchAffiliates,
  fetchComplexAffiliates,
  fetchRosterIdsForTeams,
  fetchTeamRosterIds,
} from '../../../api/team.js'
import { fetchTopProspects, orgProspectsForTeam, prospectAffiliateMap } from '../../../api/prospects.js'
import { parentOrgHistory } from '../../../api/milbHistory.js'
import { fetchTeamLogoTint } from '../../../api/careerTimeline.js'
import { loadCombinedPoolForTeams } from '../../../api/statsLevels.js'
import { SPORT_LABEL } from '../../../lib/teams.js'
import { seasonOf } from './shared.js'

const DASH = '—'

// The Minors tab's own loader — affiliates, org-wide prospects and (MiLB only)
// affiliation history. Fetches nothing else: roster, standings, schedule
// results, league stats, jersey combos, transactions and odds all belong to
// other tabs (jersey combos moved to the Numbers tab — see loadNumbers.js).

export async function loadMinors(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const isMilb = sportId !== 1
  const season = seasonOf(asOf)
  // The MLB parent's own id — same value whether this page IS the parent or
  // one of its affiliates (team.parentOrgId rides along on a MiLB team's
  // /teams response). Every prospect belongs to the org, not to one specific
  // affiliate, so both the parent's page and every affiliate's page show the
  // same org-wide leaderboard.
  const orgId = isMilb ? team.parentOrgId ?? null : id

  const [roster, affiliates, complexAffiliates, prospectsSnapshot] = await Promise.all([
    // Only needed to seed this org's own roster ids below (MLB clubs only —
    // a MiLB affiliate's org roster comes from fetchTeamRosterIds instead).
    isMilb ? Promise.resolve([]) : fetchTeamRoster(id, season, { sportId }),
    // The affiliate tree is keyed off the ORG id (not `id`), so an
    // affiliate's own page gets the same tree its MLB parent would.
    orgId ? fetchAffiliates(orgId, season) : Promise.resolve([]),
    // Complex/rookie-level clubs, resolved separately — see
    // fetchComplexAffiliates for why they can't just join AFFILIATE_SPORT_IDS.
    orgId ? fetchComplexAffiliates(orgId, season) : Promise.resolve([]),
    fetchTopProspects(),
  ])

  // Each org prospect's CURRENT level, resolved by live roster membership
  // (not the scraped, sometimes-ambiguous level string, e.g. "ALL (2)") — a
  // second small fan-out over this org's affiliates (full-season AAA/AA/A+/A
  // PLUS complex/rookie clubs) PLUS the MLB roster itself, so a prospect
  // who's been called up resolves to MLB rather than his last MiLB stop.
  // `rosterType=40Man` (not the default 'active') so a prospect currently on
  // a 7-/60-day IL still resolves to his real affiliate instead of falling
  // through to the scraped level text with no logo.
  const farmTeams = [...affiliates, ...complexAffiliates]
  const affiliateRosterIds = farmTeams.length
    ? await fetchRosterIdsForTeams(farmTeams.map((a) => a.id), '40Man')
    : {}
  if (orgId) {
    affiliateRosterIds[orgId] = isMilb
      ? await fetchTeamRosterIds(orgId, '40Man')
      : roster.map((r) => r.person?.id).filter(Boolean)
  }
  const affiliateByPlayer = prospectAffiliateMap(affiliateRosterIds)
  const affiliateById = new Map(farmTeams.map((a) => [a.id, a]))
  if (orgId) {
    affiliateById.set(orgId, { id: orgId, sportId: 1, name: isMilb ? team.parentOrgName : team.name })
  }
  const orgProspectRows = orgId ? orgProspectsForTeam(prospectsSnapshot.orgProspects, orgId) : []
  // Roster membership (above) still misses anyone not on ANY org 40-man roster
  // right now (released, a stint between assignments, or a foreign-league
  // loanee). For exactly those, fall back to THIS season's stats across the
  // org's affiliates + MLB roster: combineToPool already resolves a player's
  // identity to his highest level reached (lowest sportId), so it can find
  // the real current level a roster snapshot can't — only fetched when at
  // least one prospect actually needs it.
  const unresolvedIds = orgProspectRows
    .filter((p) => !affiliateByPlayer.has(p.playerId))
    .map((p) => p.playerId)
  const statsPoolByPlayer = unresolvedIds.length
    ? new Map(
        (await loadCombinedPoolForTeams([...affiliateById.values()].map((t) => ({ id: t.id })), season)).map(
          (p) => [p.id, p],
        ),
      )
    : new Map()
  const prospects = orgProspectRows.map((p) => {
    const affTeamId = affiliateByPlayer.get(p.playerId) ?? null
    const aff = affTeamId ? affiliateById.get(affTeamId) : null
    if (aff) {
      return { ...p, affiliateTeamId: aff.id, levelLabel: SPORT_LABEL[aff.sportId] ?? p.levelRaw }
    }
    const statRow = statsPoolByPlayer.get(p.playerId)
    if (statRow?.teamId && statRow?.sportId) {
      return { ...p, affiliateTeamId: statRow.teamId, levelLabel: SPORT_LABEL[statRow.sportId] ?? p.levelRaw }
    }
    // Neither roster membership nor this season's stats resolved a real
    // level — never surface the raw ambiguous scraped string (e.g. "ALL (2)").
    return { ...p, affiliateTeamId: null, levelLabel: /^ALL\b/i.test(p.levelRaw) ? DASH : p.levelRaw }
  })

  // Affiliation history — the ordered MLB parent orgs this farm club has
  // belonged to over time (MiLB pages only; an MLB team has no parent).
  const affiliationHistory = isMilb
    ? await Promise.all(
        (await parentOrgHistory(id)).map(async (era) => {
          const [start, end] = era.years
          return {
            teamId: era.parentOrgId,
            teamName: era.parentOrgName,
            minSeason: start,
            yearText: start === end ? `${start}` : `${start}–${String(end).slice(2)}`,
            tint: await fetchTeamLogoTint(era.parentOrgId),
            title: `${era.parentOrgName} · ${start}–${end}${era.note ? ` (${era.note})` : ''}`,
          }
        }),
      )
    : []

  // On a MiLB affiliate page, lead the Affiliates section with a card for the
  // parent MLB club (which fetchAffiliates deliberately omits from the farm
  // tree). Location is unavailable from the static team record, so the card
  // degrades to just the mark + name.
  const affiliateCards =
    isMilb && team.parentOrgId
      ? [{ id: team.parentOrgId, sportId: 1, name: team.parentOrgName, city: '', state: '' }, ...affiliates]
      : affiliates

  return {
    team,
    season,
    sportId,
    isMilb,
    affiliateCards,
    prospects,
    affiliationHistory,
  }
}
