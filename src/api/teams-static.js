// Static team-identity data, read from a same-origin file
// (public/data/teams.json) rather than fetched live from statsapi. That file
// is regenerated weekly by scripts/gen-teams.mjs (see
// .github/workflows/update-teams.yml) — this module just reads it. Shared by
// fetchTeams() (schedule.js) and fetchTeam() (team.js), the two callers that
// need every active club's identity metadata. Cached in-memory for the
// session since the file only changes once a week; degrades to an empty
// `bySportId` on any failure so both callers see a plain cache miss and fall
// back to their live statsapi call (rather than refetching this file on
// every subsequent call in a session where it's unavailable).
let cached = null

export async function fetchStaticTeams() {
  if (cached) return cached
  try {
    const res = await fetch('/data/teams.json')
    if (!res.ok) throw new Error(`teams.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = { generatedAt: null, bySportId: {} }
  }
  return cached
}
