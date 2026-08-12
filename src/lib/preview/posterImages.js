// Every image the poster draws, loaded so the finished canvas can be EXPORTED.
//
// THE WHOLE POINT IS `crossOrigin = 'anonymous'`. A canvas that has drawn even
// one image fetched without CORS is tainted forever: toBlob()/toDataURL() throw
// a SecurityError, and the Save button silently has nothing to save. So every
// load here is anonymous-mode, and an image whose host refuses CORS is DROPPED
// rather than drawn — a poster missing a headshot still saves; a tainted one
// cannot be saved at all.
//
// The hosts, and what they answer (verified 2026-08-12 with an Origin header):
//   www.mlbstatic.com    team logos, SVG     access-control-allow-origin: *
//   img.mlbstatic.com    headshots, PNG      access-control-allow-origin: *
//   same-origin          /team-logos/*, /data/logos/mono/*, /ballparks/*
// An owner-uploaded ballpark photo lives in Vercel Blob, a third host — it is
// loaded the same way and drops out on its own if that store's CORS ever
// changes, leaving the bundled photo's slot empty rather than the poster
// unsavable.
//
// SVG NEEDS AN INTRINSIC SIZE. An <img> holding an SVG with only a viewBox
// reports width/height 0 in Chrome, which draws nothing. Every mlbstatic team
// logo carries width/height attributes (checked), and the locally generated
// mono knockouts do too (scripts/gen-mono-logos.mjs); a mark that ever reports
// zero is skipped by the `img.width` guard in posterInk's draw helpers rather
// than painting an invisible nothing.

// One promise per URL for the life of the tab — the poster re-paints on every
// toggle and every data arrival, and re-decoding thirty images each time is
// both slow and visibly flickery.
const cache = new Map()

export function loadPosterImage(src) {
  if (!src) return Promise.resolve(null)
  if (cache.has(src)) return cache.get(src)
  const promise = new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    // Resolving null on error is deliberate: a poster is a composition of
    // optional art, and one 404 (a club with no procured alternate mark, a
    // rookie with no headshot on file) must not reject the whole paint.
    img.onload = () => resolve(img.width && img.height ? img : null)
    img.onerror = () => resolve(null)
    img.src = src
  })
  cache.set(src, promise)
  return promise
}

// Load a map of { key: url } into { key: HTMLImageElement | null }, all at
// once. Keys with no URL resolve to null without a request.
export async function loadPosterImages(sources) {
  const keys = Object.keys(sources)
  const images = await Promise.all(keys.map((k) => loadPosterImage(sources[k])))
  return Object.fromEntries(keys.map((k, i) => [k, images[i]]))
}
