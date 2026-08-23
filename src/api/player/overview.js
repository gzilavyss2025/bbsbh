// The Overview tab's own loader — the bare `/player/{id}`.
//
// What it feeds: the fact grid, the Contract card, each stat block's current-
// season tiles + league-rank chips + promoted other-level rows, Milestone Watch,
// the conversion note, and (for a player who has NOT debuted) the career
// timeline and Path to the Majors that lead his page.
//
// Fetch nothing another tab owns: no game log, no splits, no career register, no
// Statcast/advanced/arsenal bundle, no awards, no transactions, no position
// innings. See src/api/player/context.js for the three rules.

import { fetchPersonStats, fetchMilbYearByYear } from '../person-fetch.js'
import { buildCareerTimeline } from '../careerTimeline.js'
import { fetchWarData, fetchWarHistory, warByYearFor } from '../war.js'
import { fetchPlayerContract } from '../person/contracts.js'
import {
  buildBlock,
  dropRehabStints,
  hittingRanksView,
  levelProgressionView,
  pitcherRole,
  pitchingRanksView,
  positionPlayerPastNote,
} from '../person.js'
import { boxscoreLinks, currentSeasonFor, playerContext, yearByYearFor } from './context.js'

export async function loadPlayerOverview(id, asOf) {
  const ctx = await playerContext(id, asOf)
  if (!ctx) return null
  const { bio, txns, groups, primaryGroup, season, cutoff, debutYear, currentActivitySportId, liveSportId } = ctx

  // WAR (FanGraphs, MLB-only) rides along here — two same-origin static files
  // (nightly current season + hand-run history), session-cached, so this is
  // free after the first player page. Built into a per-group { season: war } map
  // below and threaded into each block's tiles.
  const [warCurrent, warHistory, contract] = await Promise.all([
    fetchWarData(),
    fetchWarHistory(id),
    // A contract ledger is a season's book, not a day's, and Cot's carries no
    // history to date it against — so a spoiler-cutoff view skips the fetch and
    // the card simply doesn't render.
    asOf ? Promise.resolve(null) : fetchPlayerContract(id),
  ])

  const [results, debutSplits, convHittingMilb] = await Promise.all([
    Promise.all(
      groups.map(async (group) => {
        const [current, yby, rankSplits] = await Promise.all([
          currentSeasonFor(ctx, group),
          // The promoted other-level rows and Milestone Watch's cutoff-safe
          // career total both read these; nothing else on this tab does.
          yearByYearFor(ctx, group),
          // League ranks — live current ranks with no as-of history, so a
          // spoiler-cutoff view skips them (same rule as FoulCard).
          currentActivitySportId === 1 && !cutoff
            ? fetchPersonStats(id, { type: 'rankings', group, season, sportId: 1 })
            : Promise.resolve([]),
        ])
        const { seasonSplits, stat: tileStat, sportId: tileSportId, levelOnlyStat, levelOnlySplits } = current
        const block = buildBlock({
          group,
          role: group === 'pitching' ? pitcherRole(tileStat) : null,
          seasonSplits,
          careerSplits: [],
          lrSplits: [],
          gameLogSplits: [],
          altGameLogSplits: [],
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
          warByYear: warByYearFor(id, group, warCurrent, warHistory),
          transactions: txns,
        })
        // Same attach-after-buildBlock pattern the old loader used: the rank
        // strip rides the block rather than widening a pure shaper's signature.
        block.ranks = group === 'pitching' ? pitchingRanksView(rankSplits) : hittingRanksView(rankSplits)
        return { group, block, ...yby }
      }),
    ),
    // The MLB debut is always sportId 1; its box-score game is the row of that
    // season's game log whose date is the debut date. Only the fact grid's
    // "MLB Debut" link needs it here — the Firsts card fetches its own, on the
    // tab that renders it.
    bio.debut && debutYear
      ? fetchPersonStats(id, {
          type: 'gameLog', group: bio.isPitcher ? 'pitching' : 'hitting',
          season: debutYear, sportId: 1,
        })
      : Promise.resolve([]),
    // Conversion check: a debuted pitcher's minor-league HITTING history reveals
    // a position-player past his pitching-only register can't show (Kenley
    // Jansen caught four years before he ever pitched). Only single-group
    // pitchers need it — a two-way player already fetches both groups' MiLB.
    bio.debut && bio.isPitcher && !bio.twoWay
      ? fetchMilbYearByYear(id, 'hitting')
      : Promise.resolve(null),
  ])

  const blocks = results.map((r) => r.block)
  const debutGamePk = (debutSplits ?? []).find((s) => s.date === bio.debut)?.game?.gamePk ?? null
  const links = await boxscoreLinks(debutGamePk ? [debutGamePk] : [])

  // A player who has NOT debuted leads with his path rather than with a
  // major-league fact grid, so those two cards are the Overview's — the same
  // pair moves to the History tab the day he debuts (see history.js).
  const primaryResult = results.find((r) => r.group === primaryGroup) ?? results[0]
  let progression = null
  let timeline = null
  if (!bio.debut && primaryResult) {
    progression = levelProgressionView(
      dropRehabStints(primaryResult.milbYbySplits, debutYear),
      primaryResult.group,
      liveSportId,
    )
    timeline = await buildCareerTimeline(
      [...primaryResult.mlbYbySplits, ...primaryResult.milbYbySplits],
      primaryGroup,
      debutYear,
    )
  }

  return {
    bio,
    blocks,
    season,
    asOf,
    sportId: currentActivitySportId,
    currentYear: ctx.currentYear,
    contract,
    conversionNote: convHittingMilb ? positionPlayerPastNote(convHittingMilb, debutYear) : null,
    debutBoxscorePath: debutGamePk ? links.path(debutGamePk) : null,
    progression,
    timeline,
  }
}
