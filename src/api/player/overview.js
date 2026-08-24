// The Overview tab's own loader — the bare `/player/{id}`.
//
// What it feeds: the fact grid, the Contract card, each stat block's current-
// season tiles + league-rank chips + promoted other-level rows, Milestone Watch,
// the conversion note, (for a player who has NOT debuted) the career timeline
// and Path to the Majors that lead his page, and four preview doors into the
// other tabs — a trimmed (last-3) game log, a Statcast/prospect teaser, an
// awards-chip strip, and the Photos/Highlights rails' own one-row cap.
//
// Every preview here is OVERVIEW'S OWN DATA, fetched at preview size — never
// `loadPlayerStats`/`loadPlayerAnalytics`/`loadPlayerHistory` imported
// wholesale, which would pay for a full tab's fetch just to show three rows
// of it. Splits, the career register, the full arsenal/advanced bundle,
// transactions and position innings stay off this tab entirely; see
// src/api/player/context.js for the three rules.

import { fetchPersonStats, fetchMilbYearByYear, fetchPlayerAwards } from '../person-fetch.js'
import { buildCareerTimeline } from '../careerTimeline.js'
import { fetchWarData, fetchWarHistory, warByYearFor } from '../war.js'
import { fetchPlayerContract } from '../person/contracts.js'
import { fetchSavantPercentiles, savantPercentilesFor, savantRawFor } from '../savantPercentiles.js'
import { fetchProspectTrend, prospectTrendById, prospectCardView } from '../prospectTrend.js'
import {
  awardsView,
  buildBlock,
  dropRehabStints,
  gameLogView,
  hittingRanksView,
  levelProgressionView,
  pitcherRole,
  pitchingRanksView,
  positionPlayerPastNote,
} from '../person.js'
import { boxscoreLinks, currentSeasonFor, playerContext, yearByYearFor } from './context.js'

// The game-log preview's row count — see docs/player-hub.md.
const PREVIEW_GAME_LOG_LIMIT = 3

export async function loadPlayerOverview(id, asOf) {
  const ctx = await playerContext(id, asOf)
  if (!ctx) return null
  const {
    bio, txns, groups, primaryGroup, season, cutoff, endDate, debutYear, currentActivitySportId, liveSportId,
  } = ctx

  // WAR (FanGraphs, MLB-only), Statcast percentiles and the prospect-trend
  // snapshot all ride here — same-origin static files, session-cached, so
  // each is free after the first player page anywhere in the app. Statcast is
  // fetched only for a player CURRENTLY active at the majors (the source has
  // no MiLB rows); the prospect trend only below it — the two teasers are
  // mutually exclusive, same gate PlayerAnalyticsTab's full cards use.
  const [warCurrent, warHistory, contract, savantData, prospectTrend, awards] = await Promise.all([
    fetchWarData(),
    fetchWarHistory(id),
    // A contract ledger is a season's book, not a day's, and Cot's carries no
    // history to date it against — so a spoiler-cutoff view skips the fetch and
    // the card simply doesn't render.
    asOf ? Promise.resolve(null) : fetchPlayerContract(id),
    currentActivitySportId === 1 ? fetchSavantPercentiles() : Promise.resolve(null),
    currentActivitySportId !== 1 ? fetchProspectTrend() : Promise.resolve(null),
    // The awards chip strip reads every category the feed carries, same as
    // the History tab's full ledger — ranking happens in the component
    // (AwardsLedger's `preview` branch), against the site owner's own
    // /admin order, so a reorder there moves the same award first in both
    // places.
    fetchPlayerAwards(id),
  ])

  const [results, debutSplits, convHittingMilb] = await Promise.all([
    Promise.all(
      groups.map(async (group) => {
        const [current, yby, rankSplits, gameLogSplits] = await Promise.all([
          currentSeasonFor(ctx, group),
          // The promoted other-level rows and Milestone Watch's cutoff-safe
          // career total both read these; nothing else on this tab does.
          yearByYearFor(ctx, group),
          // League ranks — live current ranks with no as-of history, so a
          // spoiler-cutoff view skips them (same rule as FoulCard).
          currentActivitySportId === 1 && !cutoff
            ? fetchPersonStats(id, { type: 'rankings', group, season, sportId: 1 })
            : Promise.resolve([]),
          // The game-log preview's own trimmed fetch — same level as the
          // tiles, same cutoff rule the full Stats-tab log applies
          // (gameLogView), just asked for at this tab's own preview size
          // rather than the Stats tab's "last 6/8".
          fetchPersonStats(id, { type: 'gameLog', group, season, sportId: currentActivitySportId }),
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
        // strip and the two previews ride the block rather than widening a
        // pure shaper's signature.
        block.ranks = group === 'pitching' ? pitchingRanksView(rankSplits) : hittingRanksView(rankSplits)
        block.gameLogPreview = gameLogView(gameLogSplits, group, cutoff, PREVIEW_GAME_LOG_LIMIT)
        // The door's own count — the season's real game total, never the 3
        // rows the preview shows (see overviewPreview.js's gameLogDoorLabel).
        block.seasonGames = Number(tileStat?.gamesPlayed) || 0
        if (tileSportId === 1) {
          block.savant = savantPercentilesFor(savantData, id, group)
          block.savantRaw = savantRawFor(savantData, id, group)
        }
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

  // The Prospect Card teaser — MiLB only, mirroring PlayerAnalyticsTab's own
  // full-card gate one-for-one (`trendEntry.group` says which block it
  // belongs under; a player with no trend row yet still gets a card in his
  // PRIMARY group, so an untracked prospect isn't blank in a different way
  // than the Analytics tab is).
  const trendEntry = prospectTrend ? prospectTrendById(prospectTrend, bio.id) : null
  const prospectCard =
    currentActivitySportId !== 1
      ? prospectCardView(
          trendEntry,
          typeof bio.age === 'number' ? bio.age : null,
          prospectTrend?.levelAverageAge?.[currentActivitySportId] ?? null,
        )
      : null
  const prospectCardGroup = trendEntry?.group ?? primaryGroup

  // Every gamePk the preview logs point at, plus the debut game — one shared
  // boxscoreLinks lookup rather than two.
  const previewPks = new Set()
  for (const r of results) {
    for (const row of r.block.gameLogPreview?.rows ?? []) if (row.gamePk) previewPks.add(row.gamePk)
  }
  const debutGamePk = (debutSplits ?? []).find((s) => s.date === bio.debut)?.game?.gamePk ?? null
  if (debutGamePk) previewPks.add(debutGamePk)
  const links = await boxscoreLinks(previewPks)
  for (const r of results) {
    for (const row of r.block.gameLogPreview?.rows ?? []) row.boxscorePath = links.path(row.gamePk)
  }

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
    prospectCard,
    prospectCardGroup,
    awardLedger: awardsView(awards, endDate),
  }
}
