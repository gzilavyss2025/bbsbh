// The "series" block of a nightly callouts shard (scripts/gen-callouts.mjs):
// one LCS or World Series heading into the slate date, so the series primer
// reads one file instead of about 4 requests per finished game. Pure.
//
// The counted games are the bracket's own (deriveBracket, ADR-0087): Final with
// a winner before the cutoff, on the resume date for a suspended game. The
// date filter below repeats that rule, so a live bracket that counts today's
// game still writes nothing from it. "If necessary" and later games are not in
// the block at all.
//
// dataByPk: { [gamePk]: { box, feed, winProb } }, the raw /boxscore, the
// feed/live read with WHIFF_FEED_FIELDS plus the venue, and /winProbability.
// Returns null for a game outside an LCS or the World Series, or when a counted
// game has no box score: no block is better than a block that is short a game.
import { foldSeriesStats } from '../../../api/postseasonSeries.js'
import { seriesForGame } from '../../../api/postseason/bracket.js'
import { gamePoints } from '../seriesFlow.js'

const WP_POINTS = 26

export function seriesBlock(bracket, gamePk, dataByPk) {
  const series = seriesForGame(bracket, gamePk)?.series
  if (series?.round !== 'lcs' && series?.round !== 'worldseries') return null
  const counted = series.games.filter((g) => g.date < bracket.cutoff)
  const reads = counted.map((g) => dataByPk[g.gamePk])
  if (reads.some((r) => !r?.box)) return null
  const { batting, pitching, totals } = foldSeriesStats(
    reads.map((r) => r.box),
    reads.map((r) => r.feed),
  )
  return {
    gamePks: counted.map((g) => g.gamePk),
    games: counted.map((g, i) => finishedGame(g, reads[i])),
    stats: { batting, pitching, totals },
  }
}

// One finished game, in ribbonNodes.js's shape.
function finishedGame(game, { box, feed, winProb }) {
  const [away, home] = [box.teams?.away, box.teams?.home]
  const homeId = home?.team?.id ?? null
  const ys = gamePoints(winProb, homeId, homeId).points.map((p) => Math.round(p.y))
  return {
    gamePk: game.gamePk,
    n: game.gameNumber,
    date: game.date,
    awayId: away?.team?.id ?? null,
    homeId,
    venueId: feed?.gameData?.venue?.id ?? null,
    venueName: feed?.gameData?.venue?.name ?? '',
    runs: { away: away?.teamStats?.batting?.runs ?? null, home: home?.teamStats?.batting?.runs ?? null },
    wp:
      ys.length <= WP_POINTS
        ? ys
        : Array.from({ length: WP_POINTS }, (_, i) => ys[Math.round((i * (ys.length - 1)) / (WP_POINTS - 1))]),
  }
}
