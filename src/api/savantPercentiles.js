// Season Statcast percentile ranks, read from a static same-origin file
// (public/data/savant-percentiles.json) rather than fetched live from
// Baseball Savant. That file is regenerated nightly by
// scripts/gen-savant-percentiles.mjs (see .github/workflows/update-nightly-data.yml)
// — this module just reads it. Keyed by MLB Stats API personId (Savant's own
// player_id is the same MLBAM id), so callers can index straight off a
// roster entry's person.id. Degrades to empty maps before the file exists or
// on any fetch failure — the card simply doesn't render. Cached in-memory for
// the session since the file only changes once a day.
let cached = null

export async function fetchSavantPercentiles() {
  if (cached) return cached
  try {
    const res = await fetch('/data/savant-percentiles.json')
    if (!res.ok) throw new Error(`savant-percentiles.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = { season: null, bat: {}, pit: {} }
  }
  return cached
}

// A single player's percentile map for one group, or null when he isn't in
// the file (MiLB-only, or under Savant's own per-metric sample floor for
// every metric this app keeps).
export function savantPercentilesFor(data, personId, group) {
  const key = group === 'pitching' ? 'pit' : 'bat'
  return data?.[key]?.[personId] ?? null
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
export const BATTER_METRICS = [
  {
    key: 'xwoba',
    label: 'xwOBA',
    def: 'A single all-around rating of how well he hits, based on how hard and how squarely he makes contact.',
  },
  {
    key: 'ev',
    label: 'Exit velo',
    def: 'How hard he hits the ball on average.',
  },
  {
    key: 'hardHit',
    label: 'Hard-hit %',
    def: 'How often he really crushes a ball rather than hitting it softly.',
  },
  {
    key: 'brl',
    label: 'Barrel %',
    def: 'How often he catches a ball with the ideal mix of speed and angle for extra-base damage.',
  },
  {
    key: 'chase',
    label: 'Chase %',
    def: 'How well he lays off pitches outside the strike zone — a higher percentile means better plate discipline.',
  },
  {
    key: 'sprintSpeed',
    label: 'Sprint speed',
    def: 'How fast he runs at full sprint.',
  },
]

export const PITCHER_METRICS = [
  {
    key: 'xera',
    label: 'xERA',
    def: 'How stingy the quality of contact he allows suggests he should be — a higher percentile means fewer runs expected.',
  },
  {
    key: 'k',
    label: 'K %',
    def: 'How often he strikes out the batters he faces.',
  },
  {
    key: 'bb',
    label: 'BB %',
    def: 'How often he walks the batters he faces — a higher percentile means fewer walks.',
  },
  {
    key: 'whiff',
    label: 'Whiff %',
    def: 'How often batters swing and miss against him.',
  },
  {
    key: 'chase',
    label: 'Chase %',
    def: 'How often he gets batters to swing at pitches outside the strike zone — a higher percentile means more chases drawn.',
  },
  {
    key: 'fbVelo',
    label: 'Fastball velo',
    def: 'How hard he throws his fastball on average.',
  },
  {
    key: 'hardHit',
    label: 'Hard-hit %',
    def: 'How often hitters really crush the ball off him — a higher percentile means less hard contact allowed.',
  },
]
