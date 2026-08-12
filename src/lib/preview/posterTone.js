// Normalise a ballpark photograph's tonal range before it goes under the head's
// manila wash.
//
// WHY THIS EXISTS. The wash is a fixed operation, but the photographs are not:
// a bright midday aerial and a contrasty dusk shot come out of the same code at
// wildly different densities. Petco washed out to almost nothing — the head
// read as slightly dirty paper with two tiles floating on it — while Yankee
// Stadium, same code, came through atmospheric and good. A treatment that
// produces a great head for one park and a blank one for another is not a
// treatment, it is a coin flip.
//
// So each photo is MEASURED and remapped onto one target band. What follows is
// the plainest possible auto-levels: sample the image small, find the 5th and
// 95th percentile luminance, and stretch that span to a fixed pair of targets.
//
// It runs on the loaded <img> rather than on the poster canvas, and only ever
// reads — which is safe precisely because posterImages.js loads everything in
// CORS-anonymous mode. A photo from a host that refused CORS would taint the
// sampling canvas and throw here; the catch below hands back the identity
// filter, so the poster still paints (and, as ever, still exports).
const SAMPLE = 96

// Where the 5th and 95th percentiles should land, 0-1. Not 0 and 1: a
// photograph stretched to the full range under a 50% wash goes chalky in the
// highlights and blocks up in the shadows. This band is the one the wash was
// tuned against.
const TARGET_LO = 0.14
const TARGET_HI = 0.74

const cache = new WeakMap()

// A CSS filter string — `brightness(b) contrast(c)` — that maps this image's
// tonal span onto the target band. Order matters and matches the way the
// caller composes it: grayscale, then brightness, then contrast.
//
// CSS applies them as `x -> ((x * b) - 0.5) * c + 0.5`, and we want a linear
// `x -> a * x + d`, so `a = b * c` and `d = 0.5 - 0.5 * c`. Solving:
// `c = 1 - 2d` and `b = a / c`.
export function toneFilter(img) {
  if (!img) return ''
  if (cache.has(img)) return cache.get(img)
  let filter = ''
  try {
    const [lo, hi] = percentiles(img)
    // A flat or degenerate sample gets left alone rather than amplified into
    // noise — a legitimately low-contrast photograph is not a broken one.
    if (hi - lo > 0.04) {
      const a = (TARGET_HI - TARGET_LO) / (hi - lo)
      const d = TARGET_LO - lo * a
      const c = 1 - 2 * d
      if (c > 0.05) {
        const b = a / c
        filter = `brightness(${b.toFixed(3)}) contrast(${c.toFixed(3)})`
      }
    }
  } catch {
    filter = ''
  }
  cache.set(img, filter)
  return filter
}

// The 5th and 95th percentile luminance of a small sample of the image, 0-1.
function percentiles(img) {
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE)

  // A 256-bin histogram rather than a sorted array: same answer, no allocation
  // per pixel, and the bins ARE the precision the eight-bit source has.
  const bins = new Uint32Array(256)
  let counted = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue // transparent corners of a padded photo
    // Rec. 601 luma, the same weighting `grayscale(1)` applies.
    bins[Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])] += 1
    counted += 1
  }
  if (!counted) return [0, 1]
  return [binAt(bins, counted * 0.05), binAt(bins, counted * 0.95)]
}

function binAt(bins, target) {
  let seen = 0
  for (let i = 0; i < bins.length; i += 1) {
    seen += bins[i]
    if (seen >= target) return i / 255
  }
  return 1
}
