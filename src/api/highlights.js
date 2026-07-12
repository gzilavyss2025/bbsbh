// Video highlight clips for a game, joined to specific plays.
//
// Two endpoints, joined by a GUID: `content`'s highlight items carry a `guid`
// that is identical to the terminal pitch event's `playId` in `feed/live` for
// the same play (verified live 2026-07-12, gamePk 823357 — holds for both
// batted-ball plays and strikeouts; see .scratch/video-highlights/issues/01-
// highlights-bottom-sheet.md §2).
//
// A clip's title/description narrate the outcome ("Jake Bauers' two-run home
// run"), so this is score-revealing like linescore.js/derive.js. Fetching is
// safe to do eagerly (nothing here enters the DOM yet), but the RESULT must
// only be looked up and rendered from inside an already-revealed play — never
// render a clip's title, description, or a poster/thumbnail before that.
import { getJson } from './statsapi.js'

export async function fetchHighlights(gamePk) {
  try {
    const data = await getJson(`/api/v1/game/${gamePk}/content`)
    const items = data?.highlights?.highlights?.items
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}

// guid (content) === playId (feed/live playEvents[]) for the same play — the
// only reliable join key. Pure and cheap; safe to memoize outside the seal
// (it produces no DOM), but the map it returns must only be READ from inside
// a revealed play's render.
export function highlightsByPlayId(items) {
  const map = new Map()
  for (const item of items ?? []) {
    if (item?.guid) map.set(item.guid, item)
  }
  return map
}

// The best playable source for a clip: prefer the HLS stream (native support
// in Safari on iPhone, this app's primary target — see CLAUDE.md), fall back
// to the standard MP4 for any other engine. Returns { hls, mp4 } with either
// possibly null if that playback name wasn't present.
export function highlightPlaybacks(item) {
  const playbacks = item?.playbacks ?? []
  const hls =
    playbacks.find((p) => p.name === 'hlsCloud')?.url ??
    playbacks.find((p) => p.name === 'HTTP_CLOUD_WIRED')?.url ??
    null
  const mp4 = playbacks.find((p) => p.name === 'mp4Avc')?.url ?? null
  return { hls, mp4 }
}
