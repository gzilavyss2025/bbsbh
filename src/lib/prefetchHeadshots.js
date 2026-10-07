import { realHeadshotUrl } from './teams.js'
import { HEADSHOT_CROSS_ORIGIN } from './headshot/retry.js'

// Warms the browser's HTTP cache — and, via vite.config.js's CacheFirst rule
// for img.mlbstatic.com, the service worker's own cache — for a batch of
// player headshots before anything on screen actually needs them. Built for
// InningViewer: the same handful of faces (both lineups, both pitching staffs)
// recur across every AtBatCard as a half is stepped through one at-bat at a
// time, so warming them up front means the second, third, and every later
// appearance of a face paints from cache instead of a fresh network fetch.
//
// Fire-and-forget, with one report: `onFailed(id)` runs for an id whose image
// did not load. The hook un-marks that id so the next feed update warms it
// again (issue #1446). A failed warm-up changes nothing on screen:
// Headshot.jsx/PitcherPhoto still issue their own on-demand <img> fetch.
//
// `width` matches realHeadshotUrl's own default so the warmed URL is the
// SAME one every headshot rung in the app actually requests — a mismatched
// width would warm a URL nothing on screen ever asks for.
// A face with no photo on file fails every time, so an id is warmed again after
// a failure only this many times.
export const MAX_PREFETCH_FAILURES = 3

// The ids still worth warming: not in flight or loaded, not failed too often.
export function headshotsToWarm(ids, warmed, failures) {
  return ids.filter((id) => !warmed.has(id) && (failures.get(id) ?? 0) < MAX_PREFETCH_FAILURES)
}

export function prefetchHeadshots(ids, width = 320, onFailed) {
  for (const id of ids) {
    const url = realHeadshotUrl(id, width)
    if (!url) continue
    const img = new Image()
    img.decoding = 'async'
    // Same CORS mode as the on-screen <img>, so the service worker can cache it.
    img.crossOrigin = HEADSHOT_CROSS_ORIGIN
    if (onFailed) img.onerror = () => onFailed(id)
    img.src = url
  }
}
