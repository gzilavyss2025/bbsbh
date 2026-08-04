import { similarHitters } from '../lib/hitterSimilarity.js'

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

// Which five metrics the radar plots, in clockwise order from 12 o'clock.
//
// FIVE, not all of them: a pentagon's five sides are individually legible on a
// phone, and past six or seven spokes the labels crowd and the shape stops
// being a silhouette a reader can recognise. The metrics left out aren't
// dropped — they're in the labelled percentile cards directly beneath, which is
// where the exhaustive list belongs.
//
// The ORDER is chosen so related skills sit adjacent, because the polygon's
// shape is the whole point: a pitcher's stuff (K%, whiff) makes one lobe and
// his contact management (hard-hit) another, so "power arm" and "soft-contact
// specialist" come out as visibly different silhouettes. Shuffling these keys
// changes what every player's shape looks like — it isn't a cosmetic list.
export const RADAR_KEYS = {
  pitching: ['xera', 'k', 'whiff', 'bb', 'hardHit'],
  hitting: ['xwoba', 'brl', 'ev', 'hardHit', 'chase'],
}

// Spoke labels drop the trailing "%" the card versions carry. Not a style
// preference: a radar's side labels run outward from their anchor toward the
// viewBox edge, so every character costs gutter, and the raw value printed
// directly beneath already carries the unit ("43.0%"). Only the labels that
// actually need shortening have an entry.
const RADAR_LABELS = {
  k: 'K',
  bb: 'BB',
  whiff: 'Whiff',
  chase: 'Chase',
  hardHit: 'Hard-hit',
  brl: 'Barrel',
  ev: 'Exit velo',
}

// The spoke list radarGeometry consumes, joining a player's percentiles to his
// raw rates. `percentile` is null for a metric he's under Savant's sample floor
// for (the geometry keeps its side and marks it unknown); `value` is null when
// the raw-rate map is missing, which only costs the labels.
//
// Returns null when there's no percentile data at all, or when fewer than three
// of the five spokes are known — a pentagon with two real corners is a shape
// that misleads rather than informs.
export function radarSpokes(savant, raw, group) {
  if (!savant) return null
  const metrics = group === 'pitching' ? PITCHER_METRICS : BATTER_METRICS
  const keys = RADAR_KEYS[group === 'pitching' ? 'pitching' : 'hitting']
  const spokes = keys.map((key) => {
    const m = metrics.find((x) => x.key === key)
    const pct = savant[key]
    const rawValue = raw?.[key]
    return {
      key,
      label: RADAR_LABELS[key] ?? m?.label ?? key,
      percentile: Number.isFinite(pct) ? pct : null,
      value: Number.isFinite(rawValue) && m?.fmt ? m.fmt(rawValue) : null,
      lowerIsBetter: Boolean(m?.lowerIsBetter),
    }
  })
  return spokes.filter((s) => s.percentile != null).length >= 3 ? spokes : null
}
