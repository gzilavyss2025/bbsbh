// The lineup page's CAREER MATCHUPS card data — for each upcoming matchup
// (MLB or MiLB), every batter/pitcher pair (one from each opposing club) with
// real career plate-appearance history against each other, at ANY level —
// read from a static same-origin file (public/data/career-matchups.json)
// rather than computed live. "Watching an AA game, but they faced each other
// in A+ last year" is exactly the case this covers: a pair's history is
// summed across every level they've both ever played at, not just tonight's.
//
// Building it is expensive and can't be done spoiler-cheaply on a page load:
// checking one batter/pitcher pair's history needs one statsapi call PER
// LEVEL they might have crossed paths at (the API takes exactly one sportId
// per call), so a full lineup vs. a full pitching staff is hundreds of calls.
// It's also spoiler-sensitive in a way former-teammates/vs-team-splits
// aren't: the underlying stat updates live as tonight's plate appearances
// happen, so fetching it live mid-game could leak whether/how tonight's
// batter and pitcher have already matched up. scripts/gen-career-matchups.mjs
// precomputes it on the nightly cron (.github/workflows/update-nightly-data.yml)
// — which, running before that night's games, can never see a play that
// hasn't happened yet — and this module just reads the result. Same
// build-time-fetch pattern as former-teammates.js (see docs/data-enrichment.md
// §5). Rosters and past-season career totals carry no score, so the file
// itself is spoiler-free like the rest of the lineup-page surfaces.
//
// Degrades to an empty map before the file exists or on any failure — the
// card simply doesn't render. Cached in-memory for the session since the
// file only changes once a day.
let cached = null

export async function loadCareerMatchups() {
  if (cached) return cached
  try {
    const res = await fetch('/data/career-matchups.json')
    if (!res.ok) throw new Error(`career-matchups.json ${res.status}`)
    const data = await res.json()
    cached = { matchups: data.matchups ?? {}, generatedAt: data.generatedAt ?? null }
  } catch {
    cached = { matchups: {}, generatedAt: null }
  }
  return cached
}

// Every batter/pitcher pair for a matchup, order-independent (`teamIdA`/
// `teamIdB` in either order return the same list) — same symmetry as
// formerTeammatePairs, so the wide spread layout (both clubs' pages open at
// once) doesn't need to ask twice. Sorted by plate appearances (most-faced
// first — the simplest "how real is this history" signal; unlike former
// teammates there's no separate interest-scoring formula here, since PA count
// already is that signal). Each row:
//   { batter: {id, name, teamId}, pitcher: {id, name, teamId},
//     ab, h, hr, bb, hbp, k, pa, levels: ['AA', 'A+', ...] }
export function careerMatchupsFor(data, teamIdA, teamIdB) {
  if (!teamIdA || !teamIdB) return []
  const key = teamIdA < teamIdB ? `${teamIdA}-${teamIdB}` : `${teamIdB}-${teamIdA}`
  const rows = data?.matchups?.[key]
  return Array.isArray(rows) ? rows : []
}
