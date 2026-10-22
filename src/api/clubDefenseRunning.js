// Club defense and running, for the World Series scouting report's "Glove and
// legs" card: six season measures per club (outs above average, catcher framing
// runs, sprint speed, stolen bases, stolen-base success, extra bases taken).
// Read from a static same-origin file (public/data/club-defense-running.json).
//
// scripts/gen-club-defense-running.mjs builds it nightly. A measure with no
// source is null, never 0.
//
// NO SCORE DATA HERE. Regular-season totals for a club: the same footing
// as Standings and League Leaders, open live since ADR-0034. No game, no score.
//
// Degrades to an empty file before it exists or on any failure.

import { staticJson } from './staticJson.js'

// The object a failed read returns: `data === CLUB_DEFENSE_FALLBACK` means the file did not load.
export const CLUB_DEFENSE_FALLBACK = { generatedAt: null, season: null, asOf: null, clubs: {} }

export const loadClubDefenseRunning = staticJson('/data/club-defense-running.json', {
  shape: (d) => ({
    generatedAt: d.generatedAt ?? null,
    season: d.season ?? null,
    asOf: d.asOf ?? null,
    clubs: d.clubs ?? {},
  }),
  fallback: CLUB_DEFENSE_FALLBACK,
})

// The two clubs' rows, in the order asked, or null when either has none.
export function clubsFor(data, idA, idB) {
  const a = data?.clubs?.[idA]
  const b = data?.clubs?.[idB]
  return a && b ? [a, b] : null
}
