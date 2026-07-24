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

// Groups rows by pitcher (so every batter who's faced a given pitcher stays
// adjacent on the CareerMatchups table, rather than interleaved by raw PA
// count — see TeamInfo.jsx's MatchupTable) while preserving the original
// "most real history first" ordering: pitcher groups are ranked by their own
// total PA, and batters within a group are ranked by PA too. Pure re-sort, no
// data reshaping — same row shape in, same rows out.
export function sortByPitcher(rows) {
  const byPitcher = new Map()
  for (const r of rows) {
    const group = byPitcher.get(r.pitcher.id)
    if (group) group.push(r)
    else byPitcher.set(r.pitcher.id, [r])
  }
  return [...byPitcher.values()]
    .map((group) => group.sort((x, y) => y.pa - x.pa))
    .sort((a, b) => b.reduce((sum, r) => sum + r.pa, 0) - a.reduce((sum, r) => sum + r.pa, 0))
    .flat()
}

// Collapses the pitcher-grouped rows (see sortByPitcher — same-pitcher rows
// are already adjacent) into one entry per pitcher: `{ pitcher, rows }`, order
// preserved. The table (TeamInfo.jsx's MatchupTable) renders the pitcher once
// as a group heading instead of repeating his name on every batter row — the
// three-column "batter / pitcher / line" grid that repetition forced was too
// wide for a phone (horizontal scroll); a pitcher heading over two-part
// batter/line rows fits without it. Assumes rows are already sortByPitcher'd;
// a stray non-adjacent repeat would open a second group for the same pitcher
// rather than merge, which is fine (the sort guarantees it won't happen).
export function groupByPitcher(rows) {
  const groups = []
  let current = null
  for (const r of rows) {
    if (!current || current.pitcher.id !== r.pitcher.id) {
      current = { pitcher: r.pitcher, rows: [] }
      groups.push(current)
    }
    current.rows.push(r)
  }
  return groups
}

// "2-for-7, 1 HR, 3 K — AA, A+" — scorebook shorthand first (the thing a
// paper scorer already writes), extras only when they're nonzero so a plain
// 0-for-2 doesn't carry three redundant zero badges, levels last so a pair
// who's only ever faced off at tonight's own level (the common case) doesn't
// repeat what the card's own context already implies — only a pair with
// history at ANOTHER level too keeps the full list, tonight's level included,
// so a reader can see how much of the sample carries over.
export function matchupLine(r, levelLabel) {
  const parts = [`${r.h}-for-${r.ab}`]
  if (r.hr > 0) parts.push(`${r.hr} HR`)
  if (r.bb > 0) parts.push(`${r.bb} BB`)
  if (r.k > 0) parts.push(`${r.k} K`)
  const stat = parts.join(', ')
  const onlyTonightsLevel = r.levels.length === 1 && r.levels[0] === levelLabel
  return r.levels.length > 0 && !onlyTonightsLevel ? `${stat} — ${r.levels.join(', ')}` : stat
}
