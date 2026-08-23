// The Analytics tab's own loader — `/player/{id}/analytics`.
//
// What it feeds: the Prospect card, the Statcast percentile strip, the Advanced
// rates, the pitch mix / batted-ball mix, and the "Pitches like" / "Hits like"
// neighbours. (The season foul-ball card fetches its own, from its own
// component.) Role-agnostic: a pitcher's page uses this same shelf.
//
// Fetch nothing another tab owns: no game log, no register, no splits, no
// awards, no transactions, no position innings. See src/api/player/context.js
// for the three rules.

import { fetchPersonStats, fetchHittingAdvanced, fetchPitchingAdvanced } from '../person-fetch.js'
import {
  fetchSavantPercentiles,
  savantPercentilesFor,
  savantRawFor,
  similarHittersFor,
} from '../savantPercentiles.js'
import {
  arsenalTtoView,
  fetchPitchArsenalFor,
  fetchPitchArsenalPool,
  heatView,
  similarPitchersFor,
} from '../pitchArsenal.js'
import { fetchProspectTrend, prospectTrendById, prospectCardView } from '../prospectTrend.js'
import {
  advancedHittingView,
  advancedPitchingView,
  battedBallView,
  buildBlock,
  pitcherRole,
} from '../person.js'
import { currentSeasonFor, playerContext } from './context.js'

export async function loadPlayerAnalytics(id, asOf) {
  const ctx = await playerContext(id, asOf)
  if (!ctx) return null
  const { bio, groups, primaryGroup, season, cutoff, debutYear, currentActivitySportId } = ctx

  // Statcast percentile ranks and the league-wide pitch mix are both same-origin
  // static files, session-cached after the first read anywhere in the app.
  const [savantData, prospectTrend] = await Promise.all([
    fetchSavantPercentiles(),
    fetchProspectTrend(),
  ])

  const blocks = await Promise.all(
    groups.map(async (group) => {
      const [current, arsenalSplits, advancedBundle] = await Promise.all([
        // Which LEVEL this shelf is reading. A pitcher ranks in arsenal space
        // against the level he is actually pitching at, and the heat band reads
        // the same way, so the tile level has to be resolved even though this
        // tab prints no tiles.
        currentSeasonFor(ctx, group),
        group === 'pitching'
          ? fetchPersonStats(id, { type: 'pitchArsenal', group, season, sportId: currentActivitySportId })
          : Promise.resolve([]),
        // The Advanced card's season/seasonAdvanced/sabermetrics bundle —
        // MLB-only at the source, so skip the request entirely for a player
        // whose current activity is a MiLB level. One fetcher per group; both
        // return the same three-stat bundle shape.
        currentActivitySportId === 1
          ? (group === 'pitching' ? fetchPitchingAdvanced(id, season) : fetchHittingAdvanced(id, season))
          : Promise.resolve(null),
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
        arsenalSplits,
        mlbYbySplits: [],
        milbYbySplits: [],
        cutoff,
        currentSeason: season,
        currentSportId: tileSportId,
        debutYear,
        tileStat,
        levelOnlyStat,
        levelOnlySplits,
      })
      // Pure passthrough lookups, not derivations — attached here rather than
      // threaded into buildBlock's (pure-shaping) signature.
      block.savant = savantPercentilesFor(savantData, id, group)
      // The raw season rates behind those percentiles, for the strip's own
      // labels (see savantRawFor).
      block.savantRaw = savantRawFor(savantData, id, group)
      // "Pitches like" / "Hits like" — one field for both groups, since a block
      // only ever renders its own card. A pitcher ranks in arsenal space against
      // the level he is actually pitching at (see similarPitchersFor); a hitter
      // ranks in Statcast skill space against the savant file's qualified-MLB
      // pool (a MiLB bat isn't in the file, so the card simply doesn't render).
      // [] under any sample floor. The arsenal POOL is fetched here, not up
      // front: it is one level's worth of arms, only a pitcher's card ranks
      // against it, and a hitter's page used to pay for the whole league's mix
      // to render nothing.
      block.similar =
        group === 'pitching'
          ? similarPitchersFor(await fetchPitchArsenalPool(tileSportId === 1), id)
          : similarHittersFor(savantData, id)
      // The Pitches card's heat band — his season count of 100+ mph pitches and
      // his hardest reading — plus the times-through-the-order split. ONE fetch
      // of his ~12 KB shard feeds both; null for a hitter, and null for any arm
      // under the century floor.
      const arsenalShard = group === 'pitching' ? await fetchPitchArsenalFor(id) : null
      block.heat = arsenalShard ? heatView(arsenalShard, id, tileSportId === 1) : null
      block.arsenalTto = arsenalShard ? arsenalTtoView(arsenalShard, id, tileSportId === 1) : null
      block.advanced =
        group === 'pitching' ? advancedPitchingView(advancedBundle) : advancedHittingView(advancedBundle)
      // The batted-ball profile shares the Advanced card's seasonAdvanced
      // response — one fetch feeds both cards.
      block.battedBall = group === 'hitting' ? battedBallView(advancedBundle?.seasonAdvanced) : null
      return block
    }),
  )

  // The Analytics shelf's Prospect Card — MiLB only (an MLB player already gets
  // StatcastPercentiles/AdvancedStatsCard in that space; this is what fills it
  // for anyone below the majors). `trendEntry.group` says which stat block the
  // card belongs under; a player with no trend row yet still gets a card in his
  // PRIMARY group, so an untracked prospect's page isn't silently blank in a
  // DIFFERENT way than before.
  const trendEntry = prospectTrendById(prospectTrend, bio.id)
  const prospectCard =
    currentActivitySportId !== 1
      ? prospectCardView(
          trendEntry,
          typeof bio.age === 'number' ? bio.age : null,
          prospectTrend?.levelAverageAge?.[currentActivitySportId] ?? null,
        )
      : null

  return {
    bio,
    blocks,
    season,
    asOf,
    sportId: currentActivitySportId,
    prospectCard,
    prospectCardGroup: trendEntry?.group ?? primaryGroup,
  }
}
