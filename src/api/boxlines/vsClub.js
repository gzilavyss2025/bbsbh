// BOX LINES — the club facet, by its original name. The fetch itself moved to
// fetch.js when #997 generalised it to every facet; this file stays as the
// one call the lineup page's Starting pitcher card and the player page's
// Splits vs team card already make, so neither had to change to gain a
// framework neither of them uses.
//
// Keep it thin. A caller that wants any OTHER facet imports `fetchBoxLines`
// from fetch.js directly rather than growing a second wrapper here.
//
// Class: cutoff-gated (spoiler-manifest.json), inherited whole from fetch.js
// and rows.js — this file computes nothing.
import { fetchBoxLines } from './fetch.js'

// The rows for one player against one club, or null when the fetch failed.
// `cutoff` is YYYY-MM-DD or null; `group` is 'pitching' | 'hitting'.
export function fetchBoxLinesVsClub({ personId, group, opponentId, cutoff = null }) {
  return fetchBoxLines({ personId, group, cutoff, facet: { kind: 'club', opponentId } })
}
