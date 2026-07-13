// Game Score — the 0.0-10.0 "how exciting was this game" rating, read from a
// static same-origin file (public/data/game-score.json) regenerated every 10
// minutes by scripts/gen-game-score.mjs (see
// .github/workflows/update-game-score.yml) — this module just reads it. Keyed
// by gamePk, each entry `{ score, sportId, homeId, awayId }` — the level +
// both team ids ride along (from the same feed already fetched to score the
// game) so a caller can filter the whole pool by level/team, e.g. the Top
// Games page's level + favorite-team filters, without an extra fetch per
// game. See docs/game-score.md for the formula and ADR-0015 for why this one
// number is allowed to render outside a SealBox. Degrades to an empty map
// before the file exists or on any fetch failure — a missing badge, not a
// broken slate. Cached in-memory for the session; the file only grows a
// little every ~10 minutes, so a stale in-session read just means a
// just-Finaled game's score shows up on the next full page load.
import { tierForZ, meanAndSd } from '../lib/statTiers.js'

let cached = null

export async function fetchGameScores() {
  if (cached) return cached
  try {
    const res = await fetch('/data/game-score.json')
    if (!res.ok) throw new Error(`game-score.json ${res.status}`)
    const json = await res.json()
    cached = json.scores ?? {}
  } catch {
    cached = {}
  }
  return cached
}

// A single game's score, formatted to one decimal ("7.5"), or null when this
// gamePk hasn't been scored yet (too recent, or never had a live feed).
export function gameScoreFor(scores, gamePk) {
  const v = scores?.[gamePk]?.score
  return typeof v === 'number' ? v.toFixed(1) : null
}

// One pass over every scored game (population mean/SD — see lib/statTiers.js,
// the same SD-bucket convention api/umpires.js uses for plate-umpire accuracy
// tiers, applied here to Game Score instead of called-pitch accuracy):
//   • ranked — every {gamePk, score, sportId, homeId, awayId, tier}, best first.
//   • mean / sd / n — the whole pool's stats.
//   • thresholds — the numeric score each tier starts at, for a "here's the
//     range" readout (Top Games page): eliteMin (mean + 1 SD), goodMin
//     (== mean), averageMin (mean − 1 SD) — below averageMin is "Below
//     Average". A tiny or empty pool (n < 2, or sd === 0) still returns
//     thresholds; every game just lands in the same tier.
// Filter the `scores` map BEFORE calling this (e.g. to one level, or one
// team's games) to have mean/sd/tiers recompute relative to that subset
// rather than the whole season — see TopGamesPage's level/favorite filters.
export function gameScoreIndex(scores) {
  const entries = Object.entries(scores ?? {})
    .filter(([, v]) => typeof v?.score === 'number')
    .map(([gamePk, v]) => ({
      gamePk,
      score: v.score,
      sportId: v.sportId,
      homeId: v.homeId,
      awayId: v.awayId,
    }))
    .sort((a, b) => b.score - a.score)

  const { mean, sd, n } = meanAndSd(entries.map((e) => e.score))
  const ranked = entries.map((e) => ({
    ...e,
    tier: tierForZ(sd ? (e.score - mean) / sd : 0),
  }))

  return {
    n,
    mean,
    sd,
    thresholds: { eliteMin: mean + sd, goodMin: mean, averageMin: mean - sd },
    ranked,
  }
}

// The top N games by score — just `gameScoreIndex`'s already-sorted `ranked`,
// trimmed. A thin convenience for the Top Games page.
export function topGamesByScore(scores, limit = 25) {
  return gameScoreIndex(scores).ranked.slice(0, limit)
}
