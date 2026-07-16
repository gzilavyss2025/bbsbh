import { seasonGradeFor } from './seasonGradeFormula.js'

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

function latestAt(snapshots, cutoff) {
  const eligible = Object.keys(snapshots).filter((date) => !cutoff || date <= cutoff).sort()
  return eligible.length ? snapshots[eligible[eligible.length - 1]] : null
}

export function teamScoreFor(data, teamId, season, cutoff) {
  const snapshots = data?.seasons?.[season]?.byTeamId?.[teamId]
  return snapshots ? latestAt(snapshots, cutoff) : null
}

// Every team's score at the same cutoff, for the "how do we compare to the
// other 29" dots on the Team Score card. statKey is 'season' or
// 'currentForm' — the two grades TeamScoreCard shows.
export function leagueScoresFor(data, season, cutoff, statKey) {
  const byTeamId = data?.seasons?.[season]?.byTeamId
  if (!byTeamId) return []
  const rows = []
  for (const [teamId, snapshots] of Object.entries(byTeamId)) {
    const score = latestAt(snapshots, cutoff)?.[statKey]?.score
    if (score != null) rows.push({ teamId: Number(teamId), score })
  }
  return rows
}

// Every team's Season Grade at one shared spoiler-safe cutoff. Quality and
// Surprise live in separate generated files, so rows only enter the comparison
// pool when both same-date-safe readers can provide a value.
export function leagueSeasonGradesFor(teamData, surpriseData, season, cutoff) {
  const byTeamId = teamData?.seasons?.[season]?.byTeamId
  if (!byTeamId) return []
  const rows = []
  for (const [teamId, snapshots] of Object.entries(byTeamId)) {
    const quality = latestAt(snapshots, cutoff)?.season
    const surpriseSnapshots = surpriseData?.seasons?.[season]?.byTeamId?.[teamId]
    const surprise = surpriseSnapshots ? latestAt(surpriseSnapshots, cutoff) : null
    const grade = seasonGradeFor(quality, surprise)
    if (grade) rows.push({ teamId: Number(teamId), score: grade.score })
  }
  return rows
}

// Where a team's own score sits among the league rows above (1 = best).
// Null if the team isn't in the pool (e.g. too few games played yet).
export function leagueRank(rows, teamId) {
  const mine = rows.find((r) => r.teamId === teamId)
  if (!mine) return null
  return { rank: 1 + rows.filter((r) => r.score > mine.score).length, of: rows.length }
}
