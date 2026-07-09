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

// The former-teammate ties for a matchup, grouped by the OPPOSING player and
// oriented for the side we're rendering (`myTeamId`). One recently-traded player
// ties to many of my current players; grouping by that opponent collapses the
// list to one entry per opposing player, each carrying the specific former
// teammates on my side and the club(s) they shared.
//
// Returns [] when the matchup isn't in the file (MiLB game, or outside the
// build's day window). Each entry:
//   { opp: {id, name},
//     mates: [{id, name}],          // players on MY club who overlapped him
//     clubs: [{teamId, teamName, level, seasons:[…]}]   // distinct shared clubs
//     top: {teamName, level, season} }                  // headline club (sort key)
export function formerTeammateGroups(data, myTeamId, oppTeamId) {
  if (!myTeamId || !oppTeamId) return []
  const key = myTeamId < oppTeamId ? `${myTeamId}-${oppTeamId}` : `${oppTeamId}-${myTeamId}`
  const entry = data?.matchups?.[key]
  const rows = entry?.rows
  if (!Array.isArray(rows) || !entry) return []

  // In a stored row, `a` is on entry.teamA and `b` on entry.teamB. Point `mine`
  // at whichever is on myTeamId; the other is the opposing player.
  const iAmTeamA = entry.teamA === myTeamId

  const byOpp = new Map()
  for (const row of rows) {
    const mine = iAmTeamA ? row.a : row.b
    const opp = iAmTeamA ? row.b : row.a
    if (!opp?.id || !mine?.id) continue
    if (!byOpp.has(opp.id)) {
      byOpp.set(opp.id, { opp, mates: [], clubKeys: new Set(), clubs: [] })
    }
    const g = byOpp.get(opp.id)
    g.mates.push(mine)
    for (const c of row.shared ?? []) {
      if (g.clubKeys.has(c.teamId)) {
        // Merge seasons into the club already recorded for this opponent.
        const existing = g.clubs.find((x) => x.teamId === c.teamId)
        for (const s of c.seasons ?? []) {
          if (!existing.seasons.includes(s)) existing.seasons.push(s)
        }
        existing.seasons.sort((x, y) => x - y)
      } else {
        g.clubKeys.add(c.teamId)
        g.clubs.push({ ...c, seasons: [...(c.seasons ?? [])] })
      }
    }
  }

  const groups = [...byOpp.values()].map((g) => {
    const clubs = g.clubs.sort(
      (x, y) =>
        LEVEL_RANK(y.level) - LEVEL_RANK(x.level) ||
        Math.max(...y.seasons) - Math.max(...x.seasons),
    )
    const headline = clubs[0]
    return {
      opp: g.opp,
      mates: g.mates,
      clubs,
      top: {
        teamName: headline?.teamName ?? '',
        level: headline?.level ?? '',
        season: headline ? Math.max(...headline.seasons) : 0,
      },
    }
  })

  // Most significant ties first: highest shared level, then most recent, then
  // the ones binding the most players (a former teammate of half our club).
  return groups.sort(
    (x, y) =>
      LEVEL_RANK(y.top.level) - LEVEL_RANK(x.top.level) ||
      y.top.season - x.top.season ||
      y.mates.length - x.mates.length,
  )
}

const LEVEL_ORDER = { MLB: 5, AAA: 4, AA: 3, 'A+': 2, A: 1 }
const LEVEL_RANK = (label) => LEVEL_ORDER[label] ?? 0
