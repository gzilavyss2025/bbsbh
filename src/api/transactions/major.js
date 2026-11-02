// MAJOR OR MINOR — whether a wire story is a full card or one line on the
// offseason ledger (OffseasonLead.jsx). Spoiler-free: who moved, never a score.
//
// A story is major when any of these holds:
//   - it is the favorite team's, or names the favorite team (a trade partner)
//   - any player in it is a STAR (scripts/wire/gen-notable-players.mjs: 4+ WAR in
//     one of the last three seasons, or an All-Star or award in the last five)
//   - any player in it is NOTABLE (300+ games, 150+ pitching appearances, a
//     top-100 prospect) AND the move itself is news
// Everything else is a line, including any player the nightly list lacks.
// Measured on four weeks of 2026 moves: 16-20% are major.
//
// News is a trade, a big-league signing, a claim, a release, a DFA or a
// retirement. A minor-league contract is never news on its own.
import { staticJson } from '../staticJson.js'

const NEWS_CODES = new Set(['TR', 'SFA', 'SGN', 'CLW', 'REL', 'DES', 'RET'])
const MINOR_DEAL = /minor league contract/i

// The nightly file's arrays as Sets; a missing or failed file is two empty
// sets, so every move reads as a line rather than throwing.
export function notableLists(data) {
  return { star: new Set(data?.star ?? []), notable: new Set(data?.notable ?? []) }
}

export function isMajorMove(story, { lists, favoriteTeamId }) {
  const segments = story.cutline ?? []
  if (favoriteTeamId != null) {
    if (story.teamId === favoriteTeamId) return true
    if (segments.some((seg) => seg.teamId === favoriteTeamId)) return true
  }
  const ids = new Set([
    ...(story.rail ?? []).map((slot) => slot.playerId),
    ...segments.map((seg) => seg.playerId),
  ])
  ids.delete(undefined)
  ids.delete(null)
  if ([...ids].some((id) => lists.star.has(id))) return true
  const sentence = segments.map((seg) => seg.text).join('')
  const news = (story.codes ?? []).some((code) => NEWS_CODES.has(code)) && !MINOR_DEAL.test(sentence)
  return news && [...ids].some((id) => lists.notable.has(id))
}

// The nightly lists, read once per session (scripts/wire/gen-notable-players.mjs).
export const fetchNotableLists = staticJson('/data/notable-players.json', { shape: notableLists, fallback: notableLists(null) })
