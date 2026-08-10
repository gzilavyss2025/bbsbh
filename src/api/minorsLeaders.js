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

import { staticJson } from './staticJson.js'

export const fetchMinorsLeaders = staticJson('/data/minors-leaders.json', {
  shape: (d) => ({ leaders: d.leaders ?? {}, generatedAt: d.generatedAt ?? null }),
  fallback: { leaders: {}, generatedAt: null },
})
