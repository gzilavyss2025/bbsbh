import {
  fetchTeam,
  fetchTeamRoster,
  fetchAffiliates,
  fetchComplexAffiliates,
  fetchRosterIdsForTeams,
  fetchTeamRosterIds,
} from '../../../api/team.js'
import { fetchTopProspects, orgProspectsForTeam, prospectAffiliateMap, isPitcher } from '../../../api/prospects.js'
import { fetchProspectTrend, prospectTrendById, standingLabel, movementState } from '../../../api/prospectTrend.js'
import { loadRehabAssignments } from '../../../api/rehab.js'
import { parentOrgHistory } from '../../../api/milbHistory.js'
import { fetchTeamLogoTint } from '../../../api/careerTimeline.js'
import { loadCombinedPoolForTeams } from '../../../api/statsLevels.js'
import { SPORT_LABEL } from '../../../lib/teams.js'
import { seasonOf, affiliateCardsFrom } from './shared.js'

const DASH = '—'

// Same rate-stat formatting prospects.js's own statLineFrom uses (three
// decimals, no leading zero — an OPS over 1.000 is left alone since the
// regex only strips a leading zero immediately before the decimal point) —
// kept as its own copy rather than an import for two formatters, same
// cross-boundary-constant convention prospects.js's own header describes.
function rate3(v) {
  return Number.isFinite(v) ? v.toFixed(3).replace(/^(-?)0(?=\.)/, '$1') : null
}
function num2(v) {
  return Number.isFinite(v) ? v.toFixed(2) : null
}

// The Horizon card's real season line for one prospect — W-L/ERA/K/WHIP for
// a pitcher, AVG/HR/RBI/OPS for a hitter — off the same org-wide combined
// stats pool (combineToPool, statsLevels.js) the unresolved-level fallback
// below already sums ACROSS every level the player has appeared at this
// season, so a midseason promotion doesn't fragment his line. `null` when
// the pool has no row for him at all (released, foreign-league loanee, or
// simply hasn't debuted at a full-season affiliate this year).
export function statLineFor(position, statRow) {
  if (!statRow) return null
  if (isPitcher(position)) {
    const t = statRow.pitching
    if (!t) return null
    return [
      { k: 'W-L', v: `${t.wins}-${t.losses}` },
      { k: 'ERA', v: num2(t.era) },
      { k: 'K', v: String(t.strikeOuts) },
      { k: 'WHIP', v: num2(t.whip) },
    ]
  }
  const t = statRow.hitting
  if (!t) return null
  return [
    { k: 'AVG', v: rate3(t.avg) },
    { k: 'HR', v: String(t.homeRuns) },
    { k: 'RBI', v: String(t.rbi) },
    { k: 'OPS', v: rate3(t.ops) },
  ]
}

// Position order the Depth Chart's pill row reads in, an infield-out-to-the-
// mound walk of the diamond rather than the scrape's own alphabetical field
// order — a reader expects catcher first, pitchers last. Anything the scrape
// hands back outside this set (there's no such value today, but a future
// scrape tweak shouldn't crash the tab) sorts after it, alphabetically.
const POSITION_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'LHP', 'RHP', 'SHP']

// Two parallel rankings per position — never blended into one score (no
// outlet publishes a formula for merging a scouting grade with a stat line;
// FanGraphs' own Board keeps them separate, and this mirrors that). Scouting
// is this org's existing ranked pool (`orgRank`, already resolved above);
// Performance is the same pool re-sorted by bbsbh's own level-relative
// percentile (prospectTrend.js) — the two orders are free to disagree, and
// when they do that IS the finding, not noise to resolve. Positions with no
// prospect at all in the ranked pool simply don't appear as a pill.
export function buildDepthChart(prospects) {
  const byPos = new Map()
  for (const p of prospects) {
    if (!p.position) continue
    if (!byPos.has(p.position)) byPos.set(p.position, [])
    byPos.get(p.position).push(p)
  }
  const positions = [...byPos.keys()].sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a)
    const bi = POSITION_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const byPosition = {}
  for (const pos of positions) {
    const rows = byPos.get(pos)
    byPosition[pos] = {
      scouting: [...rows].sort((a, b) => a.orgRank - b.orgRank),
      performance: rows
        .filter((p) => p.trend)
        .sort((a, b) => b.trend.percentile - a.trend.percentile),
    }
  }
  return { positions, byPosition }
}

// The Horizon card's "Promotion watch" list: org prospects whose level-relative
// standing is both real (qualified past the playing-time floor) and genuinely
// trending up (movementState's own 5-point floor, not a single good night) —
// ranked by how good the standing is right now, not by how fast it moved,
// since a player already near the top of his level reads as closer to a real
// decision than one who merely gained the most points off a low base.
export function promotionWatchFrom(prospects, limit = 4) {
  return prospects
    .filter((p) => p.trend && p.trend.movement?.direction === 'up')
    .sort((a, b) => b.trend.percentile - a.trend.percentile)
    .slice(0, limit)
}

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

  const [roster, affiliates, complexAffiliates, prospectsSnapshot, trendSnapshot, rehabSnapshot] = await Promise.all([
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
    // Both static, same-origin, session-memoized snapshots the Horizon and
    // Depth Chart cards below share — one fetch each regardless of how many
    // org prospects join against them.
    fetchProspectTrend(),
    loadRehabAssignments(),
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
  // This org's combined season stats pool (combineToPool, statsLevels.js) —
  // two jobs share it. Roster membership (above) still misses anyone not on
  // ANY org 40-man roster right now (released, a stint between assignments,
  // a foreign-league loanee); for exactly those, combineToPool's own
  // highest-level-reached resolution finds the real current level a roster
  // snapshot can't. The Horizon card's real stat lines (statLineFor above)
  // need the same pool for every ranked prospect, not only the unresolved
  // ones, so this is no longer gated to "only when someone's unresolved" —
  // fetched whenever this org has a ranked prospect pool at all.
  const statsPoolByPlayer = orgProspectRows.length
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
  }).map((p) => {
    // Join bbsbh's own level-relative percentile onto each org prospect —
    // the Horizon and Depth Chart cards' shared "Performance" signal. `null`
    // for anyone with no current-level line at all (off the board, hurt all
    // season, or a fresh promotion the nightly generator hasn't caught up to
    // yet) or short of the qualification floor — those rows just don't carry
    // a trend, rather than a misleading zero.
    const entry = prospectTrendById(trendSnapshot, p.playerId)
    const stats = statLineFor(p.position, statsPoolByPlayer.get(p.playerId))
    if (!entry?.qualified) return { ...p, trend: null, stats }
    return {
      ...p,
      stats,
      trend: {
        percentile: entry.percentile,
        group: entry.group,
        standing: standingLabel(entry.percentile, entry.group),
        movement: movementState(entry.movement),
      },
    }
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

  // The Affiliates section's rendered card list: full-season farm levels,
  // then the org's current Rookie/complex clubs, then (on a MiLB affiliate's
  // own page) the parent MLB club leading the whole thing — see
  // affiliateCardsFrom's own header.
  const affiliateCards = affiliateCardsFrom(team, isMilb, affiliates, complexAffiliates)

  // Milestones: this org's own rehab-assignment stints, from the same
  // league-wide snapshot RehabPage reads — a rehabbing player is a real
  // fact about a game he's about to appear in, not a score, so it stays
  // spoiler-free like the rest of this tab.
  const milestones = orgId ? (rehabSnapshot.players ?? []).filter((p) => p.orgId === orgId) : []
  const horizon = { promotionWatch: promotionWatchFrom(prospects), milestones }
  const depthChart = buildDepthChart(prospects)

  return {
    team,
    season,
    sportId,
    isMilb,
    orgId,
    affiliateCards,
    prospects,
    affiliationHistory,
    horizon,
    depthChart,
  }
}
