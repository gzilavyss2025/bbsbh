import { similarHitters } from '../lib/hitterSimilarity.js'
import { staticJson } from './staticJson.js'

// Season Statcast percentile ranks, read from a static same-origin file
// (public/data/savant-percentiles.json) rather than fetched live from
// Baseball Savant. That file is regenerated nightly by
// scripts/gen-savant-percentiles.mjs (see .github/workflows/update-nightly-data.yml)
// — this module just reads it. Keyed by MLB Stats API personId (Savant's own
// player_id is the same MLBAM id), so callers can index straight off a
// roster entry's person.id. Degrades to empty maps before the file exists or
// on any fetch failure — the card simply doesn't render. Cached in-memory for
// the session since the file only changes once a day.
export const fetchSavantPercentiles = staticJson('/data/savant-percentiles.json', {
  fallback: { season: null, bat: {}, pit: {} },
})

// A single player's percentile map for one group, or null when he isn't in
// the file (MiLB-only, or under Savant's own per-metric sample floor for
// every metric this app keeps).
export function savantPercentilesFor(data, personId, group) {
  const key = group === 'pitching' ? 'pit' : 'bat'
  return data?.[key]?.[personId] ?? null
}

// The same player's RAW season rates, on the same metric keys — what the radar
// prints beside each spoke, so the shape reports a season and not only a
// ranking. A SEPARATE map because it comes from a separate Savant leaderboard:
// the percentile board this file is named for carries percentiles only, every
// column already a 0–100 rank (see gen-savant-percentiles.mjs). Null when that
// second fetch failed on the last nightly run, which the radar degrades to
// plotting the shape with no spoke labels.
export function savantRawFor(data, personId, group) {
  const key = group === 'pitching' ? 'rawPit' : 'rawBat'
  return data?.[key]?.[personId] ?? null
}

// "Hits like" — the closest bats in Statcast SKILL space to one hitter, for
// the player page's SimilarHitters card. The ranking model is pure and lives
// in src/lib/hitterSimilarity.js; this is only the part that knows how
// savant-percentiles.json is SHAPED, flattening its `bat` map into the flat
// pool that module ranks.
//
// No level split, unlike pitchArsenal.js's similarPitchersFor: Savant has no
// minor-league board, so `bat` is one MLB pool and there is no second peer
// group to keep it away from.
//
// Spoiler footing is unchanged from the rest of this module: season aggregates
// off a nightly file, no SealBox. Returns [] whenever it can't answer — file
// not loaded, or subject not in it — so the card simply doesn't render.
export function similarHittersFor(data, personId, opts) {
  const entries = data?.bat
  if (!entries) return []
  const pool = Object.entries(entries).map(([id, pct]) => ({ personId: Number(id), pct }))
  return similarHitters(pool, personId, opts)
}

// How many qualified players a group's percentiles are ranked against — lets
// a caller turn "4th percentile" into "harder than only ~22 other hitters"
// (RadarPill's EvMeter), a real count from this same file rather than an
// invented one. 0 before the file loads.
export function qualifiedCount(data, group) {
  const key = group === 'pitching' ? 'pit' : 'bat'
  return Object.keys(data?.[key] ?? {}).length
}

// Metric display order + labels for the percentile cards — kept here so the
// component doesn't hard-code JSX per metric. `def` is the plain-language
// gloss shown on a card's flipped-open back face (StatcastPercentiles.jsx).
// A higher percentile is always the good direction — Savant's own
// percentiles are pre-flipped so 99th is always "elite" even for stats where
// a low raw number is good (xERA, Chase%, BB% allowed) — see
// gen-savant-percentiles.mjs — so only the metrics where that's non-obvious
// spell it out.
// `fmt` renders the RAW season rate for the radar's spoke label; `lowerIsBetter`
// drives the ↓ marker beside it. That marker is doing real work: the percentile
// (and so the polygon) is pre-flipped so farther out is always better, which
// means a good BB%-allowed spoke reaches the rim while its raw number is small.
// Without the ↓ a reader reasonably concludes the chart is drawn backwards.
const pct1 = (n) => `${n.toFixed(1)}%`
const dec2 = (n) => n.toFixed(2)
const dec1 = (n) => n.toFixed(1)
// ".415" — a rate stat below 1 is written without its leading zero in a
// scorebook, same as an batting average.
const rate3 = (n) => n.toFixed(3).replace(/^0/, '')

export const BATTER_METRICS = [
  {
    key: 'xwoba',
    label: 'xwOBA',
    fmt: rate3,
    def: 'A single all-around rating of how well he hits, based on how hard and how squarely he makes contact.',
  },
  {
    key: 'ev',
    label: 'Exit velo',
    fmt: dec1,
    def: 'How hard he hits the ball on average.',
  },
  {
    key: 'hardHit',
    label: 'Hard-hit %',
    fmt: pct1,
    def: 'How often he really crushes a ball rather than hitting it softly.',
  },
  {
    key: 'brl',
    label: 'Barrel %',
    fmt: pct1,
    def: 'How often he catches a ball with the ideal mix of speed and angle for extra-base damage.',
  },
  {
    key: 'chase',
    label: 'Chase %',
    fmt: pct1,
    lowerIsBetter: true,
    def: 'How well he lays off pitches outside the strike zone — a higher percentile means better plate discipline.',
  },
  {
    key: 'sprintSpeed',
    label: 'Sprint speed',
    fmt: dec1,
    def: 'How fast he runs at full sprint.',
  },
]

export const PITCHER_METRICS = [
  {
    key: 'xera',
    label: 'xERA',
    fmt: dec2,
    lowerIsBetter: true,
    def: 'How stingy the quality of contact he allows suggests he should be — a higher percentile means fewer runs expected.',
  },
  {
    key: 'k',
    label: 'K %',
    fmt: pct1,
    def: 'How often he strikes out the batters he faces.',
  },
  {
    key: 'bb',
    label: 'BB %',
    fmt: pct1,
    lowerIsBetter: true,
    def: 'How often he walks the batters he faces — a higher percentile means fewer walks.',
  },
  {
    key: 'whiff',
    label: 'Whiff %',
    fmt: pct1,
    def: 'How often batters swing and miss against him.',
  },
  {
    key: 'chase',
    label: 'Chase %',
    fmt: pct1,
    def: 'How often he gets batters to swing at pitches outside the strike zone — a higher percentile means more chases drawn.',
  },
  {
    key: 'fbVelo',
    label: 'Fastball velo',
    fmt: dec1,
    def: 'How hard he throws his fastball on average.',
  },
  {
    key: 'hardHit',
    label: 'Hard-hit %',
    fmt: pct1,
    lowerIsBetter: true,
    def: 'How often hitters really crush the ball off him — a higher percentile means less hard contact allowed.',
  },
]

// The rows the percentile strip draws, joining a player's percentile ranks to
// the raw rates behind them. One row per metric he qualifies for, in the
// canonical BATTER_METRICS/PITCHER_METRICS order.
//
// EVERY qualifying metric, and the canonical order — the two properties the
// five-spoke radar this replaced could not have. A pentagon holds five labels
// legibly, so a hitter's sprint speed and a pitcher's chase and fastball velo
// sat in the card grid below but never in the shape above it; a reader taking
// the summary at its word got a profile with the player's worst tool quietly
// missing from it. And a polygon's silhouette depends on which arbitrary order
// the spokes are listed in, so the same numbers in a different order drew a
// different player. A shared axis has neither problem: rows are independent, so
// the list can hold as many as the player has, and it can stay in one fixed
// order across every player — which is the entire point of a percentile rank.
// See ADR-0040.
//
// `value` is the formatted raw rate, or null when the raw-rate map is missing
// (which costs only the middle column). A metric the player is under Savant's
// own sample floor for has no percentile and is left out entirely, same as the
// card grid always did.
//
// Returns null when fewer than three metrics are known — a two-row strip is a
// stat line, not a profile, and the labelled season tables above already say it
// better.
export function percentileRows(savant, raw, group) {
  if (!savant) return null
  const metrics = group === 'pitching' ? PITCHER_METRICS : BATTER_METRICS
  const rows = metrics
    .filter((m) => Number.isFinite(savant[m.key]))
    .map((m) => {
      const rawValue = raw?.[m.key]
      return {
        key: m.key,
        label: m.label,
        percentile: savant[m.key],
        value: Number.isFinite(rawValue) && m.fmt ? m.fmt(rawValue) : null,
        lowerIsBetter: Boolean(m.lowerIsBetter),
        def: m.def,
      }
    })
  return rows.length >= 3 ? rows : null
}
