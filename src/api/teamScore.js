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
// 'currentForm' — the two grades TeamScoreCard shows. `tiebreak` carries the
// finer-grained pre-rounding signal (see leagueRankNoTies) — unused by the
// plain, ties-allowed leagueRank the Quality driver row still ranks with.
export function leagueScoresFor(data, season, cutoff, statKey) {
  const byTeamId = data?.seasons?.[season]?.byTeamId
  if (!byTeamId) return []
  const rows = []
  for (const [teamId, snapshots] of Object.entries(byTeamId)) {
    const stat = latestAt(snapshots, cutoff)?.[statKey]
    if (stat?.score != null) {
      rows.push({ teamId: Number(teamId), score: stat.score, tiebreak: [stat.weightedWinsAbove500, stat.runDifferential] })
    }
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

// Where a team's own score sits among the league rows above (1 = best).
// Null if the team isn't in the pool (e.g. too few games played yet). Ties
// share a rank (competition ranking) — the convention everywhere except
// Season Grade and Current Form, which use leagueRankNoTies below instead.
export function leagueRank(rows, teamId) {
  const mine = rows.find((r) => r.teamId === teamId)
  if (!mine) return null
  return { rank: 1 + rows.filter((r) => r.score > mine.score).length, of: rows.length }
}

// A strict, gapless 1..N ranking with a deterministic tiebreaker chain, for
// the two metrics (Season Grade, Current Form) that show a rank pill AND a
// strip of rank-numbered team chips — a shared score (both are rounded to
// one decimal, so ties are common) would otherwise print two teams at the
// same rank in both places. Falls through the rounded score to each row's
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

export function leagueRankNoTies(rows, teamId) {
  const mine = rows.find((r) => r.teamId === teamId)
  if (!mine) return null
  return { rank: 1 + rows.filter((r) => compareRowsNoTies(r, mine) < 0).length, of: rows.length }
}

// Best-to-worst rows with a strict, gapless rank attached (see
// leagueRankNoTies) — what the rank-chip strip iterates to print each team's
// number, so a chip's number can never disagree with the "Nth of 30" pill
// computed above for the same pool.
export function rankedNoTies(rows) {
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
