import { shardKey100 } from '../lib/shardKey.js'
import { staticJsonBy } from './staticJson.js'

// GLOVE TARGET — which way a pitcher misses, not just how far.
//
// The Target Command strip (api/targetCommand.js) prints one number per pitch
// type: the median inches between the catcher's glove and where the ball
// crossed. This is the cloud behind that number. Each dot is one pitch's MISS
// VECTOR — actual minus target — so the glove sits at the origin for every dot
// on the card, and a pitcher who lives above the target, or off to his arm
// side, shows it as a cloud that is off centre rather than merely wide.
//
// WHY A MISS AND NOT A LOCATION. Every pitch has its own target: the catcher
// sets up outside, then inside, then low. Scattering absolute locations around
// one average target would draw the catcher's movement and the pitcher's miss
// added together, with nothing saying which is which, and the median-miss ring
// would not halve the cloud. It would also repeat the Command Map directly
// above it, which already plots where a pitcher's pitches go. The full argument,
// and the sampling that follows from it, is in scripts/gen-command-zone.mjs.
//
// SPOILER FOOTING — spoiler-FREE, no SealBox, same as targetCommand.js and
// commandMap.js beside it: a season's worth of offsets in inches, over games
// already final, carrying no line and no per-game result. The dots are
// deliberately unordered and undated — nothing here can be read back to a
// particular game.
//
// The data is OpenCommand's, under CC BY-NC-SA 4.0; the card renders the credit
// line, and the dataset itself is only ever read by the nightly precompute
// (scripts/gen-command-zone.mjs), never by the app.
export const fetchGloveTargetShard = staticJsonBy((key) => `/data/glove-target/${key}.json`, {
  fallback: null,
})

export async function fetchGloveTargetFor(personId, season) {
  if (personId == null) return null
  const shard = await fetchGloveTargetShard(shardKey100(personId))
  // The buckets carry one season, named in the file. A page on any other one
  // shows nothing rather than last year's cloud under this year's heading —
  // the same gate targetCommandFor makes.
  if (season != null && shard?.season != null && Number(season) !== Number(shard.season)) return null
  return shard?.pit?.[String(personId)] ?? null
}

// THE PLOT'S DOMAIN, in inches of miss, and the reference rings drawn on it.
//
// Measured over every dot this dataset ships for 2026 (138,432 of them): half
// are inside 9.7in, nine in ten inside 19.6in, ninety-nine in a hundred inside
// 28.8in. So a 30in rim holds 99.3% of them at a scale where the 8-11in band
// every median lands in is still readable. The rare dot beyond the rim is drawn
// ON the rim rather than dropped or allowed to escape the frame — the same
// convention lib/zone/zoneGeometry.js's grid takes for a pitch thrown to the
// backstop, and for the same reason: it is still "way off", and a bucket of its
// own would carry a handful of pitches and no meaning.
export const RIM_IN = 30
export const REFERENCE_RINGS = [10, 20, 30]

// The pitch types a pitcher has a cloud for, ALL first and then his own by how
// often he threw them — the chip row's order, matching the Target Command strip
// above it so the two cards list a pitcher's arsenal the same way.
export function gloveTargetTypes(entry) {
  if (!entry) return []
  return Object.entries(entry)
    .map(([code, v]) => ({ code, n: v.n, miss: v.miss }))
    .sort((a, b) => {
      if (a.code === 'ALL') return -1
      if (b.code === 'ALL') return 1
      return b.n - a.n
    })
}

// One selected cloud, with its dots already clamped to the rim. Null when the
// pitcher has no row for that type — the card falls back to ALL rather than
// drawing an empty frame.
export function gloveTargetView(entry, code) {
  const row = entry?.[code] ?? entry?.ALL ?? null
  if (!row?.dots?.length) return null
  return {
    n: row.n,
    miss: row.miss,
    // Straight through from the precompute, where it was taken over every
    // pitch of the season rather than over the dots drawn here — see
    // gen-command-zone.mjs, and gloveTargetBias below for what it becomes.
    bias: row.bias ?? null,
    dots: row.dots.map(([x, z]) => {
      const d = Math.hypot(x, z)
      if (d <= RIM_IN || d === 0) return { x, z, clamped: false }
      const k = RIM_IN / d
      return { x: x * k, z: z * k, clamped: true }
    }),
  }
}

// Which way the cloud sits, as plain words — the reading the picture makes
// available, and which a caption can make explicit.
//
// The figures come from the precompute, taken as a MEDIAN over every pitch of
// the season (gen-command-zone.mjs), not from the forty-eight dots drawn here.
// A sentence this flat should rest on the whole season: measured off the sample
// instead, it wanders an inch either way between nightly runs on data that did
// not move, which is how a caption teaches a reader to ignore it.
//
// Reported only when the drift is big enough to be worth a word. A baseball is
// 2.9in across, so two inches of median drift is comfortably below "you could
// pick that out of the picture", and calling it a tendency would be reading
// noise aloud.
const BIAS_FLOOR_IN = 2

export function gloveTargetBias(view) {
  const bias = view?.bias
  if (!Array.isArray(bias)) return null
  const [x, z] = bias
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null
  const parts = []
  // x runs to the CATCHER's right, which is the reader's right on this card
  // because the plot is drawn from the catcher's eye — the same view the
  // Command Map takes, so the two agree about which side is which.
  if (Math.abs(x) >= BIAS_FLOOR_IN) parts.push(x > 0 ? 'to the catcher’s right' : 'to the catcher’s left')
  if (Math.abs(z) >= BIAS_FLOOR_IN) parts.push(z > 0 ? 'high' : 'low')
  if (!parts.length) return null
  return { x, z, text: parts.join(' and ') }
}
