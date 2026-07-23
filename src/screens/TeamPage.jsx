import { useMemo, useState } from 'react'
import {
  fetchTeam,
  fetchTeamRoster,
  fetchTeamIL,
  fetchStandings,
  fetchLeagueTeamStats,
  fetchAffiliates,
  fetchComplexAffiliates,
  fetchRosterIdsForTeams,
  fetchTeamRosterIds,
} from '../api/team.js'
import { fetchAllStarRosterIds, fetchPersonStats } from '../api/person-fetch.js'
import {
  fetchTeamUniformCatalog,
  fetchGameJerseys,
  fetchUniformNameOverrides,
  buildJerseyCombos,
} from '../api/uniforms.js'
import { fetchManager } from '../api/game.js'
import { fetchTeamSchedule, fetchAllStarGame } from '../api/schedule.js'
import { fetchWarData } from '../api/war.js'
import { resolveGameNotes } from '../api/gameNotes.js'
import { fetchSeasonScores, leagueSurpriseScoresFor, seasonScoreFor } from '../api/seasonScore.js'
import { fetchTeamScores, teamScoreFor, leagueScoresFor, leagueSeasonGradesFor } from '../api/teamScore.js'
import { fetchComebackWins, leagueComebackWinsFor } from '../api/comebackWins.js'
import { fetchPostseasonOdds, postseasonOddsFor } from '../api/postseasonOdds.js'
import { parentOrgHistory } from '../api/milbHistory.js'
import { fetchTeamLogoTint } from '../api/person-fetch.js'
import { rankTeam, ordinal, rosterPitcherRole, firstLast, POS_ORDER, isTwoWay } from '../api/person.js'
import { fetchTopProspects, orgProspectsForTeam, prospectAffiliateMap, prospectBadge } from '../api/prospects.js'
import { fetchRookiesData, showRookiePill } from '../api/rookies.js'
import { loadMoreTeamTransactions } from '../api/teamTransactions.js'
import { SPORT_LABEL, favoriteAccentColor, teamClubName } from '../lib/teams.js'
import { gamePath } from '../lib/route.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { LinkScope } from '../lib/nav.jsx'
import { useNav } from '../lib/nav.js'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { TeamTreatmentMark } from '../components/TeamTreatmentMark.jsx'
import { JerseyCombos } from '../components/JerseyCombos.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { CareerTimeline } from '../components/CareerTimeline.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { ManagerLink } from '../components/ManagerLink.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { ProspectPill } from '../components/ProspectPill.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsOfBanner } from '../components/AsOfBanner.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncGate } from '../components/AsyncGate.jsx'
import { SectionTitle } from '../components/SectionTitle.jsx'
import { TeamLeaders } from '../components/TeamLeaders.jsx'
import { DefenseDiamond } from '../components/DefenseDiamond.jsx'
import { InjuredMark } from '../components/InjuredMark.jsx'
import { RookiePill } from '../components/RookiePill.jsx'
import { TeamScoreCard } from '../components/TeamScoreCard.jsx'
import { TeamTransactionsCard } from '../components/TeamTransactionsCard.jsx'
import { PostseasonOddsCard } from '../components/PostseasonOddsCard.jsx'
import { FEATURED_CATEGORIES } from '../api/teamLeaders.js'
import { loadCombinedPoolForTeams } from '../api/statsLevels.js'
import { teamLeadersPath, orgLeadersPath } from '../lib/route.js'

const DASH = '—'
// Org prospect list starts collapsed to the top 10, expandable to the full ~30.
const PROSPECTS_PREVIEW_COUNT = 10
// Headshot spotlight strip above the ranked table shows only the very top of
// the list; how many of these actually render is viewport-width-driven (see
// .prospectshowcase in index.css), this is just the outer cap.
const PROSPECT_SHOWCASE_COUNT = 5
const ROLE_ORDER = { SP: 0, CL: 1, RP: 2 }
// Injured-List sort: shortest stint first (7/10 → 15 → 60 → full-season), then name.
const IL_ORDER = { 7: 0, 10: 1, 15: 2, 60: 3, IL: 4 }
// The Preferred Lineup diamond's eight field spots plus DH, in no particular
// order (DefenseDiamond itself lays the field spots out; DH rides beneath).
const PREFERRED_LINEUP_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
function nickname(name) {
  return (name || '').split(/\s+/).slice(-1)[0] || name || DASH
}
// A split record ('lastTen' / 'home' / 'away') as a "W-L" string, or DASH
// when the split is absent (thin/early feeds) — same convention as
// api/standings.js's own splitWL, kept local since this file already had its
// own lastTen() and the two shapers don't otherwise share code.
function splitWL(rec, type) {
  const t = (rec.records?.splitRecords ?? []).find((s) => s.type === type)
  return t ? `${t.wins}-${t.losses}` : DASH
}
function lastTen(rec) {
  return splitWL(rec, 'lastTen')
}
// Innings pitched ("104.1" = 104⅓) → outs, so the Bullpen sort's IP tiebreak
// compares linearly (see api/teamLeaders.js's identical ipToOuts — kept local
// here rather than imported since this file has no other reason to reach
// into that module).
function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return (Number(whole) || 0) * 3 + (Number(frac[0]) || 0)
}
// A roster row's season pitching stat object, same group-name selection as
// person.js's rosterPitcherRole — GS/SV/appearances/IP for the Starting
// Pitchers and Bullpen lists. Callers must pre-filter to actual pitchers
// (r.position?.type === 'Pitcher'); the `?? stats[0]` fallback exists only
// for a true pitcher whose stats array happens to lack a pitching split yet,
// and would misread a position player's hitting split as pitching otherwise.
//
// A player who's changed teams mid-season (trade, waiver claim, DFA pickup)
// carries MULTIPLE splits here — one per team, each tagged `.team.id`, same
// shape person.js's fieldingView already has to guard against for the
// per-player fielding endpoint. Blindly reading splits[0] silently picked up
// whichever row happened to sort first, which could be an ex-team's line (or
// a team-less season aggregate) — a Brewers page showing a recent pickup's
// FULL season numbers, snuck-in appearances from a team he's since left
// included. `preferTeamSplits` narrows to the CURRENT team's own row(s)
// first, falling back to the raw list only when nothing is team-tagged (the
// normal case for someone who's been here all year).
function preferTeamSplits(splits, teamId) {
  const teamRows = splits.filter((s) => s.team?.id === teamId)
  return teamRows.length ? teamRows : splits
}
function rosterPitchingStat(r, teamId) {
  const stats = r.person?.stats ?? []
  const pit = stats.find((s) => s.group?.displayName === 'pitching') ?? stats[0]
  const splits = preferTeamSplits(pit?.splits ?? [], teamId)
  return splits[0]?.stat ?? null
}
// A roster row's season fielding splits (one per position played, filtered
// to this team — see preferTeamSplits above) — see fetchTeamRoster's hydrate
// note (api/team.js) on why this needs live verification. Feeds the
// Preferred Lineup diamond below.
function rosterFieldingSplits(r, teamId) {
  const stats = r.person?.stats ?? []
  const splits = stats.find((s) => s.group?.displayName === 'fielding')?.splits ?? []
  return preferTeamSplits(splits, teamId)
}
// A roster row's season hitting line (filtered to this team — see
// preferTeamSplits) — feeds the Top Substitutes list's games-played ranking.
function rosterHittingStat(r, teamId) {
  const stats = r.person?.stats ?? []
  const hit = stats.find((s) => s.group?.displayName === 'hitting')
  const splits = preferTeamSplits(hit?.splits ?? [], teamId)
  return splits[0]?.stat ?? null
}
// Grouped SP → CL → RP (ROLE_ORDER), then descending by season WAR within
// each group — a missing WAR (MiLB, or an MLB arm WAR hasn't caught up to
// yet) sorts last in its group rather than crashing the comparison, falling
// back to jersey number. Named (not inline) since the Current Roster
// Pitchers list re-sorts after patching a role in place — see pitchers'
// recentStarterIds fixup below.
function comparePitchers(a, b) {
  return (
    (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3) ||
    (b.war ?? -Infinity) - (a.war ?? -Infinity) ||
    Number(a.jersey) - Number(b.jersey)
  )
}
function runDiff(rec) {
  const d = rec.runDifferential
  if (!Number.isFinite(d)) return DASH
  return d > 0 ? `+${d}` : `${d}`
}
function runDiffTone(rec) {
  const d = rec.runDifferential
  if (!Number.isFinite(d) || d === 0) return ''
  return d > 0 ? 'is-positive' : 'is-negative'
}

function statRank(rows, teamId, key, label, lowerBetter) {
  const mine = rows.find((r) => r.teamId === teamId)
  const r = rankTeam(rows, teamId, key, lowerBetter)
  const tone = r ? (r.rank <= 5 ? 'good' : r.rank >= 20 ? 'bad' : '') : ''
  // Top-5 / bottom-5 gets the whole ROW tinted, a stronger claim than the
  // rank ordinal's plain good/bad tone — bottom-5 measured off r.of (not a
  // hardcoded 30, since a rank pool's size isn't guaranteed).
  const extreme = r ? (r.rank <= 5 ? 'best' : r.rank > r.of - 5 ? 'worst' : '') : ''
  return { k: label, v: mine?.stat?.[key] ?? DASH, rank: r ? ordinal(r.rank) : DASH, tone, extreme }
}

async function loadTeam(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const season = Number((asOf || isoToday()).slice(0, 4))
  const standingsDate = asOf ? dayBefore(asOf) : null
  // The MLB parent's own id — same value whether this page IS the parent or
  // one of its affiliates (team.parentOrgId rides along on a MiLB team's
  // /teams response). Every prospect belongs to the org, not to one specific
  // affiliate, so both the parent's page and every affiliate's page show the
  // same org-wide leaderboard (see the Prospects section below).
  const orgId = sportId === 1 ? id : team.parentOrgId ?? null

  const [roster, fullRoster, leaderPool, ilRoster, standings, league, allStarIds, warData, seasonScores, teamScores, postseasonOddsData, affiliates, complexAffiliates, prospectsSnapshot, schedule, allStarGame, manager, rookiesData, transactionsPage, comebackWinsData, uniformCatalog, uniformNameOverrides] =
    await Promise.all([
      fetchTeamRoster(id, season, { sportId }),
      // 40Man superset of the active roster above — the Roster super-section
      // (Preferred Lineup / Starting Pitchers / Bullpen) draws from THIS one
      // instead, deliberately including the IL and rehab assignments: a
      // season's #1 starter at a spot, or a team's ace, doesn't stop being
      // the "preferred" answer just because he's hurt right now (the
      // Injured List section already flags that separately via the shared
      // IL glyph) — see rosterPitchingStat.
      fetchTeamRoster(id, season, { sportId, rosterType: '40Man' }),
      // The leaderboard pool, built from the club's season stats rather than
      // its current roster — so a player traded away, released, or promoted
      // off the club still ranks, scoped to only his stats from while he was
      // here (see loadCombinedPoolForTeams). The plain active `roster` above
      // still drives the roster-listing sections.
      loadCombinedPoolForTeams([{ id }], season),
      fetchTeamIL(id, season),
      team.league?.id
        ? fetchStandings(team.league.id, season, standingsDate)
        : Promise.resolve([]),
      sportId === 1 ? fetchLeagueTeamStats(season) : Promise.resolve({ hitting: [], pitching: [] }),
      sportId === 1 ? fetchAllStarRosterIds(season) : Promise.resolve(new Set()),
      sportId === 1 ? fetchWarData() : Promise.resolve({ season: null, bat: {}, pit: {} }),
      sportId === 1 ? fetchSeasonScores() : Promise.resolve(null),
      sportId === 1 ? fetchTeamScores() : Promise.resolve(null),
      sportId === 1 ? fetchPostseasonOdds() : Promise.resolve(null),
      // The affiliate tree is keyed off the ORG id (not `id`), so an
      // affiliate's own page gets the same tree its MLB parent would.
      orgId ? fetchAffiliates(orgId, season) : Promise.resolve([]),
      // Complex/rookie-level clubs, resolved separately — see
      // fetchComplexAffiliates for why they can't just join AFFILIATE_SPORT_IDS.
      orgId ? fetchComplexAffiliates(orgId, season) : Promise.resolve([]),
      fetchTopProspects(),
      fetchTeamSchedule(id, season, sportId, standingsDate),
      // MLB only — MiLB clubs play through the break, so no All-Star card
      // belongs in their strip.
      sportId === 1 ? fetchAllStarGame(season) : Promise.resolve(null),
      // Degrades to null on a thin MiLB feed (see fetchManager's own
      // try/catch) — the header line below simply hides.
      fetchManager(id, season),
      fetchRookiesData(),
      // MLB orgs only in phase 1 (see data-layer-scope.md) — a MiLB affiliate
      // page gets no card. Just the first 45-day page; "Load more" pages
      // further back on demand from inside the card itself.
      sportId === 1
        ? loadMoreTeamTransactions(id, null, asOf).catch(() => ({ days: [], cursor: null, hasMore: false }))
        : Promise.resolve({ days: [], cursor: null, hasMore: false }),
      sportId === 1 ? fetchComebackWins() : Promise.resolve(null),
      // This club's own season uniform catalog + the curated jersey-name map,
      // for the record-by-jersey strip below. MLB only — /uniforms/team
      // returns nothing for MiLB (see fetchTeamUniformCatalog).
      sportId === 1 ? fetchTeamUniformCatalog([id], season) : Promise.resolve({}),
      sportId === 1 ? fetchUniformNameOverrides() : Promise.resolve({}),
    ])

  // Each org prospect's CURRENT level, resolved by live roster membership
  // (not the scraped, sometimes-ambiguous level string, e.g. "ALL (2)") — a
  // second small fan-out over this org's affiliates (full-season AAA/AA/A+/A
  // PLUS complex/rookie clubs) PLUS the MLB roster itself, so a prospect
  // who's been called up resolves to MLB rather than his last MiLB stop.
  // `rosterType=40Man` (not the default 'active') so a prospect currently on
  // a 7-/60-day IL still resolves to his real affiliate instead of falling
  // through to the scraped level text with no logo. `fetchAffiliates` /
  // `fetchComplexAffiliates` both exclude the org's own MLB team, so it's
  // added in here; on the org's own page `roster` already IS that MLB roster
  // and needs no extra fetch.
  const farmTeams = [...affiliates, ...complexAffiliates]
  const affiliateRosterIds = farmTeams.length
    ? await fetchRosterIdsForTeams(farmTeams.map((a) => a.id), '40Man')
    : {}
  if (orgId) {
    affiliateRosterIds[orgId] =
      sportId === 1 ? roster.map((r) => r.person?.id).filter(Boolean) : await fetchTeamRosterIds(orgId, '40Man')
  }
  const affiliateByPlayer = prospectAffiliateMap(affiliateRosterIds)
  const affiliateById = new Map(farmTeams.map((a) => [a.id, a]))
  if (orgId) {
    affiliateById.set(orgId, { id: orgId, sportId: 1, name: sportId === 1 ? team.name : team.parentOrgName })
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
  // WAR data is a single current-season file (see src/api/war.js); only trust
  // it when its season matches the team page's — otherwise (a historical
  // `asOf` team page, or MiLB with no WAR source) every badge shows DASH
  // rather than mislabeling a stale/wrong-season figure as current.
  const warBat = warData.season === season ? warData.bat : {}
  const warPit = warData.season === season ? warData.pit : {}

  // Affiliation history — the ordered MLB parent orgs this farm club has belonged
  // to over time (MiLB pages only; an MLB team has no parent). Shaped exactly
  // like the player page's career "Team history" stops so it can reuse that same
  // component: each stop is the org's logo on a wash of its own colors, with the
  // season span beneath. Empty for a club that never switched orgs (not in the
  // history file) — the strip then hides. See api/milbHistory.js.
  const affiliationHistory =
    sportId === 1
      ? []
      : await Promise.all(
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

  const div = standings.find((r) => r.division?.id === team.division?.id)
  const myRec = div?.teamRecords?.find((t) => t.team.id === id)
  // The live standings view is intentionally current, but the precomputed score
  // is always through the latest completed day. A dated page uses the exact same
  // day-before cutoff as its standings request, so the score never looks ahead.
  const scoreCutoff = asOf ? dayBefore(asOf) : dayBefore(isoToday())
  const seasonScore = sportId === 1 ? seasonScoreFor(seasonScores, id, season, scoreCutoff) : null
  const teamScore = sportId === 1 ? teamScoreFor(teamScores, id, season, scoreCutoff) : null
  const leagueGradeScores = sportId === 1 ? leagueSeasonGradesFor(teamScores, seasonScores, season, scoreCutoff) : []
  const leagueSeasonScores = sportId === 1 ? leagueScoresFor(teamScores, season, scoreCutoff, 'season') : []
  const leagueSurpriseScores = sportId === 1 ? leagueSurpriseScoresFor(seasonScores, season, scoreCutoff) : []
  const leagueFormScores = sportId === 1 ? leagueScoresFor(teamScores, season, scoreCutoff, 'currentForm') : []
  const postseasonOdds = sportId === 1 ? postseasonOddsFor(postseasonOddsData, id, season, scoreCutoff) : null
  const standingsRows = (div?.teamRecords ?? []).map((t) => ({
    id: t.team.id,
    name: nickname(t.team.name),
    wins: t.wins,
    losses: t.losses,
    gb: t.gamesBack,
    streak: t.streak?.streakCode ?? DASH,
    l10: lastTen(t),
    home: splitWL(t, 'home'),
    away: splitWL(t, 'away'),
    diff: runDiff(t),
    diffTone: runDiffTone(t),
    isMe: t.team.id === id,
  }))

  // Record-by-jersey strip (MLB only) — one card per catalog jersey, tagged
  // with its logo treatment and the club's W-L in the games it wore it. The
  // worn-jersey join needs the per-game uniform assignment, one extra batched
  // /uniforms/game call over just the games with a VISIBLE result (`won`
  // already cutoff-gated by fetchTeamSchedule above), so an `asOf` team page
  // never counts a game past its own spoiler cutoff. Skipped for a club with
  // no catalog (MiLB) — buildJerseyCombos then returns [].
  const decidedGames = schedule.filter((g) => g.won != null)
  const wornByGame =
    sportId === 1 && decidedGames.length
      ? await fetchGameJerseys(decidedGames.map((g) => g.gamePk))
      : {}
  const jerseyCombos =
    sportId === 1
      ? buildJerseyCombos({
          catalogAssets: uniformCatalog[id] ?? [],
          clubName: teamClubName(id),
          schedule,
          wornByGame,
          teamId: id,
          nameOverrides: uniformNameOverrides,
        })
      : []

  const batting = league.hitting.length
    ? [
        statRank(league.hitting, id, 'runs', 'Runs', false),
        statRank(league.hitting, id, 'homeRuns', 'Home runs', false),
        statRank(league.hitting, id, 'avg', 'AVG', false),
        statRank(league.hitting, id, 'ops', 'OPS', false),
        statRank(league.hitting, id, 'stolenBases', 'Stolen bases', false),
        statRank(league.hitting, id, 'hits', 'Hits', false),
        statRank(league.hitting, id, 'groundIntoDoublePlay', 'GIDP', true),
        statRank(league.hitting, id, 'atBatsPerHomeRun', 'AB/HR', true),
        statRank(league.hitting, id, 'babip', 'BABIP', false),
      ]
    : null
  const pitching = league.pitching.length
    ? [
        statRank(league.pitching, id, 'era', 'ERA', true),
        statRank(league.pitching, id, 'whip', 'WHIP', true),
        statRank(league.pitching, id, 'strikeOuts', 'Strikeouts', false),
        statRank(league.pitching, id, 'saves', 'Saves', false),
        statRank(league.pitching, id, 'shutouts', 'Shutouts', false),
        statRank(league.pitching, id, 'completeGames', 'Complete games', false),
        statRank(league.pitching, id, 'avg', 'AVG against', true),
        statRank(league.pitching, id, 'strikeoutsPer9Inn', 'SO/9', false),
        statRank(league.pitching, id, 'walksPer9Inn', 'BB/9', true),
        statRank(league.pitching, id, 'strikeoutWalkRatio', 'K/BB', false),
        statRank(league.pitching, id, 'groundIntoDoublePlay', 'GDP', false),
        statRank(league.pitching, id, 'wildPitches', 'WP', true),
        statRank(league.pitching, id, 'pitchesPerInning', 'P/IP', true),
      ]
    : null

  // Comeback wins — wins after the team's win probability fell below 10/20/30%
  // (nested). Ranked against the league like batting/pitching, but shown ONLY
  // when this club has at least one such win: sub30 is the widest bucket, so
  // sub30 === 0 means all three are zero and the card is hidden.
  const comebackRows = leagueComebackWinsFor(comebackWinsData, season)
  const myComeback = comebackRows.find((r) => r.teamId === id)?.stat
  const comeback =
    myComeback && myComeback.sub30 > 0
      ? [
          statRank(comebackRows, id, 'sub10', '< 10%', false),
          statRank(comebackRows, id, 'sub20', '< 20%', false),
          statRank(comebackRows, id, 'sub30', '< 30%', false),
        ]
      : null

  const position = roster
    .filter((r) => r.position?.type !== 'Pitcher')
    .map((r) => ({
      id: r.person?.id,
      name: firstLast(r.person),
      jersey: r.jerseyNumber ?? '',
      pos: r.position?.abbreviation ?? '',
      allStar: allStarIds.has(r.person?.id),
      war: sportId === 1 ? warBat[r.person?.id] ?? null : undefined,
      prospect: prospectBadge(prospectsSnapshot, r.person?.id),
      rookie: showRookiePill(rookiesData, r.person?.id, sportId === 1),
    }))
    .sort((a, b) => (POS_ORDER[a.pos] ?? 5) - (POS_ORDER[b.pos] ?? 5) || a.name.localeCompare(b.name))

  // A two-way player (Ohtani-type) carries a single roster spot typed
  // 'Two-Way Player', not 'Pitcher' — include him here too (isTwoWay) so his
  // pitching side isn't dropped from the roster entirely; he still also
  // shows above among position players with his own TWP badge, since
  // `position`'s filter is untouched.
  const pitchers = roster
    .filter((r) => r.position?.type === 'Pitcher' || isTwoWay(r.person))
    .map((r) => ({
      id: r.person?.id,
      name: firstLast(r.person),
      jersey: r.jerseyNumber ?? '',
      role: rosterPitcherRole(r),
      allStar: allStarIds.has(r.person?.id),
      war: sportId === 1 ? warPit[r.person?.id] ?? null : undefined,
      prospect: prospectBadge(prospectsSnapshot, r.person?.id),
      rookie: showRookiePill(rookiesData, r.person?.id, sportId === 1),
    }))
    .sort(comparePitchers)

  // Starting Pitchers / Bullpen draw from the 40Man `fullRoster` (see its
  // fetch above) rather than the active-only `pitchers` list above, so a
  // team's ace still shows up while he's on the IL or a minors rehab stint.
  const fullPitchers = fullRoster
    .filter((r) => r.position?.type === 'Pitcher' || isTwoWay(r.person))
    .map((r) => {
      const stat = rosterPitchingStat(r, id)
      return {
        id: r.person?.id,
        name: firstLast(r.person),
        jersey: r.jerseyNumber ?? '',
        allStar: allStarIds.has(r.person?.id),
        war: sportId === 1 ? warPit[r.person?.id] ?? null : undefined,
        prospect: prospectBadge(prospectsSnapshot, r.person?.id),
        rookie: showRookiePill(rookiesData, r.person?.id, sportId === 1),
        gs: Number(stat?.gamesStarted) || 0,
        saves: Number(stat?.saves) || 0,
        appearances: Number(stat?.gamesPitched ?? stat?.gamesPlayed) || 0,
        ipOuts: ipToOuts(stat?.inningsPitched),
        ip: stat?.inningsPitched ?? DASH,
        era: stat?.era ?? DASH,
      }
    })
  // Which of these pitchers is CURRENTLY starting, from each one's own most
  // recent outing — a season-total games-started count alone misreads a
  // pitcher who's moved from the bullpen into the rotation mid-season (his
  // total still trails arms who started all year), which drops him into the
  // Bullpen list below despite him taking the ball every 5th day now. One
  // gameLog fetch per pitcher (bounded to the 40-man staff, ~13-15 arms), so
  // this genuinely costs an extra request round-trip beyond the rest of the
  // page — worth it for a section whose whole point is "who's pitching for
  // this team right now."
  const recentStarterIds = new Set(
    (
      await Promise.allSettled(
        fullPitchers
          .filter((p) => p.id)
          .map(async (p) => {
            const splits = await fetchPersonStats(p.id, {
              type: 'gameLog',
              group: 'pitching',
              season,
              sportId,
            })
            const last = [...splits]
              .filter((s) => s.date)
              .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
            return last?.stat?.gamesStarted === 1 ? p.id : null
          }),
      )
    )
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter(Boolean),
  )
  // The Current Roster's own Pitchers list (below) shows literal current
  // status, not a projection — so its SP/RP/CL badge needs the same recency
  // fix: rosterPitcherRole reads the season-long innings ratio, which still
  // calls a mid-season bullpen-to-rotation convert an RP until his total
  // catches up. A pitcher whose last outing was a start reads as SP here
  // regardless of what the season ratio says (this only ever promotes,
  // never demotes a role rosterPitcherRole already called SP) — then the
  // list re-sorts since a patched role can move him into a different group.
  for (const p of pitchers) {
    if (recentStarterIds.has(p.id)) p.role = 'SP'
  }
  pitchers.sort(comparePitchers)
  // Starting Pitchers — pure season projection, top 5 by games started,
  // health status irrelevant (this card is deliberately "who's the best
  // answer here regardless of health," per the injured/rehab-eligible design
  // — see fullPitchers above). The recency signal above (recentStarterIds)
  // is ONLY for the Current Roster's literal-status role badge; folding it
  // in here too previously bumped a higher-GS injured ace (e.g. an
  // established starter on the IL) below a healthy but lower-GS teammate,
  // which is backwards for a projection view.
  const startingPitchers = [...fullPitchers]
    .filter((p) => p.gs > 0)
    .sort((a, b) => b.gs - a.gs || Number(a.jersey) - Number(b.jersey))
    .slice(0, 5)
  // Bullpen — everyone else who's actually pitched. The closer (most saves,
  // if anyone has one) leads the list; everyone else is ranked by workload
  // (appearances, innings as the tiebreak) rather than by their own save
  // total, so a mop-up guy with one vulture save doesn't outrank the actual
  // setup crew. Capped at 8: the current CBA caps an active roster at 13
  // pitchers, and a standard 5-man rotation leaves 8 relief spots.
  const startingIds = new Set(startingPitchers.map((p) => p.id))
  const relievers = fullPitchers.filter((p) => !startingIds.has(p.id) && p.appearances > 0)
  const maxSaves = relievers.reduce((max, p) => Math.max(max, p.saves), 0)
  const closer = maxSaves > 0 ? relievers.find((p) => p.saves === maxSaves) : null
  const setupCrew = relievers
    .filter((p) => p !== closer)
    .sort((a, b) => b.appearances - a.appearances || b.ipOuts - a.ipOuts)
  const bullpen = (closer ? [closer, ...setupCrew] : setupCrew).slice(0, 8)

  // Preferred Lineup — one player per field position, off the 40Man
  // `fullRoster` (so an injured/rehabbing regular still counts — the same
  // reasoning as fullPitchers above), keyed FIRST off each player's CURRENT
  // primary position (r.position?.abbreviation — the same field the
  // `position` list's own `pos` column reads) rather than season-cumulative
  // games started: a player who's since moved off a position (e.g. a
  // shortstop slid to third once a rookie took over) still owns the
  // season's higher SS games-started total, so ranking each position
  // independently by GS double-booked him at both SS and 3B. GS only breaks
  // ties among teammates who share a primary position (rare — a real battle
  // for a spot).
  //
  // A position can still come up empty on primary position alone (a thin
  // feed, or the incumbent's primary-position tag hasn't caught up with a
  // recent move) — a SECOND pass fills any position still open with
  // whoever has the most games started there among players not already
  // claimed elsewhere, so a spot that's genuinely been played this season
  // never shows unresolved. DH skips the first pass entirely (it's almost
  // never anyone's primary position — most clubs rotate several regulars
  // through it) and goes straight to the games-started fallback.
  const gsAt = (r, pos) =>
    Number(rosterFieldingSplits(r, id).find((s) => s.position?.abbreviation === pos)?.stat?.gamesStarted) || 0
  const bestByPosition = {}
  const claimed = new Set()
  for (const pos of PREFERRED_LINEUP_POSITIONS) {
    if (pos === 'DH') continue
    const candidates = fullRoster.filter((r) => r.person?.id && r.position?.abbreviation === pos)
    if (!candidates.length) continue
    const best = candidates.reduce((a, b) => (gsAt(b, pos) > gsAt(a, pos) ? b : a))
    bestByPosition[pos] = {
      position: pos,
      id: best.person.id,
      last: nickname(firstLast(best.person)),
      gs: gsAt(best, pos),
    }
    claimed.add(best.person.id)
  }
  for (const pos of PREFERRED_LINEUP_POSITIONS) {
    if (bestByPosition[pos]) continue
    let best = null
    for (const r of fullRoster) {
      const pid = r.person?.id
      if (!pid || claimed.has(pid)) continue
      const gs = gsAt(r, pos)
      if (gs > 0 && (!best || gs > best.gs)) best = { position: pos, id: pid, last: nickname(firstLast(r.person)), gs }
    }
    if (best) {
      bestByPosition[pos] = best
      claimed.add(best.id)
    }
  }
  const preferredLineup = PREFERRED_LINEUP_POSITIONS.map((pos) => bestByPosition[pos]).filter(Boolean)

  // Top Substitutes — the position players who DIDN'T win one of the nine
  // diamond spots above, ranked by how much they've actually played (season
  // games). Same 40Man `fullRoster` source as the lineup, minus everyone
  // already claimed there, so it reads as "next men up / the bench behind the
  // preferred nine." Games-played gate drops the 40-man depth pieces who've
  // barely appeared; capped at 6 to stay a bench, not a second roster list.
  const lineupIds = new Set(preferredLineup.map((p) => p.id))
  const substitutes = fullRoster
    .filter(
      (r) =>
        r.person?.id &&
        (r.position?.type !== 'Pitcher' || isTwoWay(r.person)) &&
        !lineupIds.has(r.person.id),
    )
    .map((r) => ({
      id: r.person.id,
      name: firstLast(r.person),
      jersey: r.jerseyNumber ?? '',
      pos: r.position?.abbreviation ?? '',
      allStar: allStarIds.has(r.person?.id),
      war: sportId === 1 ? warBat[r.person?.id] ?? null : undefined,
      prospect: prospectBadge(prospectsSnapshot, r.person?.id),
      rookie: showRookiePill(rookiesData, r.person?.id, sportId === 1),
      games: Number(rosterHittingStat(r, id)?.gamesPlayed) || 0,
    }))
    .filter((p) => p.games > 0)
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, 6)

  // Injured List — every injured player on the club's 40-man view in one combined
  // list, each tagged with which IL (10/15/60-day; MiLB shows 7/60/full-season).
  // Filter to IL status codes (D<n> or ILF) and derive the badge from the code.
  // Spoiler-free — roster membership reveals nothing about the score. Degrades to
  // an empty list when no IL is posted (the section then hides).
  const injured = ilRoster
    .filter((r) => /^D\d+$/.test(r.status?.code ?? '') || r.status?.code === 'ILF')
    .map((r) => {
      const code = r.status?.code ?? ''
      return {
        id: r.person?.id,
        name: firstLast(r.person),
        jersey: r.jerseyNumber ?? '',
        pos: r.position?.abbreviation ?? '',
        ilLabel: code.match(/^D(\d+)$/)?.[1] ?? (code === 'ILF' ? 'IL' : DASH),
      }
    })
    .sort(
      (a, b) => (IL_ORDER[a.ilLabel] ?? 9) - (IL_ORDER[b.ilLabel] ?? 9) || a.name.localeCompare(b.name),
    )

  return {
    team, season, sportId,
    record: myRec
      ? { wins: myRec.wins, losses: myRec.losses, rank: myRec.divisionRank, div: team.division?.name }
      : null,
    seasonScore,
    teamScore,
    leagueGradeScores,
    leagueSeasonScores,
    leagueSurpriseScores,
    leagueFormScores,
    postseasonOdds,
    transactionsPage,
    standings: standingsRows,
    jerseyCombos,
    batting, pitching, comeback, position, pitchers, injured,
    preferredLineup, substitutes, startingPitchers, bullpen,
    affiliationHistory, affiliates, prospects, schedule, allStarGame, leaderPool,
    manager,
  }
}

// The club's most recent official press-notes PDF — a direct link-out (never
// the What's Brewing in-app modal the lineup page's Game Notes button opens
// for calibrated clubs; the team hub always jumps straight to the PDF, since
// there's no single game's blurbs to parse). No gameDate, so resolveGameNotes
// falls through to the newest note on file rather than one tied to tonight's
// game. MLB only — see gameNotes.js.
function GameNotesLink({ teamId }) {
  const { data: notes } = useAsync(() => resolveGameNotes(teamId), [teamId])
  if (!notes?.url) return null
  return (
    <a
      className="notesbtn"
      href={notes.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${notes.title} — the club's official press notes (PDF), opens in a new tab`}
    >
      Game Notes
      <span className="notesbtn__ext" aria-hidden="true">↗</span>
    </a>
  )
}

export function TeamPage({ id, asOf, sportId }) {
  const teamId = Number(id)
  const navigate = useNav()
  const { loading, error, data } = useAsync(() => loadTeam(teamId, asOf), [teamId, asOf])
  useDocumentTitle(data?.team?.name || null)
  const back = () => window.history.back()
  // Store which team's list was expanded rather than a free-floating boolean,
  // so client-side navigation naturally starts every newly visited club at
  // the top-10 preview without a prop-syncing effect.
  const [expandedProspectsTeamId, setExpandedProspectsTeamId] = useState(null)
  const showAllProspects = expandedProspectsTeamId === teamId
  // Injured List starts fully collapsed (0 rows) on every club, same
  // team-keyed pattern as the prospects preview above.
  const [expandedInjuredTeamId, setExpandedInjuredTeamId] = useState(null)
  const showInjured = expandedInjuredTeamId === teamId

  const gate = AsyncGate({ loading, error, data, screenClass: 'team-hub', noun: 'team', onBack: back })
  if (gate) return gate

  const { team, season, record, seasonScore, teamScore, leagueGradeScores, leagueSeasonScores, leagueSurpriseScores, leagueFormScores, postseasonOdds, standings, jerseyCombos, batting, pitching, comeback, position, pitchers, injured, preferredLineup, substitutes, startingPitchers, bullpen, affiliationHistory, affiliates, prospects, schedule, allStarGame, leaderPool, manager, transactionsPage } = data
  const isMilb = (team.sport?.id ?? 1) !== 1
  // Flags a Team Leaders / Preferred Lineup entry with the IL cross — cheap
  // to build fresh each render (injured is a handful of rows), no
  // memoization needed.
  const injuredIds = new Set(injured.map((p) => p.id))
  const preferredLineupDefense = preferredLineup.map((p) => ({
    position: p.position,
    last: p.last,
    id: p.id,
    hurt: injuredIds.has(p.id),
  }))
  // On a MiLB affiliate page, lead the Affiliates section with a card for the
  // parent MLB club (which fetchAffiliates deliberately omits from the farm
  // tree). Location is unavailable from the static team record, so the card
  // degrades to just the mark + name — see the conditional loc line below.
  const affiliateCards =
    isMilb && team.parentOrgId
      ? [{ id: team.parentOrgId, sportId: 1, name: team.parentOrgName, city: '', state: '' }, ...affiliates]
      : affiliates

  return (
    <LinkScope asOf={asOf} sportId={data.sportId ?? sportId ?? null}>
      <div className="screen team-hub">
        <SiteHeader />
        <AsOfBanner asOf={asOf} />
        <BackBtn onClick={back} />

        <header className="team-hub__id">
          {/* The club's Main "logo card" — its mark on the curated tinted tile
              (the same treatment tile Team Color Lab prototyped and the slate
              cards wear), rather than a bare CDN logo. Degrades to the plain
              mark on paper for a MiLB club with no curated Main override. */}
          <div className="team-hub__logo">
            <TeamTreatmentMark
              teamId={team.id}
              name={team.name}
              treatment="main"
              size={64}
              block="team-hub__logobox"
            />
          </div>
          <div>
            <div className="team-hub__namerow">
              <h1>{team.name}</h1>
              {isMilb && (
                <span className="team-hub__level">{SPORT_LABEL[team.sport?.id] ?? DASH}</span>
              )}
            </div>
            {record && (
              <p className="team-hub__rec">
                <span className="mono">{record.wins}–{record.losses}</span>
                {record.rank && record.div && (
                  <span className="team-hub__div">{ordinal(record.rank)} · {record.div}</span>
                )}
                {asOf && <em>· entering today</em>}
              </p>
            )}
            {manager && (
              <p className="team-hub__manager">
                Manager: <ManagerLink id={manager.personId}>{manager.name}</ManagerLink>
                {manager.interim && <span className="team-hub__manager-interim"> (interim)</span>}
              </p>
            )}
          </div>
          {isMilb && team.parentOrgId && (
            <TeamLink id={team.parentOrgId} className="team-hub__parent">
              <TeamLogo teamId={team.parentOrgId} name={team.parentOrgName} size={45} />
            </TeamLink>
          )}
          {!isMilb && <GameNotesLink teamId={team.id} />}
        </header>

        {standings.length > 0 && (
          <>
            <SectionTitle title={team.division?.name || 'Standings'} note={asOf ? 'entering today' : ''} />
            <div className="ledger-wrap">
              <table className="standings">
                <thead>
                  <tr>
                    <th className="team">Team</th>
                    <th>W</th><th>L</th><th>GB</th><th>Streak</th><th>L10</th>
                    <th className="standings__wide">Home</th>
                    <th className="standings__wide">Away</th>
                    <th>RD</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s) => (
                    <tr
                      key={s.id}
                      className={s.isMe ? 'is-me' : ''}
                      style={s.isMe ? { '--fav-accent': favoriteAccentColor(s.id) } : undefined}
                    >
                      <td className="team">
                        <TeamLink id={s.isMe ? null : s.id}>
                          <TeamLogo teamId={s.id} name={s.name} size={18} />{s.name}
                        </TeamLink>
                      </td>
                      <td>{s.wins}</td><td>{s.losses}</td><td>{s.gb}</td>
                      <td>{s.streak}</td><td>{s.l10}</td>
                      <td className="standings__wide">{s.home}</td>
                      <td className="standings__wide">{s.away}</td>
                      <td className={s.diffTone}>{s.diff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <JerseyCombos combos={jerseyCombos} teamId={team.id} teamName={team.name} />

        {teamScore?.season?.score != null && (
          <TeamScoreCard
            snapshot={teamScore}
            surprise={seasonScore}
            teamId={team.id}
            leagueGradeScores={leagueGradeScores}
            leagueSeasonScores={leagueSeasonScores}
            leagueSurpriseScores={leagueSurpriseScores}
            leagueFormScores={leagueFormScores}
          />
        )}

        {transactionsPage.days.length > 0 && (
          <TeamTransactionsCard
            key={`${team.id}-${asOf ?? ''}`}
            teamId={team.id}
            asOf={asOf}
            initialDays={transactionsPage.days}
            initialCursor={transactionsPage.cursor}
            initialHasMore={transactionsPage.hasMore}
          />
        )}

        {schedule.length > 0 && (
          <>
            <SectionTitle title="Schedule" />
            <SeriesStrip
              key={`${team.id}-${asOf ?? ''}`}
              games={schedule}
              allStarGame={allStarGame}
              refDate={asOf || isoToday()}
            />
          </>
        )}

        {batting && <TeamStats title="Team batting" stats={batting} />}
        {pitching && <TeamStats title="Team pitching" stats={pitching} />}
        {comeback && <TeamStats title="Comeback wins" stats={comeback} />}

        <TeamLeaders
          pool={leaderPool}
          categories={FEATURED_CATEGORIES}
          onSeeAll={() => navigate(teamLeadersPath(teamId, { d: asOf, s: sportId }))}
          showTeamAbbr={false}
          injuredIds={injuredIds}
          horizontal
          // Org-wide leaders across the club's whole farm system — the MLB club
          // uses its own id, a MiLB affiliate its parent org's. Keys off the
          // team's real level (isMilb), not the sportId prop, which is null on a
          // bare /team/{id} link (it only carries a game's spoiler cutoff).
          secondaryAction={
            (!isMilb || team.parentOrgId) && (
              <button
                type="button"
                className="tlead__seeall"
                onClick={() =>
                  navigate(
                    orgLeadersPath(isMilb ? team.parentOrgId : teamId, { d: asOf, s: sportId }),
                  )
                }
              >
                Org leaders ›
              </button>
            )
          }
        />

        {postseasonOdds && <PostseasonOddsCard snapshot={postseasonOdds} />}

        {(preferredLineup.length > 0 || substitutes.length > 0 || startingPitchers.length > 0 || bullpen.length > 0) && (
          <>
            <SectionTitle title="Roster" note="preferred lineup" />
            {/* One bordered soft-cream card (same convention as .tstats-card)
                around all the projection subsections, so they read as one
                group distinct from the actual 40-man list further down. */}
            <div className="roster-super">
              <div className="roster-super__row">
                {/* Left column: the defensive nine, with the bench (Top
                    Substitutes) stacked directly beneath it. */}
                <div className="roster-super__col">
                  {preferredLineup.length > 0 && (
                    <section className="roster-sub">
                      <h4 className="roster-sub__title">Preferred Lineup</h4>
                      <DefenseDiamond defense={preferredLineupDefense} />
                    </section>
                  )}
                  {substitutes.length > 0 && (
                    <section className="roster-sub">
                      <h4 className="roster-sub__title">Top Substitutes</h4>
                      <RosterList
                        season={season}
                        showProspect={isMilb}
                        rows={substitutes.map((p) => ({
                          ...p,
                          hurt: injuredIds.has(p.id),
                        }))}
                      />
                    </section>
                  )}
                </div>
                {/* Right column: the two pitching staffs, Starting Pitchers
                    over Bullpen. */}
                <div className="roster-super__col">
                  {startingPitchers.length > 0 && (
                    <section className="roster-sub">
                      <h4 className="roster-sub__title">Starting Pitchers</h4>
                      <RosterList
                        season={season}
                        showProspect={isMilb}
                        rows={startingPitchers.map((p) => ({
                          ...p,
                          hurt: injuredIds.has(p.id),
                        }))}
                      />
                    </section>
                  )}
                  {bullpen.length > 0 && (
                    <section className="roster-sub">
                      <h4 className="roster-sub__title">Bullpen</h4>
                      <RosterList
                        season={season}
                        showProspect={isMilb}
                        rows={bullpen.map((p) => ({
                          ...p,
                          hurt: injuredIds.has(p.id),
                        }))}
                      />
                    </section>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {(position.length > 0 || pitchers.length > 0) && (
          <>
            <SectionTitle title="Current Roster" />
            <div className="roster-cols">
              {position.length > 0 && (
                <div>
                  <h4 className="roster-sub__title">Position players{sportId === 1 ? ' · season WAR' : ''}</h4>
                  <RosterList
                    season={season}
                    showProspect={isMilb}
                    rows={position.map((p) => ({ ...p, badge: p.pos, badgeClass: 'thub-pos' }))}
                  />
                </div>
              )}
              {pitchers.length > 0 && (
                <div>
                  <h4 className="roster-sub__title">Pitchers · role inferred{sportId === 1 ? ' · season WAR' : ''}</h4>
                  <RosterList
                    season={season}
                    showProspect={isMilb}
                    rows={pitchers.map((p) => ({
                      ...p,
                      badge: p.role ?? DASH,
                      badgeClass: `rolechip${p.role === 'RP' ? ' rolechip--rp' : p.role === 'CL' ? ' rolechip--cl' : ''}`,
                    }))}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {injured.length > 0 && (
          <>
            <SectionTitle title="Injured List" />
            {showInjured ? (
              <RosterList
                season={season}
                showProspect={false}
                rows={injured.map((p) => ({ ...p, badge: p.ilLabel, badgeClass: 'ilchip', war: undefined }))}
              />
            ) : (
              <button type="button" className="pshistory__more" onClick={() => setExpandedInjuredTeamId(teamId)}>
                Show {injured.length} injured
              </button>
            )}
          </>
        )}

        {isMilb && affiliationHistory.length > 0 && (
          <CareerTimeline entries={affiliationHistory} title="Affiliation history" />
        )}

        {affiliateCards.length > 0 && (
          <>
            <SectionTitle title="Affiliates" />
            <div className="thub-affiliates">
              {affiliateCards.map((a) => (
                <TeamLink key={a.id} id={a.id} className="thub-affiliate">
                  <span className="thub-affiliate__level">{SPORT_LABEL[a.sportId] ?? DASH}</span>
                  <TeamLogo teamId={a.id} name={a.name} size={48} />
                  <span className="thub-affiliate__name">{a.name}</span>
                  {a.city && (
                    <span className="thub-affiliate__loc">
                      {a.city}{a.state ? `, ${a.state}` : ''}
                    </span>
                  )}
                </TeamLink>
              ))}
            </div>
          </>
        )}

        {!isMilb && prospects.length > 0 && (
          <>
            <SectionTitle title="Prospects" note="org rank" />
            <div className="prospectshowcase">
              {prospects.slice(0, PROSPECT_SHOWCASE_COUNT).map((p) => (
                <PlayerLink key={p.playerId} id={p.playerId} className="prospectshowcase__card">
                  <span className="prospectshowcase__shotwrap">
                    <Headshot personId={p.playerId} name={p.name} teamId={p.affiliateTeamId} className="prospectshowcase__shot" />
                    {p.position && <span className="prospectshowcase__posbadge">{p.position}</span>}
                  </span>
                  <span className="prospectshowcase__name">{p.name}</span>
                </PlayerLink>
              ))}
            </div>
            <div className="ledger-wrap">
              <table className="ledger prospecttable">
                <thead>
                  <tr>
                    <th className="lft">Rk</th>
                    <th className="lft">Player</th>
                    <th>Pos</th>
                    <th>Level</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllProspects ? prospects : prospects.slice(0, PROSPECTS_PREVIEW_COUNT)).map((p) => {
                    const isTop = p.topRank != null
                    return (
                      <tr key={p.playerId}>
                        <td className="lft yr">{p.orgRank}</td>
                        <td className="lft ledger__sub">
                          <PlayerLink id={p.playerId} className="prospecttable__name">{p.name}</PlayerLink>
                          {isTop && <span className="prospecttable__top">#{p.topRank}</span>}
                        </td>
                        <td>{p.position || DASH}</td>
                        <td className="prospecttable__level">
                          <span>{p.levelLabel || DASH}</span>
                          {p.affiliateTeamId && (
                            <TeamLogo teamId={p.affiliateTeamId} name={p.levelLabel} size={16} crop />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!showAllProspects && prospects.length > PROSPECTS_PREVIEW_COUNT && (
                <button type="button" className="pshistory__more" onClick={() => setExpandedProspectsTeamId(teamId)}>
                  Show all {prospects.length} prospects
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </LinkScope>
  )
}

// Season progress strip for the team page — one block per series (a run of
// consecutive games against the same opponent), one small cell per game
// within it, in chronological order left-to-right/top-to-bottom (wraps on
// narrow screens rather than paging by month). `games` is spoiler-free
// (dates, opponents, home/away — see fetchTeamSchedule) plus a `won` flag
// that's already cutoff-gated by the caller (null for anything not yet safe
// to show), so every game renders regardless of whether it's already been
// played, and a played game's cell tints green/won or red/loss only once
// `won` isn't null; the destination page (lineup1) still manages its own
// sealing independently for anyone who taps through. `refDate` marks the
// series the page was opened from (or today's) so it can be highlighted.
function SeriesStrip({ games, allStarGame, refDate }) {
  const navigate = useNav()

  const series = useMemo(() => {
    const out = []
    for (const g of games) {
      const last = out[out.length - 1]
      if (last && last.opponent.id === g.opponent.id) {
        last.games.push(g)
      } else {
        out.push({ opponent: g.opponent, games: [g] })
      }
    }
    return out
  }, [games])

  // Splice the All-Star Game in chronologically — right before the first
  // series that resumes after the break (a team's own schedule has no games
  // during the break itself, so there's no series to attach it to).
  const items = useMemo(() => {
    const list = series.map((s) => ({ type: 'series', key: `${s.opponent.id}-${s.games[0].apiDate}`, ...s }))
    if (allStarGame) {
      const card = { type: 'allstar', key: `allstar-${allStarGame.apiDate}`, ...allStarGame }
      const idx = list.findIndex((it) => it.games[0].apiDate > allStarGame.apiDate)
      if (idx === -1) list.push(card)
      else list.splice(idx, 0, card)
    }
    return list
  }, [series, allStarGame])

  const openGame = (g) => {
    navigate(gamePath(g.apiDate, g.away.abbreviation, g.home.abbreviation, 'lineup1', g.gameNumber))
  }

  return (
    <div className="sstrip">
      {items.map((it) => {
        if (it.type === 'allstar') {
          return (
            <button
              key={it.key}
              type="button"
              className="sstrip__series sstrip__series--allstar"
              onClick={() => openGame(it)}
              title={`${it.apiDate} · All-Star Game · ${it.away.name} vs ${it.home.name}`}
            >
              <div className="sstrip__opp">
                <TeamLogo teamId={it.away.id} name={it.away.name} size={18} />
                <TeamLogo teamId={it.home.id} name={it.home.name} size={18} />
              </div>
              <span className="sstrip__opplabel">All-Star Break</span>
            </button>
          )
        }
        const isCurrent = it.games.some((g) => g.apiDate === refDate)
        return (
          <div key={it.key} className={`sstrip__series${isCurrent ? ' sstrip__series--current' : ''}`}>
            <div className="sstrip__opp" title={it.opponent.name}>
              <TeamLogo teamId={it.opponent.id} name={it.opponent.name} size={18} />
              <span className="sstrip__opplabel">{it.opponent.abbreviation}</span>
            </div>
            <div className="sstrip__cells">
              {it.games.map((g) => {
                const resultClass =
                  g.won === true ? ' sstrip__cell--win' : g.won === false ? ' sstrip__cell--loss' : ''
                const resultLabel = g.won === true ? ' · W' : g.won === false ? ' · L' : ''
                return (
                  <button
                    key={g.gamePk}
                    type="button"
                    className={`sstrip__cell${g.isHome ? ' sstrip__cell--home' : ''}${resultClass}`}
                    onClick={() => openGame(g)}
                    title={`${g.apiDate} · ${g.isHome ? 'vs' : 'at'} ${g.opponent.name}${g.doubleHeader !== 'N' ? ` · Gm ${g.gameNumber}` : ''}${resultLabel}`}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TeamStats({ title, stats }) {
  return (
    <>
      <SectionTitle title={title} note="rank out of 30" />
      <div className="tstats-card">
        <div className="tstats">
          {stats.map((s) => (
            <div key={s.k} className={`tstatrow${s.extreme ? ` tstatrow--${s.extreme}` : ''}`}>
              <span className="tstatrow__k">{s.k}</span>
              <span className="tstatrow__v">{s.v}</span>
              <span className={`tstatrow__r${s.tone ? ` tstatrow__r--${s.tone}` : ''}`}>{s.rank}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function RosterList({ rows, season, showProspect }) {
  return (
    <ul className="thub-roster">
      {rows.map((r) => (
        <li key={`${r.id}-${r.jersey}`} className="thub-row">
          <span className="thub-jersey">{r.jersey}</span>
          <span className="thub-namewrap">
            <PlayerLink id={r.id} className="thub-name">
              {r.name}
              {r.allStar && (
                <span className="thub-allstar" title={`${season} All Star`}>★</span>
              )}
            </PlayerLink>
            <InjuredMark hurt={r.hurt} />
            {showProspect && <ProspectPill {...r.prospect} />}
            <RookiePill active={r.rookie} />
          </span>
          {r.war !== undefined && (
            <span
              className={`rankchip${r.war == null ? '' : r.war >= 3 ? ' rankchip--good' : r.war < 0 ? ' rankchip--bad' : ''}`}
              title="Season WAR (FanGraphs)"
            >
              {r.war == null ? DASH : r.war.toFixed(1)}
            </span>
          )}
          {r.badge && <span className={r.badgeClass}>{r.badge}</span>}
          <span className="thub-chev">›</span>
        </li>
      ))}
    </ul>
  )
}
