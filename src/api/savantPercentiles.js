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

// Metric display order + labels for the percentile bars — kept here so the
// component doesn't hard-code JSX per metric.
export const BATTER_METRICS = [
  { key: 'xwoba', label: 'xwOBA' },
  { key: 'ev', label: 'Exit velo' },
  { key: 'hardHit', label: 'Hard-hit %' },
  { key: 'brl', label: 'Barrel %' },
  { key: 'chase', label: 'Chase %' },
  { key: 'sprintSpeed', label: 'Sprint speed' },
]

export const PITCHER_METRICS = [
  { key: 'xera', label: 'xERA' },
  { key: 'k', label: 'K %' },
  { key: 'bb', label: 'BB %' },
  { key: 'whiff', label: 'Whiff %' },
  { key: 'chase', label: 'Chase %' },
  { key: 'fbVelo', label: 'Fastball velo' },
  { key: 'hardHit', label: 'Hard-hit %' },
]
