import { realHeadshotUrl } from './teams.js'

// Warms the browser's HTTP cache — and, via vite.config.js's CacheFirst rule
// for img.mlbstatic.com, the service worker's own cache — for a batch of
// player headshots before anything on screen actually needs them. Built for
// InningViewer: the same handful of faces (both lineups, both pitching staffs)
// recur across every AtBatCard as a half is stepped through one at-bat at a
// time, so warming them up front means the second, third, and every later
// appearance of a face paints from cache instead of a fresh network fetch.
//
// Fire-and-forget by design. A prefetch that 404s or never finishes changes
// nothing: Headshot.jsx/PitcherPhoto still issue their own on-demand <img>
// fetch and fall back through their normal rung chain regardless of whether
// this warmed anything, so there's no result here to await, retry, or report.
//
// `width` matches realHeadshotUrl's own default so the warmed URL is the
// SAME one every headshot rung in the app actually requests — a mismatched
// width would warm a URL nothing on screen ever asks for.
export function prefetchHeadshots(ids, width = 320) {
  for (const id of ids) {
    const url = realHeadshotUrl(id, width)
    if (!url) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}
