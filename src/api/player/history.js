// The player page's history readers: awards, innings by position, the Firsts card
// and the transaction timeline, each called by the module that draws it.

import {
  fetchFielding,
  fetchMilbFielding,
  fetchPersonStats,
  fetchStarterRelieverStints,
  fetchTradeCohort,
  findFirstPitcherFaced,
  findFirstStart,
  findFirstStrikeoutBatter,
  MILESTONE_EVENTS,
} from '../person-fetch.js'
import { resolveCareerOrgs } from '../careerTimeline.js'
import { fetchTeam } from '../team.js'
import {
  awardsView,
  fieldingView,
  firstMilestoneSeasons,
  firstsFromGameLog,
  FIRSTS_DEFS,
  PITCHER_FIRSTS_DEFS,
  starterRelieverCareer,
  tradeKey,
  transactionTimelineView,
} from '../person.js'
import { teamFullName } from '../../lib/teams.js'
import { boxscoreLinks, playerContext } from './context.js'

// The opponent of one first (f: the first, g: its boxscore link, or undefined). He
// is the away club when he was at home. `oppId` is the logo's key; the rest label it.
export function firstOpponent(f, g) {
  if (!g) return { oppId: null, oppAbbr: '', oppName: null }
  const oppId = f.isHome ? g.awayId : g.homeId
  return { oppId, oppAbbr: f.isHome ? g.awayAbbr : g.homeAbbr, oppName: teamFullName(oppId) }
}

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

// The Awards ledger, with the MLB column's affiliate rows resolved. Shared with the new
// player page's tbd module (screens/player/next/modules/tbd).
export async function awardLedgerFor(awards, endDate) {
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
  return awardLedger
}

// The curated transaction rows. `txns` is the player's raw feed; the rest is the enrichment the
// ledger names (levels, trade cohorts, draft, rookie limit). Shared with the tbd module.
export async function transactionRowsFor(bio, txns, rookieInfo, endDate) {
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
    // A one-sided ASG/SC row (invite, All-Star, national team) needs its club's level too.
    if ((t.typeCode === 'ASG' || t.typeCode === 'SC') && !t.fromTeam?.id && t.toTeam?.id && !/All-Stars?\b/i.test(t.description || '')) {
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
  return transactionTimelineView(txns, {
    selfId: bio.id,
    levelByTeamId,
    tradeOthers,
    draft: bio.draft,
    rookieUntil: rookieInfo?.rookieUntil ?? null,
    endDate,
  })
}

// The dated firsts of one role (`group`), pinned to their games. `ybySplits` is his MLB year-by-year and
// `debutSplits` his debut-season game log, both for that group. The live History tab calls it for his
// primary role, and `loadFirsts` calls it for each role of the new page's Firsts module.
// `people: false` skips the play-by-play lookups that name the pitcher or batter he faced.
export async function firstsFor(ctx, group, ybySplits, debutSplits, { people = true } = {}) {
  const { bio, cutoff, currentYear, debutYear } = ctx
  // A debut on or after the cutoff has no game before it, so there is nothing to show.
  if (!bio.debut || (cutoff && bio.debut >= cutoff)) return null
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
    const pitching = group === 'pitching'
    const defs = pitching ? PITCHER_FIRSTS_DEFS : FIRSTS_DEFS
    const throughYear = cutoff ? Number(cutoff.slice(0, 4)) : currentYear
    const seasonSet = new Set(firstMilestoneSeasons(ybySplits, defs, throughYear))
    if (debutYear && (!throughYear || debutYear <= throughYear)) seasonSet.add(debutYear)
    const seasons = [...seasonSet].sort((a, b) => a - b)
    const logs = await Promise.all(
      seasons.map((yr) =>
        yr === debutYear
          ? Promise.resolve(debutSplits)
          : fetchPersonStats(bio.id, { type: 'gameLog', group, season: yr, sportId: 1 }),
      ),
    )
    const careerSplits = logs.flat()
    if (pitching) {
      const { events } = firstsFromGameLog(careerSplits, cutoff, PITCHER_FIRSTS_DEFS)
      if (events.so && people) {
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
          if (!f?.gamePk || !people) return
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
  // His debut is a first of his primary role only: the other role's log may not hold that game.
  if (firsts && (group === 'pitching') === Boolean(bio.isPitcher)) {
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
        ...firstOpponent(f, g),
      }
    }
  }
  return firsts
}

// Only what the firsts need: his MLB year-by-year and debut-season game log for `group`, then `firstsFor`.
export async function loadFirsts(id, asOf, group) {
  const ctx = await playerContext(id, asOf)
  if (!ctx?.bio.debut || (ctx.cutoff && ctx.bio.debut >= ctx.cutoff)) return null
  const [ybySplits, debutSplits] = await Promise.all([
    fetchPersonStats(id, { type: 'yearByYear', group, sportId: 1 }),
    ctx.debutYear ? fetchPersonStats(id, { type: 'gameLog', group, season: ctx.debutYear, sportId: 1 }) : [],
  ])
  return { bio: ctx.bio, firsts: await firstsFor(ctx, group, ybySplits, debutSplits, { people: false }) }
}
