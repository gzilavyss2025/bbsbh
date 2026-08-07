// Per-team video highlights, read from a static same-origin file
// (public/data/highlights/{teamId}.json) rather than fetched live from MLB.
// Those files are regenerated nightly by scripts/gen-highlights.mjs (see
// .github/workflows/update-nightly-data.yml) — this module just reads them.
// The build-time-fetch pattern, same split as war.js (thin static reader) vs.
// the live fetching elsewhere; see src/api/CLAUDE.md.
//
// Deliberately DUMB. Every filter — the abs/challenge exclusion, the non-play
// content gate, the hand-maintained blocklist — already ran in the generator,
// so a shipped file only ever holds clips that passed all of them and there is
// no policy here to drift out of sync with it. The one thing a caller does on
// top is identity scoping: PlayerHighlightsRail reads its player's CURRENT
// team's file and keeps clips where `playerId` matches. (Consequence, accepted
// for v1: a traded player's pre-trade clips live under his old club and so
// don't surface on his page.)
//
// Not a spoiler surface: files carry DECIDED games only — the generator sweeps
// Final games exclusively, so nothing here describes a game in progress. Each
// game row is self-contained (gamePk, date, clips); there is no team-level
// aggregate that could leak the existence or state of a game not in the file.
//
// MLB only, like the generator — a MiLB teamId simply has no file, which lands
// on the same empty result as a team MLB hasn't clipped. Degrades to an empty
// game list on any failure: no rail, never a broken page.
//
// Cached in-memory per team for the session, since a file only changes once a
// day (mirrors war.js's module-level cache).
const cache = new Map()

export async function fetchTeamHighlights(teamId) {
  if (!teamId) return { games: [] }
  if (cache.has(teamId)) return cache.get(teamId)
  let data
  try {
    const res = await fetch(`/data/highlights/${teamId}.json`)
    if (!res.ok) throw new Error(`highlights/${teamId}.json ${res.status}`)
    data = await res.json()
  } catch {
    data = { games: [] }
  }
  if (!Array.isArray(data.games)) data = { ...data, games: [] }
  cache.set(teamId, data)
  return data
}

// One slate date's condensed games, keyed by gamePk — the poster, runtime,
// playback URLs, and hero photo for every Final MLB game that day, from
// public/data/highlights/day/<MMDDYYYY>.json (written by the same nightly
// sweep as the team files above; see scripts/lib/highlights.mjs's
// writeDayFiles/dayIndexEntry). ~8 KB for a full 16-game slate.
//
// `heroPhoto` (`{ original, thumb } | null`, from gamePhotos.js's
// pickHeroPhoto) is what GameResultFace.jsx shows on the condensed-game card
// INSTEAD of `poster` when present — a real photographer/broadcast still
// rather than MLB's own "CONDENSED GAME" graphic card. It carries no caption
// text on purpose (see pickHeroPhoto's header): this file is fetched whole for
// every game on the date regardless of which ones are revealed yet, so only a
// bare image URL rides along, never anything legible as plain text.
//
// WHY PRECOMPUTED, when the box score fetches the same thing live. Because the
// slate needs ALL of them at once: `content` is 430 KB per game and does not
// honor `?fields=` (measured — byte-identical response), so 16 revealed cards
// asking live would parse ~6.9 MB on a phone. One 8 KB file answers the whole
// day, and because the playback URLs ride along, tapping a card's poster opens
// the video with NO further network at all.
//
// KNOWN LAG, and it is the reason the live path still exists: this file is
// written the night after the games, so TODAY's slate has no file. Callers
// must treat a miss as normal and fall back (the result card drops to
// WatchCondensedButton, which fetches on tap). Same accepted staleness as
// every other precompute here.
//
// Not a spoiler surface, but it is not rendered outside a reveal either: the
// entries carry no score (a condensed cut's title is "Condensed Game: MIL@STL
// - 7/7/26", structural by construction — the RECAP, whose title carries the
// score, is deliberately not in this file), and its one consumer renders only
// on a flip card's already-revealed back face.
//
// Degrades to an empty games map on any failure — no poster, never a broken
// card. Cached in-memory per date, like fetchCallouts.
const dayCache = new Map()

export async function fetchDayVideos(urlDate) {
  if (!urlDate) return { games: {} }
  if (dayCache.has(urlDate)) return dayCache.get(urlDate)
  let result = { games: {} }
  try {
    const res = await fetch(`/data/highlights/day/${urlDate}.json`)
    if (res.ok) {
      const data = await res.json()
      result = { games: data.games ?? {} }
    }
  } catch {
    // leave the empty default — the cards fall back to fetching on tap
  }
  dayCache.set(urlDate, result)
  return result
}

// Flattens a fetchTeamHighlights() result into one chronological (OLDEST
// first) list of clips, each annotated with its game's gamePk/date — shared
// by TeamHighlightsRail and PlayerHighlightsRail, which differ only in which
// clips they keep after this call (the team rail keeps them all;
// PlayerHighlightsRail filters to `clip.playerId === personId`). Oldest-first
// on purpose: both rails anchor to the newest clip on the right edge (PRD's
// "Rail ordering"), so rendering oldest-to-newest lets that anchor land at
// the end of the list with no separate reverse step. `games` rows in the
// source file are newest-first (upsertGame's own sort), so this re-sorts
// rather than assuming the file's order.
export function flattenPositiveClips(data) {
  const games = [...(data?.games ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const out = []
  for (const game of games) {
    for (const clip of game.clips ?? []) out.push({ ...clip, gamePk: game.gamePk, date: game.date })
  }
  return out
}
