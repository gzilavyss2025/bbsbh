// The reader behind the ABS card on a postseason series page (#1769): one
// record a player over the games of ONE series, from the static file
// scripts/gen-abs-challenges.mjs writes (abs-challenges-post-games.json, one
// entry a postseason game, roles already added per player).
//
// SPOILER-FREE. A challenge record is a ball-strike judgment, not a score. The
// card counts only games Final BEFORE the page's cutoff date, the rule the rest
// of the page keeps (ADR-0034, ADR-0087), so it can show nothing from a game
// the viewer has not reached. No SealBox. Its sibling absChallenges.js reads the
// season boards from the same store.
//
// THE FILE SHIPS FACTS; THE SERIES, THE CUTOFF AND THE ORDER ARE CUT HERE.

import { seasonStaticJson } from '../staticJson.js'

// `strict`: an old series must not fall back to the current season's file.
const load = seasonStaticJson('abs', 'abs-challenges-post-games.json')
export const fetchAbsSeriesGames = (seasonYear) => load({ seasonYear, strict: true })

// Baseball style, as teamRecords' pct: .750, and 1.000 at the top.
export const fmtWinPct = (r) => (r >= 1 ? '1.000' : r.toFixed(3).replace(/^0/, ''))

// -> [{ playerId, name, teamId, wins, losses, n, rate }], best first.
//
//   file     the parsed file, or null (no file for that season)
//   gamePks  the series' own games; matching on these, not on club ids alone,
//            keeps an earlier series between the same clubs out
//   clubIds  the two clubs; a player of any other club is dropped
//   cutoff   'YYYY-MM-DD', the page's cutoff; a game dated on or after it does
//            not count. Null counts every game in `gamePks`.
//
// NO MINIMUM-SAMPLE FLOOR (MIN_PLAYER_CHALLENGES in absChallenges.js is for the
// season boards): a series is a handful of games, and a floor would hide every
// row. Sort: win % descending, then more challenges, then name.
export function seriesAbsRows(file, { gamePks, clubIds, cutoff = null }) {
  const pks = new Set(gamePks)
  const clubs = new Set(clubIds)
  const byPlayer = new Map()
  for (const g of file?.games ?? []) {
    if (!pks.has(g.gamePk) || (cutoff != null && g.date >= cutoff)) continue
    for (const p of g.players ?? []) {
      if (!clubs.has(p.teamId) || !(p.n > 0)) continue
      const t = byPlayer.get(p.playerId) ?? { playerId: p.playerId, name: p.name, teamId: p.teamId, n: 0, wins: 0 }
      t.n += p.n
      t.wins += p.success
      byPlayer.set(p.playerId, t)
    }
  }
  return [...byPlayer.values()]
    .map(({ wins, n, ...t }) => ({ ...t, wins, losses: n - wins, n, rate: wins / n }))
    .sort((a, b) => b.rate - a.rate || b.n - a.n || a.name.localeCompare(b.name))
}
