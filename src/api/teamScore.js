// Daily MLB team-quality snapshots. Like seasonScoreFor, this reader selects
// only the latest snapshot at or before a Team Page's spoiler-safe cutoff.
let cached = null

export async function fetchTeamScores() {
  if (cached) return cached
  try {
    const res = await fetch('/data/team-score.json')
    if (!res.ok) throw new Error(`team-score.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = { version: 1, generatedAt: null, seasons: {} }
  }
  return cached
}

export function teamScoreFor(data, teamId, season, cutoff) {
  const snapshots = data?.seasons?.[season]?.byTeamId?.[teamId]
  if (!snapshots) return null
  const eligible = Object.keys(snapshots).filter((date) => !cutoff || date <= cutoff).sort()
  return eligible.length ? snapshots[eligible[eligible.length - 1]] : null
}
