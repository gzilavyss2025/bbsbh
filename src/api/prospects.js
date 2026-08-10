// Fetching + pure selectors over the app's own Top-100-prospects snapshot
// (public/data/top-prospects.json), refreshed weekly off-device — see
// docs/top-prospects.md. This is a same-origin static asset, not the public
// MLB Stats API (mlb.js's territory) or a shaping of a /people response
// (person.js's territory), so it gets its own small file.

import { fetchAffiliates, fetchComplexAffiliates, fetchRosterIdsForTeams } from './team.js'
import { loadCombinedPoolForTeams, sumHitting, sumPitching } from './statsLevels.js'
import { SPORT_LABEL } from '../lib/teams.js'

const SNAPSHOT_URL = '/data/top-prospects.json'
const EMPTY_SNAPSHOT = { generatedAt: null, source: null, count: 0, players: [], orgProspects: [] }

// Session-memoized, mirrors fetchTeamDirectory's caching pattern in mlb.js.
// Degrades to an empty snapshot on any failure (404 before the first weekly
// Action run, malformed JSON, network) — callers never need their own
// try/catch, and the app just renders as if no player is ranked.
let prospectsPromise = null
export function fetchTopProspects() {
  if (!prospectsPromise) {
    prospectsPromise = fetch(SNAPSHOT_URL)
      .then((res) => (res.ok ? res.json() : EMPTY_SNAPSHOT))
      .catch(() => EMPTY_SNAPSHOT)
  }
  return prospectsPromise
}

export function prospectRankById(players, playerId) {
  const row = (players ?? []).find((p) => p.playerId === playerId)
  return row ? row.rank : null
}

// A player's rank on his OWN org's farm-system leaderboard (distinct from
// prospectRankById's overall Top 100 rank) — used for the player-page's
// second pill, and null for anyone not in their org's list at all.
export function orgProspectRankById(orgProspects, playerId) {
  const row = (orgProspects ?? []).find((p) => p.playerId === playerId)
  return row ? row.orgRank : null
}

// Everything a ProspectPill needs for one player, resolved from a single
// fetchTopProspects() snapshot with no extra fetching: the overall Top 100
// rank when he's ranked there, else his own org's farm-system rank (1-30)
// plus that org's team id for the pill's logo — no affiliate-roster
// resolution needed (unlike orgProspectsForTeam's table), since the
// snapshot's own teamId field already IS the player's parent org. Both
// rank fields are null when he's unranked anywhere.
//
// `currentOrgTeamId`, when passed, is the player's CURRENT parent org (his own
// id if he's on an MLB roster, else his affiliate's live parentOrgId) as of
// render time — fresher than anything the weekly scrape can carry. A mismatch
// against the snapshot row's baked-in `teamId` means the player was traded
// since that scrape ran, so the org badge is suppressed rather than shown
// under his old club's logo with a rank that's no longer his anyway.
export function prospectBadge(snapshot, playerId, currentOrgTeamId) {
  const orgRow = (snapshot?.orgProspects ?? []).find((p) => p.playerId === playerId)
  const stale = currentOrgTeamId != null && orgRow != null && orgRow.teamId !== currentOrgTeamId
  return {
    rank: prospectRankById(snapshot?.players, playerId),
    orgRank: stale ? null : orgRow?.orgRank ?? null,
    orgTeamId: stale ? null : orgRow?.teamId ?? null,
    orgTeamName: stale ? null : orgRow?.team ?? null,
  }
}

// Pure — no fetching. rosterIdsByTeam: { [teamId]: number[] } (person ids on
// a team's active roster); prospectPlayerIds: Set<number> (every ranked
// player's id). Used by the MiLB game-card badge.
export function countProspectsByTeam(rosterIdsByTeam, prospectPlayerIds) {
  const out = {}
  for (const [teamId, ids] of Object.entries(rosterIdsByTeam ?? {})) {
    out[teamId] = (ids ?? []).filter((id) => prospectPlayerIds.has(id)).length
  }
  return out
}

// ---------------------------------------------------------------------------
// Team-page prospect table — one org's full farm-system leaderboard, with
// each prospect's CURRENT affiliate resolved by live roster membership
// rather than the scraped (sometimes ambiguous, e.g. "ALL (2)") level
// string, so the table can show a real affiliate logo next to the level.
// ---------------------------------------------------------------------------

// This org's prospects, ranked. `orgTeamId` is the MLB parent's team id —
// the same id whether you're looking at the parent's own page or one of its
// affiliates' pages (see teams.js's parentOrgId).
export function orgProspectsForTeam(orgProspects, orgTeamId) {
  return (orgProspects ?? [])
    .filter((p) => p.teamId === orgTeamId)
    .sort((a, b) => a.orgRank - b.orgRank)
}

// affiliateRosterIds: { [affiliateTeamId]: number[] } (from
// fetchRosterIdsForTeams). Flips it into playerId -> affiliateTeamId so a
// prospect row can look up which specific affiliate he's actually on right
// now. A player on none of the org's full-season affiliate rosters (most
// often a complex/rookie-leaguer — those aren't in AFFILIATE_SPORT_IDS)
// simply won't resolve, and the caller falls back to the scraped level text.
export function prospectAffiliateMap(affiliateRosterIds) {
  const out = new Map()
  for (const [teamId, ids] of Object.entries(affiliateRosterIds ?? {})) {
    for (const id of ids) out.set(id, Number(teamId))
  }
  return out
}

// ---------------------------------------------------------------------------
// /prospects "Level" column — the same live-roster resolution loadMinors.js
// (screens/team/data/) runs for the team hub's own org-wide prospect table,
// factored out here so both callers share one fix rather than drifting apart.
// ---------------------------------------------------------------------------

const MLB_SPORT_ID = 1

// A rate stat the way a broadcast prints it: three decimals, no leading
// zero (".302"). Same convention teamLeaders.js's own rate3 uses — this file
// keeps its own copy rather than importing a pool-ranking module for one
// formatter (see postseasonLeaders.js/savantPercentiles.js/tradeDeadline.js,
// which each do the same).
function rate3(v) {
  return Number.isFinite(v) ? v.toFixed(3).replace(/^(-?)0(?=\.)/, '$1') : null
}
// "3.45" — two decimals (ERA).
function num2(v) {
  return Number.isFinite(v) ? v.toFixed(2) : null
}

// A position abbreviation ending in "P" (RHP/LHP/P) reads as pitching,
// everything else as hitting — the same split fetch-top-prospects.mjs's own
// scrape draws (battingStats vs. pitchingStats) and gen-prospect-trend.mjs's
// primaryGroupFor mirrors server-side; this is the browser-side twin, kept
// local rather than importing a scripts/lib module into the client bundle.
// Exported: ProspectsPage's own Batters/Pitchers filter pill draws the same
// line a two-way prospect's stat line already does, off one definition.
export function isPitcher(position) {
  return /P$/.test(position || '')
}

// One group's (hitting or pitching) splits, summed and printed in the same
// "$avg, $hr HR, $rbi RBI" / "$ip IP, $era ERA, $so SO" shape
// fetch-top-prospects.mjs's statLineFor already established for the scraped
// weekly snapshot — a live-computed line reads identically to the static one
// it stands beside or replaces. Null for an empty slice (no time at that
// group of levels this season), which the caller reads as "no line here."
function statLineFrom(splits, pitching) {
  if (!splits.length) return null
  if (pitching) {
    const t = sumPitching(splits)
    return [`${t.inningsPitched} IP`, `${num2(t.era)} ERA`, `${t.strikeOuts} SO`].join(', ')
  }
  const t = sumHitting(splits)
  return [rate3(t.avg), `${t.homeRuns} HR`, `${t.rbi} RBI`].join(', ')
}

// ---------------------------------------------------------------------------
// /prospects "Level" + "Line" columns — the same live-roster resolution
// loadMinors.js (screens/team/data/) runs for the team hub's own org-wide
// prospect table, factored out here so both callers share one fix rather
// than drifting apart; plus a level-SPLIT stat line neither caller needed
// before this.
// ---------------------------------------------------------------------------

// Resolves each ranked player's CURRENT level by live roster membership — the
// scraped `levelRaw` string is sometimes ambiguous (e.g. "ALL (2)" for a
// player who's played at multiple levels this season, which is most of the
// board: a young prospect typically splits time between a complex/rookie
// club and his first full-season affiliate) or stale (a recent call-up).
// `p.teamId` in the snapshot is each player's MLB parent org, so this fans
// out an affiliate tree — full-season AAA/AA/A+/A PLUS complex/rookie clubs,
// since fetchAffiliates alone omits the latter (see prospectAffiliateMap's
// own note above, and fetchComplexAffiliates in team.js) — plus a 40-man
// roster lookup per distinct org, then falls back to this season's stats
// across the same org's teams for anyone roster membership still misses
// (released, a stint between assignments, a foreign-league loanee). A player
// nothing resolves gets a plain null (the caller's own dash) rather than the
// raw ambiguous string.
//
// Also attaches `lines` — 1 or 2 display strings for the "Line" column.
// Every org's teams' season stats are fetched regardless of roster
// resolution now (previously only a fallback for the unresolved), since a
// level-split line needs each player's per-team splits either way; the level
// fallback above reuses that same fetch rather than paying for it twice.
// `loadCombinedPoolForTeams`'s pool entries carry each player's RAW
// hitting/pitching splits (statsLevels.js), still tagged with `sport.id` per
// split, so this partitions them into an MLB-only slice and a MiLB slice
// summed ACROSS every level in the org's farm tree (AAA down through
// complex/rookie) — "MiLB" here is one combined line, not one per level.
// Two lines only when BOTH slices have a line AND he's currently rostered at
// MLB; a player who was up this year but has since been optioned back down
// gets only his MiLB line — showing a partial-season MLB line for someone no
// longer up there reads as "he's in the majors," which he isn't right now.
// Degrades to the original scraped `statLine`, unprefixed, if live stats
// resolve to nothing at all (same "never show a blank" stance as the level
// fallback above).
export async function resolveCurrentLevels(players) {
  const season = new Date().getFullYear()
  const orgIds = [...new Set(players.map((p) => p.teamId).filter(Boolean))]
  const [affiliatesByOrg, complexAffiliatesByOrg] = await Promise.all([
    Promise.all(orgIds.map((id) => fetchAffiliates(id, season))),
    Promise.all(orgIds.map((id) => fetchComplexAffiliates(id, season))),
  ])

  const teamById = new Map()
  const teamIdsByOrg = new Map()
  orgIds.forEach((orgId, i) => {
    const farmTeams = [...affiliatesByOrg[i], ...complexAffiliatesByOrg[i]]
    teamById.set(orgId, { id: orgId, sportId: 1 })
    for (const aff of farmTeams) teamById.set(aff.id, aff)
    teamIdsByOrg.set(orgId, [orgId, ...farmTeams.map((aff) => aff.id)])
  })

  // `40Man`, not the default `active` roster, so a prospect on the 7-/60-day
  // IL still resolves to his real affiliate instead of falling through.
  const [rosterIds, poolByOrg] = await Promise.all([
    fetchRosterIdsForTeams([...teamById.keys()], '40Man'),
    Promise.all(
      orgIds.map((orgId) => loadCombinedPoolForTeams(teamIdsByOrg.get(orgId).map((id) => ({ id })), season)),
    ),
  ])
  const teamByPlayer = prospectAffiliateMap(rosterIds)
  const poolEntryByOrgAndPlayer = new Map(
    orgIds.map((orgId, i) => [orgId, new Map(poolByOrg[i].map((row) => [row.id, row]))]),
  )

  return players.map((p) => {
    const resolvedTeamId = teamByPlayer.get(p.playerId) ?? null
    const resolvedTeam = resolvedTeamId ? teamById.get(resolvedTeamId) : null
    const statRow = poolEntryByOrgAndPlayer.get(p.teamId)?.get(p.playerId)

    const levelLabel = resolvedTeam
      ? SPORT_LABEL[resolvedTeam.sportId] ?? p.levelRaw
      : statRow?.teamId && statRow?.sportId
        ? SPORT_LABEL[statRow.sportId] ?? p.levelRaw
        : /^ALL\b/i.test(p.levelRaw ?? '') ? null : p.levelRaw

    const pitching = isPitcher(p.position)
    const splits = statRow ? (pitching ? statRow.pitchingSplits : statRow.hittingSplits) : []
    const mlbSplits = splits.filter((s) => s.sport?.id === MLB_SPORT_ID)
    const milbSplits = splits.filter((s) => s.sport?.id && s.sport.id !== MLB_SPORT_ID)
    const mlbLine = levelLabel === 'MLB' ? statLineFrom(mlbSplits, pitching) : null
    const milbLine = statLineFrom(milbSplits, pitching)

    const lines =
      mlbLine && milbLine
        ? [`(MLB) ${mlbLine}`, `(MiLB) ${milbLine}`]
        : [mlbLine ?? milbLine ?? p.statLine].filter(Boolean)

    return { ...p, levelLabel, lines }
  })
}
