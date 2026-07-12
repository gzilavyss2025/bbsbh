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
// component doesn't hard-code JSX per metric. `def` is the plain-language
// gloss shown when a row is tapped open (StatcastPercentiles.jsx); every one
// notes that a longer bar is the good direction, since Savant's own percentiles
// are pre-flipped so 99th is always "elite" even for stats where a low raw
// number is good (xERA, Chase%, BB% allowed) — see gen-savant-percentiles.mjs.
export const BATTER_METRICS = [
  {
    key: 'xwoba',
    label: 'xwOBA',
    def: 'Expected quality of contact and outcome, adjusted for luck — the all-in-one number. Longer bar is better.',
  },
  {
    key: 'ev',
    label: 'Exit velo',
    def: 'Average speed the ball leaves the bat. Longer bar is better.',
  },
  {
    key: 'hardHit',
    label: 'Hard-hit %',
    def: 'Share of batted balls hit 95+ mph. Longer bar is better.',
  },
  {
    key: 'brl',
    label: 'Barrel %',
    def: 'Share of batted balls hit at the ideal speed-and-angle combo for extra-base hits. Longer bar is better.',
  },
  {
    key: 'chase',
    label: 'Chase %',
    def: 'How often he swings at pitches outside the strike zone. Longer bar means more disciplined (fewer chases).',
  },
  {
    key: 'sprintSpeed',
    label: 'Sprint speed',
    def: 'Top running speed, in feet per second. Longer bar is faster.',
  },
]

export const PITCHER_METRICS = [
  {
    key: 'xera',
    label: 'xERA',
    def: 'Expected ERA based on the quality of contact allowed, not what actually happened. Longer bar means fewer earned runs expected.',
  },
  {
    key: 'k',
    label: 'K %',
    def: 'Share of batters faced that he strikes out. Longer bar is better.',
  },
  {
    key: 'bb',
    label: 'BB %',
    def: 'Share of batters faced that he walks. Longer bar means fewer walks allowed.',
  },
  {
    key: 'whiff',
    label: 'Whiff %',
    def: 'Share of swings against him that miss entirely. Longer bar is better.',
  },
  {
    key: 'chase',
    label: 'Chase %',
    def: 'How often batters swing at his pitches outside the strike zone. Longer bar is better.',
  },
  {
    key: 'fbVelo',
    label: 'Fastball velo',
    def: 'Average fastball speed. Longer bar is faster.',
  },
  {
    key: 'hardHit',
    label: 'Hard-hit %',
    def: 'Share of batted balls allowed at 95+ mph. Longer bar means less hard contact allowed.',
  },
]
