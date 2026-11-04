// EXPRESS LANE, TIER 2 — the clip URL resolver.
//
// Resolves one `playId` to its playable mp4 URL (`resolveClipUrl`) and parses
// Savant's page for it (`parseSportyVideoHtml`).
//
// SPOILER-FREE, and that is a positive statement rather than a missing gate.
// Nothing here reads a score, a count, an out or a play. There is no prose:
// no clip title, no blurb, no result. Every value is a URL or a
// null, and a URL is built from a `playId` the app already holds. So this
// module is safe at render top-level, on any surface — unlike runners.js beside
// it, which is reveal-only.
//
// A CAUTION FOR ITS CALLERS, which this module cannot enforce:
// NEVER PRINT A GAME-WIDE CLIP TOTAL. "Pitch 47 of 333" states how long
//      the game ran, which states whether it went to extra innings — straight
//      against ADR-0008. Show position within the current half only, and keep
//      the same rule on any staging or progress indicator.
//
// THE PLAYABLE MP4 COMES FROM SAVANT, AND ONLY FROM SAVANT.
// `https://baseballsavant.mlb.com/sporty-videos?playId={playId}` returns HTML
// that carries a `sporty-clips.mlb.com/{opaque}.mp4` URL. It is ungated
// (`access-control-allow-origin: *`), cheap (~10.3 KB gzipped, ~0.12 s),
// cached, and DETERMINISTIC — three calls for one playId returned an
// identical URL — so the answer is worth memoizing and worth persisting.
//
// DO NOT USE `fastball-clips.mlb.com/{gamePk}/{home|away}/{playId}.mp4`. It is
// derivable, and it is byte-for-byte the same asset, and it is unusable: it is
// Referer-locked to mlb.com. From this origin a `<video>` gives
// MEDIA_ERR_SRC_NOT_SUPPORTED. It is not written anywhere in this file on
// purpose.
//
// NETWORK DISCIPLINE, WHICH IS NOT OPTIONAL. `sporty-clips.mlb.com` — the host
// that serves the BYTES, which this module never fetches — blocks automated
// access. It began returning empty bodies and then a hard 403 after roughly 25
// requests in a few minutes. So nothing here ever bursts: `resolveClipUrl`
// makes ONE request for ONE playId on demand. Do not
// add a parallel prefetcher, in this file or above it.
//
// DEGRADES, NEVER THROWS. Clips publish 8 to 26 minutes after the pitch, so a
// just-played at-bat has a `playId` and no clip. A lookup that fails, 404s or
// has not published yet resolves to null, which a caller renders as
// "not posted yet" — the same convention every MiLB surface in this app uses.
// There are no clips at all before 2016, none for MiLB (sportIds 11-14,
// verified zero), and none for All-Star or exhibition games (`gameType: "A"`).
// Each of those is the same null, reached by the same path.

const SAVANT_LOOKUP = 'https://baseballsavant.mlb.com/sporty-videos?playId='
const DEFAULT_TIMEOUT_MS = 10_000

// The mp4 the Savant page points at. Matched by host and extension rather than
// by the markup around it, so a template change on their side does not break
// the parse. First match wins; the page carries one clip.
const SPORTY_MP4 = /https:\/\/sporty-clips\.mlb\.com\/[^"'\s<>\\]+\.mp4/

// Pull the playable mp4 URL out of a `sporty-videos` response body. Pure, so
// the parse is testable with no network at all. Returns null for an empty
// body, an error page, or a play with no clip.
export function parseSportyVideoHtml(html) {
  const match = SPORTY_MP4.exec(String(html ?? ''))
  if (!match) return null
  // The URL sits in an HTML attribute, so an ampersand may arrive escaped.
  return match[0].replace(/&amp;/g, '&')
}

// playId -> in-flight or resolved lookup. This memoizes the REQUEST, not only
// its result, for the reason staticJson.js gives: a page mounts its cards on
// one tick, so a cache assigned after the `await` lets every caller that
// started before the first resolved fire its own copy.
//
// A MISS IS NOT CACHED. A clip that has not published yet resolves to null and
// the entry is dropped, so the same playId asked again 20 minutes later makes
// a fresh request. Caching the miss would seal a game against its own film for
// the length of the session.
const clipUrlCache = new Map()

// THE SHARED RESOLVER. One playId in, one playable mp4 URL out, or null.
//
// This is the single place in the app that turns a `playId` into a clip URL.
// Import it; do not write a second one. `fetchImpl` is injectable so a test —
// or another feature's test — can drive it with a fake, and so nothing here
// needs a live network.
//
// Never throws. A refusal, a timeout, an abort and a play with no clip all
// return null, which is the "not posted yet" answer.
export async function resolveClipUrl(
  playId,
  { fetchImpl = null, signal = null, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
) {
  if (!playId || signal?.aborted) return null
  const cached = clipUrlCache.get(playId)
  if (cached) return cached

  const doFetch = fetchImpl ?? ((...args) => globalThis.fetch(...args))
  const pending = (async () => {
    const controller = new AbortController()
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) controller.abort()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await doFetch(`${SAVANT_LOOKUP}${encodeURIComponent(playId)}`, {
        credentials: 'omit',
        signal: controller.signal,
      })
      if (!res?.ok) return null
      return parseSportyVideoHtml(await res.text())
    } catch {
      return null
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  })()

  clipUrlCache.set(playId, pending)
  const url = await pending
  // Keep the hit, drop the miss. See the cache's own note above.
  if (!url) clipUrlCache.delete(playId)
  return url
}
