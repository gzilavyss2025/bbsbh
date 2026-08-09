// What each club actually wore in a given game, read from a static
// same-origin file (public/data/jerseys.json) rather than the live uniforms
// endpoint. That file is regenerated nightly by scripts/gen-jerseys.mjs (see
// .github/workflows/update-nightly-data.yml) — this module just reads it.
// Keyed `${gamePk}:${teamId}` -> 'main' | 'alternate' | 'alternate-2' |
// 'alternate-3' | 'city-connect'; only a game whose assignment hasn't posted
// yet has no key — a confirmed standard jersey is stored as 'main' rather
// than omitted, so it can override GameCard's predictive
// `defaultTreatmentFor` guess (teams.js) once the real assignment is known.
// Degrades to an empty object before the file exists or on any fetch
// failure — a missed logo swap, never a broken page. Cached in-memory for
// the session since the file only changes once a day.
//
// staticJson memoizes the REQUEST, not just its result: GameCard calls this
// once per card on the home slate, all on the same mount tick, and a cache
// assigned after the await only short-circuits a call that starts once the
// first has resolved. This file found that first; staticJson.js is that fix
// for every reader.

import { staticJson } from './staticJson.js'

export const fetchJerseysData = staticJson('/data/jerseys.json', { fallback: {} })

// 'main' | 'alternate' | 'alternate-2' | 'alternate-3' | 'city-connect' | null
// — null covers an unposted assignment and a missing/failed fetch alike, so
// callers can treat it as "no confirmed data yet, fall back to a guess"
// without distinguishing why.
export function jerseyTreatmentFor(data, gamePk, teamId) {
  if (!gamePk || !teamId) return null
  return data?.[`${gamePk}:${teamId}`] ?? null
}

// The most recent games in which `teamId` actually wore `treatment`, as
// `[{ gamePk, apiDate }]` newest-first — the join between this file's
// gamePk-keyed assignments (which carry no date) and a team schedule (which
// carries no jersey). Nothing else in the app knows both halves.
//
// Behind the Team Identity Lab's "see what this actually looked like" links:
// each date opens that game's photo gallery (`/photos/{gamePk}`), which is how
// you check a curated tile against a real photograph of the uniform instead of
// trusting the swatch. Capped because the point is a glance at a handful of
// recent looks, not an archive — a club can wear one jersey 50+ times a season.
//
// Pure, so it is unit-testable and can't smuggle a fetch into a render. Takes
// whatever `fetchTeamSchedule` returns and reads only `gamePk`/`apiDate` off
// it; the schedule's own `won` field is deliberately untouched — a wear date is
// a uniform fact, and nothing here needs to know how the game went.
export function jerseyWearDates(data, schedule, teamId, treatment, limit = 10) {
  if (!data || !teamId || !treatment) return []
  return (schedule ?? [])
    .filter((g) => g.gamePk && g.apiDate && jerseyTreatmentFor(data, g.gamePk, teamId) === treatment)
    .sort((a, b) => (a.apiDate < b.apiDate ? 1 : a.apiDate > b.apiDate ? -1 : b.gamePk - a.gamePk))
    .slice(0, limit)
    .map((g) => ({ gamePk: g.gamePk, apiDate: g.apiDate }))
}
