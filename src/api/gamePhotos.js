// High-res photos for a single game, from the same content-package endpoint
// highlights.js uses for video (`/api/v1/game/{gamePk}/content`). MLB serves
// every editorial photo through img.mlbstatic.com with Cloudinary-style resize
// instructions baked into the URL path (`.../upload/w_1920,h_1080,.../mlb/{id}.jpg`);
// stripping everything between `upload/` and the trailing `mlb/{id}` segment
// returns the original photographer upload (verified live: full-res originals
// run 6,000-8,000+ px wide, CORS-open, no auth). Thumbnails for the grid use
// the same trick in reverse — a bare `w_{n}` param inserted back in (verified
// live; MLB's own named transforms like `t_w2208` are NOT freely
// parameterizable, e.g. `t_w480` 400s).
//
// Deliberately NOT gated by the spoiler rule (SEE root CLAUDE.md) — a recap or
// celebration photo narrates the outcome just by looking at it, same as a
// highlight clip's title, but there is no reveal-only wrapper here. This is a
// standalone, unsealed personal tool (route.js's '/photos'), not part of the
// scored-game flow, and its page carries its own disclaimer.
import { getJson } from './statsapi.js'

const CDN_PREFIX = 'https://img.mlbstatic.com/mlb-images/image/upload/'
// Matches any mlbstatic upload URL, capturing the trailing `mlb/{id}[.ext]`
// segment that survives every resize transform — that segment is the stable
// photo identity Cloudinary uses to key the original file.
const UPLOAD_RE = /^https:\/\/img\.mlbstatic\.com\/mlb-images\/image\/upload\/.*(mlb\/[^/?#]+)$/

// Strip the resize/crop transform segment from an mlbstatic CDN URL, e.g.
// `.../upload/t_16x9/t_w2208/mlb/xxxx.jpg` -> `.../upload/mlb/xxxx.jpg`. Null
// for anything that isn't a real mlbstatic upload URL (the content feed also
// carries an unresolved `{formatInstructions}` template string some places,
// which this rejects since it has no `mlb/` id segment of its own — it's
// literally the word `{formatInstructions}` in the path).
function originalPhotoUrl(url) {
  const m = UPLOAD_RE.exec(url ?? '')
  if (!m) return null
  let id = m[1]
  if (id.includes('{')) return null
  if (!/\.[a-z]{3,4}$/i.test(id)) id = `${id}.jpg` // template rows carry no extension
  return `${CDN_PREFIX}${id}`
}

// A resized preview for the grid — same CDN, same photo id, just a modest
// width so the page doesn't pull down 41 originals at 6-12MB apiece just to
// render thumbnails.
function thumbUrl(original, width = 480) {
  return original.replace(`${CDN_PREFIX}`, `${CDN_PREFIX}w_${width}/`)
}

// Recursively walk the content feed for every mlbstatic photo URL, deduping
// by photo id (the feed repeats each photo many times over — once per crop/
// density variant the site itself might use).
function collectPhotoUrls(node, seen) {
  if (node == null) return
  if (typeof node === 'string') {
    const original = originalPhotoUrl(node)
    if (original) seen.set(original.slice(CDN_PREFIX.length), original)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) collectPhotoUrls(item, seen)
    return
  }
  if (typeof node === 'object') {
    for (const value of Object.values(node)) collectPhotoUrls(value, seen)
  }
}

// Every distinct high-res photo MLB's content package carries for a game —
// recap art, article hero images, gallery photos — as
// `{ id, original, thumb }`. Degrades to [] on failure or a game with no
// editorial content package yet (common for a game that just started, or most
// MiLB games).
export async function fetchGamePhotos(gamePk) {
  try {
    const data = await getJson(`/api/v1/game/${gamePk}/content`)
    const seen = new Map()
    collectPhotoUrls(data, seen)
    return [...seen.entries()].map(([id, original]) => ({
      id,
      original,
      thumb: thumbUrl(original),
    }))
  } catch {
    return []
  }
}
