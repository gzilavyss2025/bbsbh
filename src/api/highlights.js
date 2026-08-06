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

// ---------------------------------------------------------------------------
// Classification (the highlights CASCADE — team/player rails, not the per-play
// join above). See .scratch/highlights-cascade/PRD.md + issues/01-data-layer.md.
//
// NOT reveal-only, unlike everything above. These are plain data transforms
// over the same raw `content` items: they run inside a Node generator with no
// DOM at all (scripts/gen-highlights.mjs), and the rails that read the
// generator's output only ever show DECIDED games. Nothing here renders, and
// nothing here reads a score.
//
// Field names verified live 2026-08-06 against 1,150 clips over 41 Final MLB
// games (2026-07-28..30) plus gamePks 823035/777747/824087/778501: keywordsAll
// entries are `{ type, value, displayName }`, and the three types that matter
// are the literal strings `player_id`, `team_id` and `taxonomy`.
// ---------------------------------------------------------------------------

// Whichever of these a clip carries, in priority order (first match wins) —
// MLB's own "this one mattered" markers. `highlight-reel-` is a FAMILY, not one
// tag: the live values are -offense, -pitching, -starting-pitching,
// -relief-pitching and -team, so it's matched by prefix rather than by a guessed
// suffix. Most clips carry none of these; absence is normal, not a data gap.
export const SIGNIFICANCE_TAGS = [
  'wow',
  'top-play',
  'featured',
  'player-of-the-game',
  'star-of-the-game',
  'clutch-moment',
  'highlight-reel-',
  'career-first',
  'season-first',
  'milestone',
  'mlb-debut',
  'gold-glove-award',
]
const REEL = 'highlight-reel-'

// The highest-priority significance tag a clip actually carries, or null. The
// reel family resolves to the REAL tag it matched (`highlight-reel-offense`),
// never the `highlight-reel-` prefix marker that stands in for it in the
// priority list above.
function significanceOf(taxonomy) {
  for (const tag of SIGNIFICANCE_TAGS) {
    if (tag === REEL) {
      const reel = taxonomy.find((v) => v.startsWith(REEL))
      if (reel) return reel
    } else if (taxonomy.includes(tag)) {
      return tag
    }
  }
  return null
}

// A per-play clip's classification, derived from keywordsAll. Locked schema —
// see .scratch/highlights-cascade/PRD.md ("Locked schema").
//
// `clipId` is the stable identity, and it is deliberately NOT `guid`: 54% of
// content items carry no guid at all (531 of 1,150 in the live sweep), and that
// includes real highlights ("Kyle Manzardo slugs a grand slam", "Gavin Williams
// strikes out 12"). `id` — a readable slug, e.g. `joey-ortiz-homers-3-on-a-fly-
// ball` — is present on 100% of items and was unique across the whole sweep, so
// it is the fallback. `guid` still rides along untouched: it is the join key for
// the box score's per-play button (highlightsByPlayId above), which simply
// doesn't fire for a clip that has none.
export function classifyHighlight(item) {
  const kw = item?.keywordsAll ?? []
  const find = (type) => kw.find((k) => k.type === type)?.value ?? null
  const taxonomy = kw.filter((k) => k.type === 'taxonomy').map((k) => k.value)
  const playerId = find('player_id')
  const teamId = find('team_id')
  const guid = item?.guid ?? null
  return {
    guid,
    clipId: guid ?? item?.id ?? null,
    playerId: playerId ? Number(playerId) : null,
    teamId: teamId ? Number(teamId) : null,
    category: taxonomy.find((t) => ['hitting', 'pitching', 'defense'].includes(t)) ?? null,
    significance: significanceOf(taxonomy),
    taxonomy,
  }
}

// Taxonomy tags that mark an item as NOT a per-play action highlight.
//
// The `content` endpoint returns one flat `highlights.highlights.items` array
// per game that mixes real clips with everything else MLB produced around the
// game — and roughly half of it is the "everything else". Two groups here:
//
//   1. abs / challenge — LOCKED BY THE PRD. The team_id sign is unreliable for
//      these: they're tagged by whose plate appearance or pitch it was, not by
//      who benefited, and won-vs-lost only exists as English prose in the
//      headline. Never parse the headline to recover it.
//   2. Everything else — the content-type gate. Verified present in a single
//      3-day live window: 87 interviews, 62 manager pressers, 41 recaps, 41
//      condensed games, 66 Data Viz cards, 17 "Field View" angles, 9 INJURY
//      clips ("Jose Franco leaves game with right elbow discomfort") and an
//      EJECTION. The PRD called injuries and ejections an unverified blind
//      spot with no override mechanism; they are in fact routine, so they're
//      excluded by rule here rather than left to the hand-maintained blocklist,
//      which would need a new entry every night forever.
export const NON_PLAY_TAXONOMY = new Set([
  // 1. Locked by the PRD — sign is unrecoverable.
  'abs',
  'challenge',
  // 2. Not a play: talking, packaging, analysis, ceremony, misfortune.
  'interview',
  'player-postgame',
  'manager-postgame',
  'press-conference',
  'game-recap',
  'condensed-game',
  'team-featured',
  'data-visualization',
  'in-game-data-visualization',
  'analysis',
  'exclusive-angle',
  'cut-4',
  'fan-catches',
  'injury',
  'ejection',
  'rumors',
  'trades',
  'transactions',
  'tribute',
  'ceremonial-first-pitch',
  'baseball-hall-of-fame',
  'baseball-hall-of-fame-induction',
  'bobbleheads',
  'weather',
  'style',
])

// Is this clip eligible for the positive-highlights filter? A positive gate
// (MLB's own `highlight` tag) plus the exclusion set above. Apply BEFORE any
// teamId/playerId filtering, never after.
//
// The positive gate alone is not enough — 845 of 1,150 items carried
// `highlight`, interviews and injury exits among them. Requiring a
// hitting/pitching/defense CATEGORY instead is not enough either, in the other
// direction: MLB tags one inconsistently, so that would drop "Gavin Williams
// strikes out 12 against Reds" and "Ivan Johnson earns his first MLB hit". Gate
// plus exclusions keeps ~14.6 clips per game, which is the real highlight reel.
export function isEligibleForPositiveFilter(classified) {
  const taxonomy = classified?.taxonomy ?? []
  if (!taxonomy.includes('highlight')) return false
  return !taxonomy.some((t) => NON_PLAY_TAXONOMY.has(t))
}

// The best playable source for a clip: prefer the HLS stream (native support
// in Safari on iPhone, this app's primary target — see CLAUDE.md), fall back
// to the standard MP4 for any other engine. Returns { hls, mp4 } with either
// possibly null if that playback name wasn't present.
//
// Accepts either shape: the raw MLB `content` item (`playbacks` is an array of
// `{name, url}`, resolved here) or an already-resolved `{hls, mp4}` object —
// which is exactly what a highlights-cascade team file stores per clip
// (`scripts/lib/highlights.mjs` calls this function once at generation time
// and writes the result). `HighlightSheet.jsx` calls this on whatever `item`
// its caller hands it, so both the box score's raw per-play item and a
// team/player rail's precomputed clip need to resolve correctly here without
// the rails re-deriving playback URLs themselves.
export function highlightPlaybacks(item) {
  const playbacks = item?.playbacks
  if (playbacks && !Array.isArray(playbacks)) return { hls: playbacks.hls ?? null, mp4: playbacks.mp4 ?? null }
  const list = playbacks ?? []
  const hls =
    list.find((p) => p.name === 'hlsCloud')?.url ??
    list.find((p) => p.name === 'HTTP_CLOUD_WIRED')?.url ??
    null
  const mp4 = list.find((p) => p.name === 'mp4Avc')?.url ?? null
  return { hls, mp4 }
}

// A clip's poster frame, at the smallest 16:9 cut at least `minWidth` wide (MLB
// ships the same still at ~20 widths from 4096 down to 124; a rail thumbnail on
// a phone wants neither end). Returns null when the item carries no image.
//
// Spoiler note: a poster is only ever as revealing as the clip it belongs to,
// and both are already gated the same way — inside the seal on an
// already-revealed play in the box score, or on a decided game in the
// team/player rails. See the memory note behind the PRD's box-score decision.
export function highlightPoster(item, minWidth = 640) {
  const cuts = (item?.image?.cuts ?? []).filter((c) => c.aspectRatio === '16:9' && c.src)
  if (!cuts.length) return null
  const wide = cuts.filter((c) => c.width >= minWidth).sort((a, b) => a.width - b.width)
  return (wide[0] ?? cuts.sort((a, b) => b.width - a.width)[0]).src
}
