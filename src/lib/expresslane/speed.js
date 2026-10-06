// EXPRESS LANE — how fast this device is getting clips.
//
// The film gate makes download speed the speed of the whole session, and the
// design assumes MLB's clip host sends about 2.1 Mbps (runner.js). That figure
// was measured once, on one machine. This module is how a phone says what it
// actually gets, so the assumption can be checked on the device that matters.
//
// SPOILER-FREE, and the reason is in what it keeps. A sample is bytes and
// milliseconds of a clip ALREADY downloaded. It names no clip and no row. The
// summary is one rate for the whole window. Speed does not depend on a clip's
// size, so showing it cannot tell a scorer that the play ahead is a long one
// (ADR-0046). What this must never grow into is a per-clip figure, a byte count
// of the clip in flight, or a time estimate for the wait. Those are the things
// the waiting screens refuse to show, for the reason in FilmPane.jsx.
//
// ONE LOCALSTORAGE KEY, a per-device convenience. A cleared store reads as "no
// figure yet", and every path degrades to that rather than throwing.

export const SPEED_KEY = 'bbsbh:xl:speed'

// How many clips the figure looks back over. About a half-inning of Result
// mode: long enough to smooth one fast or slow clip, short enough that a phone
// that moved from Wi-Fi to cellular shows it within a few plays.
const WINDOW = 8

// Smaller than this is an error page or an empty body, not a clip. It would
// read as a very slow connection and mean nothing.
const MIN_BYTES = 100_000

function isSample(sample) {
  return (
    sample != null &&
    Number.isFinite(sample.bytes) &&
    Number.isFinite(sample.ms) &&
    sample.bytes >= MIN_BYTES &&
    sample.ms > 0
  )
}

// A new list with one more download on the end. A sample that cannot be a real
// download is dropped.
export function addSample(samples, sample) {
  const kept = Array.isArray(samples) ? samples : []
  if (!isSample(sample)) return [...kept]
  return [...kept, { bytes: sample.bytes, ms: sample.ms }].slice(-WINDOW)
}

// One rate for the window: all the bytes over all the time. NOT the average of
// each clip's own rate. A short clip that arrived fast must not hide a long one
// that did not, because the long one is most of what a scorer waits through.
export function summarizeSpeed(samples) {
  const good = (Array.isArray(samples) ? samples : []).filter(isSample)
  if (!good.length) return null
  let bytes = 0
  let ms = 0
  for (const sample of good) {
    bytes += sample.bytes
    ms += sample.ms
  }
  // bytes * 8 bits, over ms / 1000 seconds, over 1e6 bits in a megabit.
  return { mbps: (bytes * 8) / ms / 1000, clips: good.length }
}

// "2.1 Mbps", "35 Mbps". Tenths while the figure is small, because the
// difference between 1 and 2 is the whole story at the speed the design
// assumed; whole numbers once it is large, where a decimal is noise.
export function formatMbps(mbps) {
  if (!Number.isFinite(mbps) || mbps <= 0) return ''
  return mbps >= 10 ? `${Math.round(mbps)} Mbps` : `${mbps.toFixed(1)} Mbps`
}

export function loadSamples(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SPEED_KEY) ?? 'null')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSample).map(({ bytes, ms }) => ({ bytes, ms })).slice(-WINDOW)
  } catch {
    return []
  }
}

export function saveSamples(samples, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SPEED_KEY, JSON.stringify(samples))
  } catch {
    // Private window or a full quota. The figure is a convenience; the next
    // clip's sample builds it again.
  }
}
