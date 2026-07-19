// Per-team, per-season COMEBACK WIN counts — wins in which the team's win
// probability fell below 10 / 20 / 30% at some point (nested: sub10 <= sub20 <=
// sub30). Read from the static public/data/comeback-wins.json a nightly
// scripts/gen-comeback-wins.mjs precomputes (build-time-fetch pattern; the
// per-game winProbability sweep is too costly for page load). Surfaced by the
// Team Page as a ranked "Comeback wins" card, shown only when non-zero.
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
