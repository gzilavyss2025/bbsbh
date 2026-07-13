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
    def: 'Expected quality of contact and result, luck-adjusted — the single best all-around number.',
  },
  {
    key: 'ev',
    label: 'Exit velo',
    def: 'Average speed the ball leaves the bat.',
  },
  {
    key: 'hardHit',
    label: 'Hard-hit %',
    def: 'Share of batted balls hit 95+ mph.',
  },
  {
    key: 'brl',
    label: 'Barrel %',
    def: 'Share of batted balls hit at the ideal speed-and-angle combo for extra bases.',
  },
  {
    key: 'chase',
    label: 'Chase %',
    def: 'How often he swings at pitches outside the strike zone. Higher percentile means more disciplined, not more chasing.',
  },
  {
    key: 'sprintSpeed',
    label: 'Sprint speed',
    def: 'Top running speed, in feet per second.',
  },
]

export const PITCHER_METRICS = [
  {
    key: 'xera',
    label: 'xERA',
    def: 'Expected ERA from the contact he allows, not what actually happened. Higher percentile means fewer runs expected.',
  },
  {
    key: 'k',
    label: 'K %',
    def: 'Share of batters faced that he strikes out.',
  },
  {
    key: 'bb',
    label: 'BB %',
    def: 'Share of batters faced that he walks. Higher percentile means fewer walks.',
  },
  {
    key: 'whiff',
    label: 'Whiff %',
    def: 'Share of swings against him that miss entirely.',
  },
  {
    key: 'chase',
    label: 'Chase %',
    def: 'How often batters chase his pitches outside the strike zone.',
  },
  {
    key: 'fbVelo',
    label: 'Fastball velo',
    def: 'Average fastball speed.',
  },
  {
    key: 'hardHit',
    label: 'Hard-hit %',
    def: 'Share of batted balls allowed at 95+ mph. Higher percentile means less hard contact allowed.',
  },
]
