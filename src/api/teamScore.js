import { seasonGradeFor } from './seasonGradeFormula.js'
import { staticJson } from './staticJson.js'
import { latestAtOrBefore } from '../lib/math/snapshot.js'

// Daily MLB team-quality snapshots. Like seasonScoreFor, this reader selects
// only the latest snapshot at or before a Team Page's as-of cutoff.
export const fetchTeamScores = staticJson('/data/team-score.json', {
  fallback: { version: 1, generatedAt: null, seasons: {} },
})

export function teamScoreFor(data, teamId, season, cutoff) {
  const snapshots = data?.seasons?.[season]?.byTeamId?.[teamId]
  return snapshots ? latestAtOrBefore(snapshots, cutoff) : null
}

// Every team's Season Grade at one shared as-of cutoff. Quality and
// Surprise live in separate generated files, so rows only enter the comparison
// pool when both same-date-safe readers can provide a value.
export function leagueSeasonGradesFor(teamData, surpriseData, season, cutoff) {
  const byTeamId = teamData?.seasons?.[season]?.byTeamId
  if (!byTeamId) return []
  const rows = []
  for (const [teamId, snapshots] of Object.entries(byTeamId)) {
    const quality = latestAtOrBefore(snapshots, cutoff)?.season
    const surpriseSnapshots = surpriseData?.seasons?.[season]?.byTeamId?.[teamId]
    const surprise = surpriseSnapshots ? latestAtOrBefore(surpriseSnapshots, cutoff) : null
    const grade = seasonGradeFor(quality, surprise)
    if (grade) {
      rows.push({
        teamId: Number(teamId),
        score: grade.score,
        tiebreak: [quality?.weightedWinsAbove500, surprise?.residualWins],
      })
    }
  }
  return rows
}

// A strict, gapless 1..N ranking with a deterministic tiebreaker chain. Its one
// caller is gradeTiersByTeamId below: a shared Season Grade (rounded to one
// decimal, so ties are common) would otherwise leave input order to decide which
// third a team lands in. Falls through the rounded score to each row's
// `tiebreak` array (a finer-grained underlying signal that rounded to the
// same score, e.g. weightedWinsAbove500) and finally to teamId, so it always
// resolves to a total order — no two teams can tie all the way down.
function compareRowsNoTies(a, b) {
  if (b.score !== a.score) return b.score - a.score
  const ta = a.tiebreak ?? []
  const tb = b.tiebreak ?? []
  for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
    const diff = (tb[i] ?? 0) - (ta[i] ?? 0)
    if (diff !== 0) return diff
  }
  return a.teamId - b.teamId
}

// Best-to-worst rows with a strict, gapless rank attached (see
// compareRowsNoTies).
function rankedNoTies(rows) {
  return [...rows].sort(compareRowsNoTies).map((r, i) => ({ ...r, rank: i + 1 }))
}

// Buckets a Season Grade pool into thirds by RANK (not a fixed score cutoff)
// — top third 'high', bottom third 'low', the rest 'mid' — for the Standings
// page's percentile pill. Rank-based so the three tones always split the
// CURRENT pool evenly, even as the league-wide spread of grades drifts across
// a season.
export function gradeTiersByTeamId(rows) {
  const ranked = rankedNoTies(rows)
  const of = ranked.length
  const third = of / 3
  const byTeamId = new Map()
  for (const r of ranked) {
    const tier = r.rank <= third ? 'high' : r.rank > of - third ? 'low' : 'mid'
    byTeamId.set(r.teamId, tier)
  }
  return byTeamId
}
