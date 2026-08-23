// The History tab's own loader — `/player/{id}/history`.
//
// What it feeds: the Awards ledger, Innings by position, the Firsts card, Path
// to the Majors + Team history (for a player who HAS debuted — a pre-debut
// player's pair leads his Overview instead), and the transaction timeline.
//
// Fetch nothing another tab owns: no tiles, no game log, no register, no
// Statcast/advanced/arsenal bundle, no contract. See src/api/player/context.js
// for the three rules.

import {
  fetchFielding,
  fetchMilbFielding,
  fetchMilbFieldingSeason,
  fetchMilbStarterRelieverSeason,
  fetchPersonStats,
  fetchPlayerAwards,
  fetchStarterReliever,
  fetchStarterRelieverStints,
  fetchTradeCohort,
  findFirstPitcherFaced,
  findFirstStart,
  findFirstStrikeoutBatter,
  MILESTONE_EVENTS,
} from '../person-fetch.js'
import { buildCareerTimeline, resolveCareerOrgs } from '../careerTimeline.js'
import { fetchTeam } from '../team.js'
import { fetchRookieRecord } from '../rookies.js'
import {
  awardsView,
  dropRehabStints,
  fieldingView,
  firstMilestoneSeasons,
  firstsFromGameLog,
  FIRSTS_DEFS,
  levelProgressionView,
  PITCHER_FIRSTS_DEFS,
  pitchingStints,
  starterRelieverCareer,
  starterRelieverView,
  tradeKey,
  transactionTimelineView,
} from '../person.js'
import { teamFullName } from '../../lib/teams.js'
import { boxscoreLinks, playerContext, yearByYearFor } from './context.js'

// Fetch the position-innings data for one CAREER scope ('mlb' | 'milb') — the
// 'season' scope is already eager in this tab's `positionInnings.initial`.
// Lazy: the card calls this only when the user toggles into a career scope.
// Fielding is one call for MLB / a per-level fan-out for MiLB; SP/RP fans out
// one call per (season, level) stint the pitcher appeared in.
export async function loadPositionScope(id, scope, { showFielding, showPitching, pitchStints }) {
  const isMilb = scope === 'milb'
  const [fieldSplits, stintSplits] = await Promise.all([
    showFielding
      ? isMilb ? fetchMilbFielding(id) : fetchFielding(id, { sportId: 1 })
      : Promise.resolve([]),
    showPitching
      ? fetchStarterRelieverStints(
          id,
          (pitchStints ?? []).filter((s) => (isMilb ? s.sportId !== 1 : s.sportId === 1)),
        )
      : Promise.resolve([]),
  ])
  return {
    fielding: showFielding ? fieldingView(fieldSplits) : null,
    pitching: showPitching ? starterRelieverCareer(stintSplits) : null,
  }
}

export async function loadPlayerHistory(id, asOf) {
  const ctx = await playerContext(id, asOf)
  if (!ctx) return null
  const { bio, txns, groups, primaryGroup, season, endDate, cutoff, currentYear, debutYear, liveSportId, currentActivitySportId } = ctx

  const [awards, rookieInfo, yby, debutSplits] = await Promise.all([
    // The ledger ranks EVERY award the feed carries, and a prospect's case —
    // league MVP, Futures Game, the Baseball America teams — is the whole
    // section for him, which is why this is not conditional on bio.debut.
    fetchPlayerAwards(id),
    fetchRookieRecord(id),
    Promise.all(groups.map(async (group) => ({ group, ...(await yearByYearFor(ctx, group)) }))),
    // The MLB debut is always sportId 1; its game log anchors both the debut
    // "first" and findFirstStart's earliest rows.
    bio.debut && debutYear
      ? fetchPersonStats(id, {
          type: 'gameLog', group: bio.isPitcher ? 'pitching' : 'hitting',
          season: debutYear, sportId: 1,
        })
      : Promise.resolve([]),
  ])
  const primaryResult = yby.find((r) => r.group === primaryGroup) ?? yby[0]

  // -------------------------------------------------------------------------
  // Awards
  // -------------------------------------------------------------------------
  const awardLedger = awardsView(awards, endDate)
  // The MLB column's affiliate rows: awardsView leaves orgId null for anything
  // that isn't already an MLB club (it can't fetch — see that module's header),
  // so resolve each (affiliate, season) here the same way a career timeline
  // entry is resolved — historicalParentOrg first, live parentOrgId second —
  // rather than the affiliate's CURRENT org, which is wrong for an old award
  // won under a since-reassigned affiliate.
  const milbAwardRows = awardLedger.categories.flatMap((c) => c.rows).filter((r) => r.teamId && r.orgId == null)
  if (milbAwardRows.length) {
    const orgOf = await resolveCareerOrgs(
      milbAwardRows.map((r) => ({ team: { id: r.teamId }, season: r.year, sport: { id: 11 } })),
    )
    for (const r of milbAwardRows) r.orgId = orgOf(r.teamId, r.year)
  }

  // -------------------------------------------------------------------------
  // Transactions
  // -------------------------------------------------------------------------
  // Everything the raw player-scoped feed can't give on its own: each affiliate
  // club's level (for CALLED UP / SENT DOWN + the level tags, and for naming an
  // Injured List rehab stop by level rather than affiliate name), the other
  // players in each trade (named only as free text on the player's own row), and
  // his draft record.
  const asgTeamIds = new Set()
  const trades = []
  for (const t of txns) {
    // Every ASG row's clubs go in, rehab included — the "real affiliate move"
    // vs. "rehab assignment" distinction only matters to
    // transactionTimelineView's own labeling (which re-checks the rehab regex
    // itself), not to gathering the ids a level lookup needs.
    if (t.typeCode === 'ASG' && t.fromTeam?.id && t.toTeam?.id) {
      asgTeamIds.add(t.fromTeam.id)
      asgTeamIds.add(t.toTeam.id)
    }
    if (t.typeCode === 'TR' && t.fromTeam?.id && t.toTeam?.id) trades.push(t)
  }
  const [levelPairs, cohorts] = await Promise.all([
    // Level per affiliate id, from the static team snapshot (reliable at the
    // standard levels, unlike the live teams endpoint's default-season sportId).
    Promise.all([...asgTeamIds].map(async (tid) => [tid, (await fetchTeam(tid))?.sport?.id ?? null])),
    // One team+date lookup per trade returns every player in that swap.
    Promise.all(
      trades.map(async (t) => {
        const date = t.date || t.effectiveDate
        const rows = await fetchTradeCohort(t.fromTeam.id, date)
        const pair = new Set([t.fromTeam.id, t.toTeam.id])
        const others = rows
          .filter((r) => r.typeCode === 'TR' && pair.has(r.fromTeam?.id) && pair.has(r.toTeam?.id))
          .map((r) => r.person)
          .filter((p) => p?.id && p.id !== bio.id)
        return [tradeKey(t.effectiveDate || t.date, t.fromTeam.id, t.toTeam.id), others]
      }),
    ),
  ])
  const levelByTeamId = new Map(levelPairs.filter(([, sid]) => sid != null))
  const tradeOthers = new Map()
  for (const [key, others] of cohorts) {
    const list = tradeOthers.get(key) ?? []
    for (const p of others) if (!list.some((x) => x.id === p.id)) list.push(p)
    tradeOthers.set(key, list)
  }
  const transactions = transactionTimelineView(txns, {
    selfId: bio.id,
    levelByTeamId,
    tradeOthers,
    draft: bio.draft,
    rookieUntil: rookieInfo?.rookieUntil ?? null,
    endDate,
  })

  // -------------------------------------------------------------------------
  // Path to the Majors + Team history (post-debut only — see overview.js)
  // -------------------------------------------------------------------------
  let progression = null
  let timeline = null
  if (bio.debut && primaryResult) {
    // Strip rehab-assignment noise (see dropRehabStints) so an established big
    // leaguer's stray rehab innings don't relight a MiLB level.
    progression = levelProgressionView(
      dropRehabStints(primaryResult.milbYbySplits, debutYear),
      primaryResult.group,
      liveSportId,
    )
    // Fed the player's FULL year-by-year — every MiLB level plus MLB, NOT the
    // rehab-trimmed splits — because a genuine post-debut option-down season is
    // real team history worth showing; careerTimelineView does its own finer
    // rehab filter (the same test the register uses, so the two agree).
    timeline = await buildCareerTimeline(
      [...primaryResult.mlbYbySplits, ...primaryResult.milbYbySplits],
      primaryGroup,
      debutYear,
    )
  }

  // -------------------------------------------------------------------------
  // Innings by position
  // -------------------------------------------------------------------------
  // The fielding diamond (position players) or the starter/reliever IP pair
  // (pitchers + two-way). Season scope is eager; the MLB/MiLB career scopes
  // lazy-load on toggle (see loadPositionScope). A player with no current-season
  // data (a retired/FA vet like Rich Hill) defaults to his first career scope,
  // eagerly loaded so the card isn't empty.
  const showFielding = !bio.isPitcher && !bio.twoWay
  const showPitching = bio.isPitcher || bio.twoWay
  let positionInnings = null
  if (showFielding || showPitching) {
    const pitchResult = yby.find((r) => r.group === 'pitching')
    const pitchStints = showPitching
      ? pitchingStints([...(pitchResult?.mlbYbySplits ?? []), ...(pitchResult?.milbYbySplits ?? [])])
      : []
    const hasMilb = showFielding
      ? (primaryResult?.milbYbySplits?.length ?? 0) > 0
      : pitchStints.some((s) => s.sportId !== 1)
    const scopeArgs = { showFielding, showPitching, pitchStints }
    // Season scope: an MLB player is a single sportId-1 call (his season is his
    // major-league season — earlier MiLB rehab lives in the career scopes). A
    // player currently in the minors fans out every MiLB level, so a mid-season
    // promotion (AA -> AAA) isn't undercounted.
    const inMajors = currentActivitySportId === 1
    const [fieldSeasonSplits, srSeasonSplits] = await Promise.all([
      showFielding
        ? inMajors ? fetchFielding(id, { season, sportId: 1 }) : fetchMilbFieldingSeason(id, season)
        : Promise.resolve([]),
      showPitching
        ? inMajors ? fetchStarterReliever(id, { season, sportId: 1 }) : fetchMilbStarterRelieverSeason(id, season)
        : Promise.resolve([]),
    ])
    const seasonScope = {
      fielding: showFielding ? fieldingView(fieldSeasonSplits) : null,
      pitching: showPitching ? starterRelieverView(srSeasonSplits) : null,
    }
    const seasonHasData = Boolean(seasonScope.fielding || seasonScope.pitching)
    const options = []
    if (seasonHasData) options.push({ key: 'season', label: 'Season' })
    if (bio.debut) options.push({ key: 'mlb', label: 'MLB career' })
    if (hasMilb) options.push({ key: 'milb', label: 'MiLB career' })
    const defaultScope = seasonHasData ? 'season' : options[0]?.key ?? null
    const initial = defaultScope === 'season'
      ? seasonScope
      : defaultScope
        ? await loadPositionScope(id, defaultScope, scopeArgs)
        : null
    if (options.length && initial && (initial.fielding || initial.pitching)) {
      positionInnings = { options, defaultScope, initial, ...scopeArgs }
    }
  }

  // -------------------------------------------------------------------------
  // Firsts
  // -------------------------------------------------------------------------
  // Career milestones pinned to their exact games. A milestone can land any
  // season, not just the debut one (a late-September cameo debut —
  // Bethancourt's lone 2013 game, only a strikeout — gets his first hit/HR/run
  // seasons later), so the per-season year-by-year splits pick out the earliest
  // SEASON each milestone occurred (firstMilestoneSeasons), and only those
  // seasons' game logs are fetched to find the exact game — the debut season's
  // is reused from `debutSplits`. Hitters get five plate milestones plus the
  // first game STARTED, which needs each candidate game's own boxscore (see
  // findFirstStart) since no gameLog field distinguishes a start from a sub
  // appearance. Pitchers get the pitching counterpart — every field but the
  // strikeout victim is a direct gameLog stat.
  let firsts = null
  if (bio.debut) {
    const firstsGroup = bio.isPitcher ? 'pitching' : 'hitting'
    const defs = bio.isPitcher ? PITCHER_FIRSTS_DEFS : FIRSTS_DEFS
    const throughYear = cutoff ? Number(cutoff.slice(0, 4)) : currentYear
    const firstsYby = yby.find((r) => r.group === firstsGroup)?.mlbYbySplits ?? []
    const seasonSet = new Set(firstMilestoneSeasons(firstsYby, defs, throughYear))
    if (debutYear && (!throughYear || debutYear <= throughYear)) seasonSet.add(debutYear)
    const seasons = [...seasonSet].sort((a, b) => a - b)
    const logs = await Promise.all(
      seasons.map((yr) =>
        yr === debutYear
          ? Promise.resolve(debutSplits)
          : fetchPersonStats(id, { type: 'gameLog', group: firstsGroup, season: yr, sportId: 1 }),
      ),
    )
    const careerSplits = logs.flat()
    if (bio.isPitcher) {
      const { events } = firstsFromGameLog(careerSplits, cutoff, PITCHER_FIRSTS_DEFS)
      if (events.so) {
        events.so.batter = await findFirstStrikeoutBatter(bio.id, events.so.gamePk)
      }
      firsts = events
    } else {
      const { events, rowsAscending } = firstsFromGameLog(careerSplits, cutoff)
      const startSplit = await findFirstStart(bio.id, rowsAscending)
      events.start = startSplit
        ? {
            label: 'First Start',
            date: startSplit.date,
            gamePk: startSplit.game.gamePk,
            isHome: startSplit.isHome,
          }
        : null
      // The opposing pitcher a batter got each plate milestone off of — read
      // from that milestone game's play-by-play, so the card can name (and link
      // to) who he did it against.
      await Promise.all(
        ['hit', 'xbh', 'hr', 'so'].map(async (key) => {
          const f = events[key]
          if (!f?.gamePk) return
          f.pitcher = await findFirstPitcherFaced(bio.id, f.gamePk, MILESTONE_EVENTS[key])
        }),
      )
      firsts = events
    }
  }

  // The MLB Debut milestone — a synthetic "first" pinned to the debut game.
  // When the debut game was ALSO his first start (a position player or pitcher
  // who started his debut), fold the two into one "MLB Debut & First Start" row
  // and drop the separate First Start entry; otherwise they stand as distinct
  // milestones. isHome comes from the debut-game split so the opponent resolves
  // like every other first.
  const debutGamePk = (debutSplits ?? []).find((s) => s.date === bio.debut)?.game?.gamePk ?? null
  if (firsts && bio.debut) {
    const debutSplit = (debutSplits ?? []).find((s) => s.date === bio.debut)
    const sameAsStart = firsts.start && firsts.start.date === bio.debut
    firsts.debut = {
      label: sameAsStart ? 'MLB Debut & First Start' : 'MLB Debut',
      date: bio.debut,
      gamePk: debutGamePk,
      isHome: debutSplit?.isHome ?? null,
    }
    if (sameAsStart) firsts.start = null
  }

  if (firsts) {
    const links = await boxscoreLinks(Object.values(firsts).map((f) => f?.gamePk))
    for (const key of Object.keys(firsts)) {
      const f = firsts[key]
      if (!f) continue
      const g = links.byPk[f.gamePk]
      firsts[key] = {
        ...f,
        path: links.path(f.gamePk),
        oppAbbr: g ? (f.isHome ? g.awayAbbr : g.homeAbbr) : '',
        oppName: g ? teamFullName(f.isHome ? g.awayId : g.homeId) : null,
      }
    }
  }

  return {
    bio,
    season,
    asOf,
    sportId: currentActivitySportId,
    awardLedger,
    positionInnings,
    firsts,
    progression,
    timeline,
    transactions,
  }
}
