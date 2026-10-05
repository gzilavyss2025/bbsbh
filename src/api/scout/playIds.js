// Matchup Scout, film for a past meeting (#1490): the playId of each pitch in
// one game, so the pitch modal can play its clip the way the Express Lane does.
//
// WHY A SECOND SOURCE. Savant's pitch-level CSV (headToHead.js) has no playId.
// The statsapi play-by-play has one per pitch, and the two line up by rule,
// verified on gamePk 776222 (all 12 pitches of Pivetta vs Chourio matched):
//   Savant at_bat_number = allPlays[].about.atBatIndex + 1
//   Savant pitch_number  = the nth event with `isPitch` in that play
//
// THE REQUEST asks the play-by-play for four field names and nothing else
// (`fields=`), so the answer holds atBatIndex, isPitch and playId: about
// 31 KB for a nine-inning game, against ~960 KB for feed/live. No score, no
// result, no count and no text reaches the browser through this module.
//
// SPOILER CLASSIFICATION: cutoff-gated (spoiler-manifest.json). The game is a
// past one the head-to-head already listed, so it is before the cutoff, and
// the fetch refuses any game dated on or after it (or on or after the baseball
// today), so no caller can point it at a live game. The clip it leads to
// (expresslane/clipIndex.js) has a scorebug in its pixels: on this open page
// that is a past game's score (ADR-0034, ADR-0095), and the cutoff keeps
// tonight's game out.
//
// ONE REQUEST PER GAME, made only when a pitch modal opens, and memoized (the
// request, not only its result, staticJson.js's reason). A failure is not
// cached and resolves to null: the modal shows the pitch with no film.

import { getJson } from '../statsapi.js'
import { isRealDate } from '../../lib/dates.js'
import { baseballToday } from '../../lib/time/standingsDates.js'

export const PLAY_ID_FIELDS = 'allPlays,about,atBatIndex,playEvents,isPitch,playId'

// The play-by-play response -> Map(Savant at_bat_number -> [playId of pitch
// 1, pitch 2, ...]). A pitch with no playId keeps its slot as null, so the
// nth pitch stays the nth.
export function playIdsFrom(json) {
  const out = new Map()
  for (const play of json?.allPlays ?? []) {
    const idx = play?.about?.atBatIndex ?? play?.atBatIndex
    if (!Number.isInteger(idx)) continue
    out.set(idx + 1, (play.playEvents ?? []).filter((e) => e?.isPitch).map((e) => e.playId ?? null))
  }
  return out
}

// One pitch's playId, or null: `atBat` is Savant's at_bat_number, `n` its
// pitch_number.
export const playIdFor = (ids, atBat, n) => ids?.get(atBat)?.[n - 1] ?? null

// True when a game on `date` may be read under `cutoff`: strictly before it,
// and strictly before the baseball today.
export function mayRead(date, cutoff, today = baseballToday()) {
  if (!isRealDate(date) || !isRealDate(cutoff)) return false
  return date < cutoff && date < today
}

const cache = new Map()

export async function fetchPlayIds(gamePk, date, cutoff, { get = getJson } = {}) {
  if (!gamePk || !mayRead(date, cutoff)) return null
  const hit = cache.get(gamePk)
  if (hit) return hit
  const pending = get(`/api/v1/game/${gamePk}/playByPlay?fields=${PLAY_ID_FIELDS}`)
    .then(playIdsFrom)
    .catch((err) => {
      console.error('scout play ids:', err)
      return null
    })
  cache.set(gamePk, pending)
  const ids = await pending
  if (!ids) cache.delete(gamePk)
  return ids
}
