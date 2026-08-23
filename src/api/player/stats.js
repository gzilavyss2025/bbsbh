// The Stats tab's own loader — `/player/{id}/stats`.
//
// What it feeds: the game log (with its level toggle), the splits section
// (handedness, situational, career-vs-club) and the career register, plus the
// two current-day-only cards that sit beside them (Recent form and the pitcher
// workload ledger fetch their own, from their own components).
//
// Fetch nothing another tab owns: no Statcast/advanced/arsenal bundle, no
// prospect trend, no awards, no transactions, no position innings. See
// src/api/player/context.js for the three rules.

import {
  fetchAllStarRosterIds,
  fetchMilbGameLog,
  fetchPersonStats,
  fetchTeamAbbrevs,
} from '../person-fetch.js'
import { resolveCareerOrgs } from '../careerTimeline.js'
import { fetchWarData, fetchWarHistory, warByYearFor } from '../war.js'
import { fetchVsTeamSplitsForPlayer, vsTeamSplitsFor } from '../vsTeamSplits.js'
import {
  buildBlock,
  otherLevelSeasonBlocks,
  pitcherRole,
  SITUATIONAL_SIT_CODES,
  situationalSplitsView,
} from '../person.js'
import { boxscoreLinks, currentSeasonFor, playerContext, yearByYearFor } from './context.js'

export async function loadPlayerStats(id, asOf) {
  const ctx = await playerContext(id, asOf)
  if (!ctx) return null
  const { bio, txns, groups, season, cutoff, debutYear, onRehab, currentActivitySportId, careerSportId } = ctx

  // WAR feeds the register's own column here (the Overview's tiles read the
  // same two static files, session-cached, so the second tab pays nothing).
  // Career-vs-club splits (the SPLITS VS TEAM card) ride the same tier: a
  // same-origin nightly shard for this one player, not the whole league.
  const [warCurrent, warHistory, vsTeamData] = await Promise.all([
    fetchWarData(),
    fetchWarHistory(id),
    fetchVsTeamSplitsForPlayer(id),
  ])

  const results = await Promise.all(
    groups.map(async (group) => {
      // A rehabbing big leaguer's game log combines his MLB games with his
      // rehab (MiLB) games into one date-sorted log, each row level-tagged;
      // everyone else's is a single-level log at his current-activity level.
      const gameLogPromise = onRehab
        ? Promise.all([
            fetchPersonStats(id, { type: 'gameLog', group, season, sportId: 1 }),
            fetchMilbGameLog(id, group, season),
          ]).then(([mlb, milb]) => [
            ...mlb.map((s) => ({ ...s, sport: s.sport ?? { id: 1 } })),
            ...milb,
          ])
        : fetchPersonStats(id, { type: 'gameLog', group, season, sportId: currentActivitySportId })

      const [current, yby, careerSplits, lrSplits, gameLogSplits, situationalSplits] = await Promise.all([
        currentSeasonFor(ctx, group),
        yearByYearFor(ctx, group),
        // The career total is pinned to `careerSportId` (MLB for anyone who has
        // debuted), so a now-in-the-minors big leaguer's major-league résumé
        // foots the register's MLB total.
        fetchPersonStats(id, { type: 'career', group, sportId: careerSportId }),
        fetchPersonStats(id, { type: 'statSplits', group, sitCodes: 'vl,vr', season, sportId: currentActivitySportId }),
        gameLogPromise,
        // Situational splits (base state / count leverage) — full-season figures
        // like the vs-L/R card, MLB only. The sitCodes set and the shaping are
        // group-generic (ahead/behind in count reads from whichever side `group`
        // asks for).
        currentActivitySportId === 1
          ? fetchPersonStats(id, { type: 'statSplits', group, sitCodes: SITUATIONAL_SIT_CODES, season, sportId: 1 })
          : Promise.resolve([]),
      ])
      const { seasonSplits, stat: tileStat, sportId: tileSportId, levelOnlyStat, levelOnlySplits } = current

      // The Game log's level-toggle fetch — the highest OTHER level (if any) the
      // player had real season action at, same gate the Overview's promoted tile
      // row uses (see activity.js), so the toggle only ever appears beside a
      // level the tiles already promised. Skipped under onRehab: that game log
      // already combines both levels, tagged per row, so a second toggle would
      // compete with it instead of adding anything.
      const altLevel = onRehab
        ? null
        : otherLevelSeasonBlocks({
            mlbSplits: yby.mlbYbySplits, milbSplits: yby.milbYbySplits, group,
            currentSeason: season, currentSportId: tileSportId,
          })?.[0]
      const altGameLogSplits = altLevel
        ? await fetchPersonStats(id, { type: 'gameLog', group, season, sportId: altLevel.sportId })
        : []
      // The register merges independently-fetched MLB and MiLB rows. Resolve
      // each farm club to its parent for that season before shaping so it can
      // recognize a true multi-organization year (for affiliate marks) and make
      // the same org-aware ordering fallback as Team history when the
      // transaction wire is sparse.
      const orgOf = await resolveCareerOrgs([...yby.mlbYbySplits, ...yby.milbYbySplits])

      const block = buildBlock({
        group,
        role: group === 'pitching' ? pitcherRole(tileStat) : null,
        seasonSplits,
        careerSplits,
        lrSplits,
        gameLogSplits,
        altGameLogSplits,
        arsenalSplits: [],
        mlbYbySplits: yby.mlbYbySplits,
        milbYbySplits: yby.milbYbySplits,
        cutoff,
        currentSeason: season,
        currentSportId: tileSportId,
        debutYear,
        tileStat,
        levelOnlyStat,
        levelOnlySplits,
        logTagLevel: onRehab,
        warByYear: warByYearFor(id, group, warCurrent, warHistory),
        transactions: txns,
        orgOf,
      })
      block.situational = situationalSplitsView(situationalSplits, group)
      return { group, block }
    }),
  )
  const blocks = results.map((r) => r.block)

  // All-Star roster membership (MLB only), one roster lookup per distinct year
  // that appears in the register. The star marks the SEASON, and a split season
  // is two rows, so it goes on that season's lead row only (see
  // careerRegisterView). The hero's own current-year badge is the shell's, since
  // that is where the banner draws.
  const registerYears = new Set()
  for (const b of blocks) {
    for (const r of b.register?.rows ?? []) if (r.tier === 'mlb') registerYears.add(Number(r.year))
  }
  const allStarByYear = new Map(
    careerSportId === 1
      ? await Promise.all([...registerYears].map(async (yr) => [yr, await fetchAllStarRosterIds(yr)]))
      : [],
  )
  for (const b of blocks) {
    for (const r of b.register?.rows ?? []) {
      if (r.tier === 'mlb') r.allStar = r.seasonLead && (allStarByYear.get(Number(r.year))?.has(bio.id) ?? false)
    }
  }

  // Team(s) played for each register row — a trade mid-season means more than
  // one. One batched lookup for every team id across every row of every ledger;
  // those stat splits carry only a team id/name, never an abbreviation.
  const teamIdSet = new Set()
  for (const b of blocks) for (const r of b.register?.rows ?? []) for (const tid of r.teamIds) teamIdSet.add(tid)
  const teamAbbrevs = await fetchTeamAbbrevs([...teamIdSet])
  const abbrevs = (ids) => ids.map((tid) => teamAbbrevs[tid]).filter(Boolean).join('/')
  for (const b of blocks) {
    for (const r of b.register?.rows ?? []) r.team = r.teamLabel || abbrevs(r.teamIds)
  }

  // Point every game-log row at that game's (sealed) box score, via the normal
  // date/matchup/boxscore route.
  const pks = new Set()
  for (const b of blocks) for (const r of b.gameLog?.rows ?? []) if (r.gamePk) pks.add(r.gamePk)
  const links = await boxscoreLinks(pks)
  for (const b of blocks) for (const r of b.gameLog?.rows ?? []) r.boxscorePath = links.path(r.gamePk)

  return {
    bio,
    blocks,
    season,
    asOf,
    sportId: currentActivitySportId,
    onRehab,
    vsTeam: vsTeamSplitsFor(vsTeamData, bio.id),
  }
}
