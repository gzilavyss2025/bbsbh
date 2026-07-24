// Per-team, per-season COMEBACK counts — the numerator AND denominator of a
// comeback RATE. For every Final game both sides' minimum win probability is
// bucketed: whichever side fell below 10 / 20 / 30% at some point counts an
// ATTEMPT (att10/att20/att30), and if it went on to win it also counts a
// comeback WIN (sub10/sub20/sub30). So a team's rate of clawing back from a
// given hole is sub/att, and the league baseline is the same ratio pooled over
// all clubs. Both pairs nest (sub10 <= sub20 <= sub30; att10 <= att20 <= att30).
// Read from the static public/data/comeback-wins.json a nightly
// scripts/gen-comeback-wins.mjs precomputes (build-time-fetch pattern; the
// per-game winProbability sweep is too costly for page load). Surfaced by the
// Team Page's "Comeback wins" card (team rate vs. MLB average), shown when the
// team has at least one comeback win.
//
// Spoiler-free: a season aggregate over FINAL games carries no live-game score
// (same footing as WAR / team-score aggregates), so no SealBox — only the live
// per-play win prob in the innings view is sealed. Degrades to null with no file.
let cached

export async function fetchComebackWins() {
  if (cached !== undefined) return cached
  try {
    const res = await fetch('/data/comeback-wins.json')
    if (!res.ok) throw new Error(`comeback-wins.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = null
  }
  return cached
}

// One team's buckets for a season, or null if the file has no row for it.
export function comebackWinsFor(data, teamId, season) {
  return data?.seasons?.[season]?.byTeamId?.[teamId] ?? null
}

// Every team's buckets for a season, shaped as `{ teamId, stat: { sub10, sub20,
// sub30 } }` — the exact row shape TeamPage's statRank/rankTeam expects, so the
// card can rank each threshold against the rest of the league (out of however
// many teams have a row yet). Empty when the file is missing.
export function leagueComebackWinsFor(data, season) {
  const byTeamId = data?.seasons?.[season]?.byTeamId
  if (!byTeamId) return []
  return Object.entries(byTeamId).map(([teamId, b]) => ({
    teamId: Number(teamId),
    stat: { sub10: b.sub10, sub20: b.sub20, sub30: b.sub30 },
  }))
}

// The three nested depth thresholds, shallowest first: (win key, attempt key,
// the win-probability floor the club sank to).
const THRESHOLDS = [
  { key: 'sub10', attKey: 'att10', pct: 10 },
  { key: 'sub20', attKey: 'att20', pct: 20 },
  { key: 'sub30', attKey: 'att30', pct: 30 },
]

// One club's comeback profile for the "Comeback wins" card: per threshold, the
// wins it pulled out of that hole (`wins`), how many times it fell that low at
// all (`att`), its own comeback RATE (wins/att), and the pooled MLB baseline
// rate (Σwins/Σatt across every club) so the club's rate reads against a "what's
// normal" mark. `field` is every club's rate at that depth and `maxRate` the
// league leader's, so the card can plot all 30 clubs on a rail scaled 0 → the
// #1 club. `rank`/`of`/`tied` rank the club by raw comeback-win COUNT (a robust,
// sample-size-proof ordering — a rate rank would let a 1-of-1 team top the
// board), enough for the card to badge a league lead. Returns null when the file
// has no row for the club, or `rate: null` on a threshold it never reached. `att`
// is absent in the pre-attempts v1 file, so a missing denominator degrades to a
// null rate rather than dividing by undefined.
export function comebackRatesFor(data, teamId, season) {
  const byTeamId = data?.seasons?.[season]?.byTeamId
  const mine = byTeamId?.[teamId]
  if (!byTeamId || !mine) return null
  const entries = Object.entries(byTeamId)
  const rows = entries.map(([, b]) => b)
  const thresholds = THRESHOLDS.map(({ key, attKey, pct }) => {
    const wins = mine[key] ?? 0
    const att = mine[attKey] ?? 0
    const hasAtt = mine[attKey] != null
    let leagueWins = 0
    let leagueAtt = 0
    for (const r of rows) {
      leagueWins += r[key] ?? 0
      leagueAtt += r[attKey] ?? 0
    }
    // Every club's rate at this depth (clubs with a real denominator), for the
    // all-30 rail; maxRate is the leader's, the rail's right edge.
    const field = entries
      .filter(([, r]) => (r[attKey] ?? 0) > 0)
      .map(([tid, r]) => ({ teamId: Number(tid), rate: (r[key] ?? 0) / r[attKey] }))
    const maxRate = field.reduce((m, r) => (r.rate > m ? r.rate : m), 0)
    // Rank by comeback-win count, ties sharing the best (lowest) rank — 1 + the
    // number of clubs strictly ahead. `tied` when another club matches the count.
    const ahead = rows.filter((r) => (r[key] ?? 0) > wins).length
    const tied = rows.filter((r) => (r[key] ?? 0) === wins).length > 1
    return {
      key,
      pct,
      wins,
      att,
      rate: hasAtt && att > 0 ? wins / att : null,
      leagueRate: leagueAtt > 0 ? leagueWins / leagueAtt : null,
      field,
      maxRate,
      rank: ahead + 1,
      of: rows.length,
      tied,
    }
  })
  return { wins: mine.wins ?? 0, thresholds }
}
