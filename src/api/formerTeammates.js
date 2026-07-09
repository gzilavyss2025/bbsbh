// The lineup page's FORMER TEAMMATES card data — for each upcoming MLB matchup,
// the pairs of players on the two OPPOSING clubs who were once teammates (majors
// or minors) — read from a static same-origin file (public/data/former-teammates.json)
// rather than computed live.
//
// Building it is expensive and can't be done spoiler-cheaply on a page load:
// reducing each player's career to its (teamId, season) set needs year-by-year
// stats across MLB and every MiLB level (one request per level), so a single
// matchup is hundreds of requests. Past-season career history is immutable, so
// scripts/gen-former-teammates.mjs precomputes it on a cron (see
// .github/workflows/update-former-teammates.yml) and this module just reads it.
// Same build-time-fetch pattern as war.js / rehab.js (see docs/data-enrichment.md
// §5). Rosters and team-season history carry no score, so the file is
// spoiler-free like the rest of the lineup-page surfaces.
//
// Degrades to an empty map before the file exists or on any failure — the card
// simply doesn't render. Cached in-memory for the session since the file only
// changes once a day.
let cached = null

export async function loadFormerTeammates() {
  if (cached) return cached
  try {
    const res = await fetch('/data/former-teammates.json')
    if (!res.ok) throw new Error(`former-teammates.json ${res.status}`)
    const data = await res.json()
    cached = { matchups: data.matchups ?? {}, generatedAt: data.generatedAt ?? null }
  } catch {
    cached = { matchups: {}, generatedAt: null }
  }
  return cached
}

// The former-teammate ties for a matchup, as one card per PAIR of players (one
// from each club) — order-independent (`teamIdA`/`teamIdB` in either order
// return the same list), so a shared matchup renders identically no matter
// which side's page asks for it. That symmetry is what keeps the wide spread
// layout (both clubs' pages open at once) from showing the same tie twice
// under two different framings — see TeamInfo.jsx's single, full-width card
// grid.
//
// Returns [] when the matchup isn't in the file (MiLB game, or outside the
// build's day window). Each entry:
//   { a: {id, name}, b: {id, name},                      // the two players
//     clubs: [{teamId, teamName, level, seasons:[…]}] }   // shared club(s)
export function formerTeammatePairs(data, teamIdA, teamIdB) {
  if (!teamIdA || !teamIdB) return []
  const key = teamIdA < teamIdB ? `${teamIdA}-${teamIdB}` : `${teamIdB}-${teamIdA}`
  const entry = data?.matchups?.[key]
  const rows = entry?.rows
  if (!Array.isArray(rows)) return []

  // Defensive de-dupe: the generator already emits one row per unique pair,
  // but a pair key guards against the file ever carrying a duplicate.
  const seen = new Set()
  const pairs = []
  for (const row of rows) {
    if (!row.a?.id || !row.b?.id) continue
    const pairKey = row.a.id < row.b.id ? `${row.a.id}-${row.b.id}` : `${row.b.id}-${row.a.id}`
    if (seen.has(pairKey)) continue
    seen.add(pairKey)
    const clubs = [...(row.shared ?? [])].sort(
      (x, y) =>
        LEVEL_RANK(y.level) - LEVEL_RANK(x.level) ||
        Math.max(...y.seasons) - Math.max(...x.seasons),
    )
    const headline = clubs[0]
    pairs.push({
      a: row.a,
      b: row.b,
      clubs,
      top: {
        level: headline?.level ?? '',
        season: headline ? Math.max(...headline.seasons) : 0,
      },
    })
  }

  // Most significant ties first: highest shared level, then most recent.
  return pairs.sort(
    (x, y) => LEVEL_RANK(y.top.level) - LEVEL_RANK(x.top.level) || y.top.season - x.top.season,
  )
}

const LEVEL_ORDER = { MLB: 5, AAA: 4, AA: 3, 'A+': 2, A: 1 }
const LEVEL_RANK = (label) => LEVEL_ORDER[label] ?? 0
