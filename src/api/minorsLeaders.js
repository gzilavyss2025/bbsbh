// The all-minors combined leaderboard, read from a static same-origin file
// (public/data/minors-leaders.json) rather than assembled live.
//
// Unlike the per-level / org / team leader pools (which fan out a handful of
// roster or club calls on demand), this one board spans every full-season farm
// level league-wide — eight full-level stat pulls and several thousand players
// to combine — far too heavy for a phone page load. So scripts/gen-minors-
// leaders.mjs precomputes it on a daily cron (see
// .github/workflows/update-nightly-data.yml) and this module just reads it.
// Same build-time-fetch pattern as war.js / rehab.js; still spoiler-free (season
// aggregates only).
//
// The file stores PRE-RANKED top rows per category ({ leaders: { catKey:
// entries[] } }, each entry already in computeLeaders' output shape), not the raw
// pool — so ranking (incl. the leader-relative qualifier's playing-time floor) is
// baked in at generate time and the page only renders. Degrades to empty leaders
// before the file exists or on any failure — a friendly empty state, not a broken
// page. Cached in-memory for the session since the file only changes once a day.

import { MILB_LEVELS } from '../lib/teams.js'
import { staticJson } from './staticJson.js'

export const fetchMinorsLeaders = staticJson('/data/minors-leaders.json', {
  // `season` is carried because a caller that names a season on screen has to
  // be able to check that this file is still about it — the generator writes
  // whatever calendar year it runs in, so on January 1 the board rolls to a
  // season that has not been played yet (see movedUpAt below).
  shape: (d) => ({
    leaders: d.leaders ?? {},
    season: Number(d.season) || null,
    generatedAt: d.generatedAt ?? null,
  }),
  fallback: { leaders: {}, season: null, generatedAt: null },
})

// Low to high, ROK through AAA — MILB_LEVELS' own order, so a level's place in
// the climb is never restated here.
const RANK = new Map(MILB_LEVELS.map((level, i) => [level.sportId, i]))

// WHO MOVED UP, at one level — the minor levels' offseason page, issue #1077.
//
// Each entry already carries `levels`: every level the player appeared at this
// season, which is the whole of a promotion written as data. A player whose
// season spans more than one of them climbed; the two ends of that span are
// where he started and where he finished.
//
// It is a fact about a SEASON, not about a game, so it spoils nothing and needs
// no seal — the same reason the reason line on the picked-game card is allowed
// to count careers. It is also, deliberately, no new fetch: the board is on the
// wire once a day whether this page asks for it or not.
//
// WHAT THE POOL IS, and why the surface has to say so. These are the season's
// leaders — the top rows of thirty-nine categories, roughly 500 players out of a
// 5,537-man pool — not every player at the level. So this answers "which of the
// season's leaders moved up", and a caption that promises more than that is
// wrong. Naming the pool is the caller's job; keeping the derivation honest is
// this function's.
//
// Sorted by how far a player climbed, then by where he finished, then by name —
// a total order with no ties, so two readers on the same day see the same list.
export function movedUpAt(leaders, sportId) {
  if (!leaders || !RANK.has(sportId)) return []
  const here = RANK.get(sportId)

  const seen = new Map()
  for (const rows of Object.values(leaders)) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (seen.has(row?.id)) continue
      const levels = (Array.isArray(row?.levels) ? row.levels : []).filter((l) => RANK.has(l))
      if (!levels.includes(sportId)) continue
      const ranks = levels.map((l) => RANK.get(l))
      const from = Math.min(...ranks)
      const to = Math.max(...ranks)
      if (to <= from) continue
      seen.set(row.id, {
        id: row.id,
        name: row.name ?? '',
        position: row.position ?? '',
        // The parent MLB club, not the affiliate the player is listed with —
        // he may have been listed with three of them across the season, and
        // the org is the one thing that did not change.
        org: row.displayTeamAbbr ?? '',
        orgId: row.displayTeamId ?? null,
        from: MILB_LEVELS[from],
        to: MILB_LEVELS[to],
        climbed: to - from,
        // Kept for the caller: a player who climbed PAST this level reads
        // differently from one who climbed INTO it, and both are true here.
        left: to > here,
      })
    }
  }

  return [...seen.values()].sort(
    (a, b) =>
      b.climbed - a.climbed ||
      RANK.get(b.to.sportId) - RANK.get(a.to.sportId) ||
      a.name.localeCompare(b.name),
  )
}
