// How the primer gets its finished games: the nightly shard block first, the
// live read for whatever the block does not have (ADR-0087, 2026-10-08
// addendum, decision d). Pure; useSeriesPrimerData does the reads.
//
// One finished game, the slice 1 shape (ribbonNodes.js):
//   { gamePk, n, date, awayId, homeId, venueId, venueName, runs: { away, home }, wp }
//
// The shard block lives on the callouts bundle of TODAY'S game
// (public/data/callouts/{MMDDYYYY}/{gamePk}.json, api/callouts.js) as `series`:
//   { id, gamePks: number[], games: Game[], stats?: loadSeriesStats's output }
// `gamePks` is required: the stats carry no game ids, so it is the only proof of
// which games they sum. `stats` is optional. Without it the live read supplies
// the stats.
//
// SPOILER FOOTING. Every game here is one the bracket counts (Final before the
// cutoff date). A block that names any other game is dropped whole, so a stale
// or early file cannot bring today's result in. The caller gives `counted`;
// nothing else decides which games show.

import { seriesBlockFor as blockOf } from '../../../api/callouts.js'
import { wpLine } from './wpSpark.js'

export function seriesBlockFor(bundle, seriesId) {
  const block = blockOf(bundle)
  return block?.id === seriesId ? block : null
}

// -> { usable, byPk, needLive }
//   usable    the block has the shape above and names no game the bracket does
//             not count. A block of any other shape is not used.
//   byPk      the block's games, by gamePk (empty when not usable)
//   needLive  a live read is needed: no usable block, a counted game the block
//             lacks, or stats that are not tied to exactly the counted games.
//             The block's `stats` carry no game ids, so `gamePks` is the only
//             proof of what they cover. The live stats cover every counted
//             game, so a missing game means live stats too.
export function planShard(block, counted) {
  const pks = new Set(counted.map((g) => g.gamePk))
  const shaped =
    Array.isArray(block?.gamePks) && Array.isArray(block.games) && block.games.every((g) => g?.gamePk != null)
  const usable = shaped && [...block.gamePks, ...block.games.map((g) => g.gamePk)].every((pk) => pks.has(pk))
  const byPk = usable ? Object.fromEntries(block.games.map((g) => [g.gamePk, g])) : {}
  const exact = usable && new Set(block.gamePks).size === pks.size
  const complete = counted.every((g) => byPk[g.gamePk])
  return { usable, byPk, needLive: counted.length > 0 && !(exact && complete && block.stats) }
}

// The live read's games, by gamePk. `log` is useSeriesLog's data. A game with
// no box score (its read failed) has no runs to show, so it is left out.
function liveGames(counted, log) {
  const out = {}
  for (const g of counted) {
    const box = log?.stats?.runsByGame?.[g.gamePk]
    if (!box) continue
    const venue = log.cardsByPk?.[g.gamePk]?.venue
    out[g.gamePk] = {
      gamePk: g.gamePk,
      n: g.gameNumber,
      date: g.date,
      awayId: box.awayId,
      homeId: box.homeId,
      venueId: venue?.id ?? null,
      venueName: venue?.name ?? '',
      runs: box.runs,
      wp: wpLine(log.gameSignals?.[g.gamePk]?.winProb, box.homeId),
    }
  }
  return out
}

// -> { games, stats, source: 'shard' | 'live' | 'mixed' }. `log` may be null
// while the live read is still on its way; the games it would give are then
// missing, and the caller shows its loading state.
export function primerData(block, counted, log) {
  const { byPk, needLive } = planShard(block, counted)
  const live = needLive ? liveGames(counted, log) : {}
  return {
    games: counted.map((g) => byPk[g.gamePk] ?? live[g.gamePk]).filter(Boolean),
    stats: needLive ? (log?.stats ?? null) : (block?.stats ?? null),
    source: Object.keys(byPk).length === 0 ? 'live' : needLive ? 'mixed' : 'shard',
  }
}
