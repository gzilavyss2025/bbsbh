// W1.2. Re-derives the club-payroll panel under four different attribution
// rules for a traded player's salary, and checks whether W1.1's finding
// survives the choice -- ADR-0067 declined a club-keyed ledger BECAUSE
// inferring a club from a season roster mis-files anyone traded mid-year,
// and 10.5% of joined rows are exactly those players. If the four rules
// disagree on club rank ordering, the "payroll" story is an artifact of
// R1's pro-rata rule, not a real signal.
//
//   R1  pro-rata by combined PA + paPerInning*IP share (W1.1's rule, reused
//       verbatim from payroll-by-player.json -- not recomputed here)
//   R2  largest-share-takes-all -- the whole salary to whichever club held
//       the bigger share under R1's own weights
//   R3  first-club-only -- the whole salary to the club he FIRST appeared
//       for, by real game date (see fetch-first-club.mjs; NOT the season-
//       total endpoint, which sorts by team id, not chronologically). This
//       is a stand-in for "who paid him on Opening Day," not the real thing
//       -- this data has no 26-man-roster snapshot, so a player who opened
//       the season in the minors and was recalled reads under whichever
//       MLB club he reached first, which can postdate Opening Day itself.
//   R4  traded players excluded entirely -- a split player-season
//       contributes zero dollars and belongs to no club under this rule,
//       in both the numerator and the club total.
//
// A single-club player-season (89.4% of them) is identical under all four
// rules by construction -- there is nothing to attribute. Only the 2,197
// split player-seasons can move a number here.
//
// Run: node .scratch/team-success/build-payroll-rules.mjs
// Reads: payroll-by-player.json, first-club-cache.json
// Writes: payroll-rules-panel.json, payroll-rules-findings.json
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALL_MLB_TEAM_IDS, teamFullName } from '../../src/lib/teams.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..', '..')
const FIRST_SEASON = 2000
const LAST_SEASON = 2025

const read = (p) => readFileSync(join(REPO, p), 'utf8')
const readJson = (p) => JSON.parse(read(p))

const payrollByPlayer = readJson('.scratch/team-success/payroll-by-player.json')
const firstClub = readJson('.scratch/team-success/first-club-cache.json')

// -------------------------------------------------------- group by player-season

const bySeasonPlayer = new Map() // `${season}|${mlbId}` -> rows
for (const row of payrollByPlayer.rows) {
  const key = `${row.season}|${row.mlbId}`
  if (!bySeasonPlayer.has(key)) bySeasonPlayer.set(key, [])
  bySeasonPlayer.get(key).push(row)
}

const RULES = ['r1', 'r2', 'r3', 'r4']
const counts = {
  playerSeasons: bySeasonPlayer.size,
  splitPlayerSeasons: 0,
  r2Ties: 0,
  r3Missing: 0,
  r4ExcludedDollars: 0,
  r4ExcludedPlayerSeasons: 0,
}

// season -> rule -> teamId -> dollars
const totals = new Map()
for (let year = FIRST_SEASON; year <= LAST_SEASON; year++) {
  const perRule = {}
  for (const rule of RULES) {
    perRule[rule] = new Map(ALL_MLB_TEAM_IDS.map((id) => [id, 0]))
  }
  totals.set(year, perRule)
}

for (const [key, rows] of bySeasonPlayer) {
  const season = rows[0].season
  const bucket = totals.get(season)
  if (!bucket) continue // outside the window -- cannot happen, rows come from the window already

  if (rows.length === 1) {
    // No attribution question. All four rules agree by construction.
    const { teamId, attributedSalary } = rows[0]
    for (const rule of RULES) bucket[rule].set(teamId, bucket[rule].get(teamId) + attributedSalary)
    continue
  }

  counts.splitPlayerSeasons += 1
  const total = rows.reduce((sum, r) => sum + r.attributedSalary, 0)

  // R1: exactly W1.1's own pro-rata split.
  for (const r of rows) bucket.r1.set(r.teamId, bucket.r1.get(r.teamId) + r.attributedSalary)

  // R2: largest share takes all. Ties broken toward the lower teamId so the
  // rule is deterministic; counted so a reader can see how often it fires.
  const maxShare = Math.max(...rows.map((r) => r.shareOfPlayerSeason))
  const leaders = rows.filter((r) => r.shareOfPlayerSeason === maxShare).sort((a, b) => a.teamId - b.teamId)
  if (leaders.length > 1) counts.r2Ties += 1
  bucket.r2.set(leaders[0].teamId, bucket.r2.get(leaders[0].teamId) + total)

  // R3: first club by real game date.
  const first = firstClub.results[key]
  if (!first) {
    // fetch-first-club.mjs found zero split player-seasons with no game log
    // at all, so this branch is here for completeness, not because it fires.
    counts.r3Missing += 1
  } else {
    bucket.r3.set(first.teamId, bucket.r3.get(first.teamId) + total)
  }

  // R4: excluded entirely -- no dollars, no club.
  counts.r4ExcludedDollars += total
  counts.r4ExcludedPlayerSeasons += 1
}

// ---------------------------------------------------------------- ranking

// Rank 1 = highest payroll. Ties (two clubs at the exact same dollar figure)
// share the same rank and the next rank skips -- standard competition
// ranking, so "rank 5" always means "5th-highest," never an artifact of
// insertion order.
function rankTeams(teamDollars) {
  const sorted = [...teamDollars.entries()].sort((a, b) => b[1] - a[1])
  const ranks = new Map()
  let rank = 0
  let prevDollars = null
  sorted.forEach(([teamId, dollars], i) => {
    if (dollars !== prevDollars) rank = i + 1
    ranks.set(teamId, rank)
    prevDollars = dollars
  })
  return ranks
}

// Spearman rank correlation between two rank maps over the same team set.
function spearman(ranksA, ranksB, teamIds) {
  const n = teamIds.length
  let sumSqDiff = 0
  for (const teamId of teamIds) {
    const d = ranksA.get(teamId) - ranksB.get(teamId)
    sumSqDiff += d * d
  }
  return 1 - (6 * sumSqDiff) / (n * (n * n - 1))
}

const RULE_PAIRS = [
  ['r1', 'r2'],
  ['r1', 'r3'],
  ['r1', 'r4'],
  ['r2', 'r3'],
  ['r2', 'r4'],
  ['r3', 'r4'],
]

const seasons = []
for (let year = FIRST_SEASON; year <= LAST_SEASON; year++) {
  const bucket = totals.get(year)
  const ranks = {}
  for (const rule of RULES) ranks[rule] = rankTeams(bucket[rule])

  const correlations = {}
  for (const [a, b] of RULE_PAIRS) {
    correlations[`${a}-${b}`] = spearman(ranks[a], ranks[b], ALL_MLB_TEAM_IDS)
  }

  const teams = {}
  for (const teamId of ALL_MLB_TEAM_IDS) {
    teams[teamId] = {
      name: teamFullName(teamId),
      r1: { payroll: bucket.r1.get(teamId), rank: ranks.r1.get(teamId) },
      r2: { payroll: bucket.r2.get(teamId), rank: ranks.r2.get(teamId) },
      r3: { payroll: bucket.r3.get(teamId), rank: ranks.r3.get(teamId) },
      r4: { payroll: bucket.r4.get(teamId), rank: ranks.r4.get(teamId) },
    }
  }

  seasons.push({ year, correlations, teams })
}

// --------------------------------------------------- movement & tolerance

// The gate: propose a tolerance BEFORE looking at the results (per the
// assignment) and only then check it. A payroll ranking is a competitive
// ordering used for prose like "the Dodgers ran the majors' 2nd-highest
// payroll" -- a reader tolerates a near neighbor swapping (rank 4 vs 5), not
// a club jumping from the bottom third to the top five. Proposed BEFORE
// results were read:
//   - median |rank movement| across all club-seasons, vs R1, stays <= 1
//   - no more than 10% of club-seasons move more than 3 ranks vs R1
//   - Spearman rho between R1 and every other rule stays >= 0.95 in every
//     season
// All three must hold for every non-R1 rule for the gate to pass.
const TOLERANCE = {
  maxMedianAbsMovement: 1,
  maxShareBeyondThreeRanks: 0.1,
  rankMovementThreshold: 3,
  minSpearman: 0.95,
}

const movementsByPair = new Map(RULE_PAIRS.map(([a, b]) => [`${a}-${b}`, []]))
for (const season of seasons) {
  for (const [a, b] of RULE_PAIRS) {
    for (const teamId of ALL_MLB_TEAM_IDS) {
      const t = season.teams[teamId]
      const movement = Math.abs(t[a].rank - t[b].rank)
      movementsByPair.get(`${a}-${b}`).push({
        year: season.year,
        teamId,
        team: t.name,
        rankA: t[a].rank,
        rankB: t[b].rank,
        movement,
      })
    }
  }
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const pairSummaries = {}
for (const [pair, movements] of movementsByPair) {
  const abs = movements.map((m) => m.movement)
  const medianMovement = median(abs)
  const beyondThreshold = movements.filter((m) => m.movement > TOLERANCE.rankMovementThreshold)
  const worst = [...movements].sort((a, b) => b.movement - a.movement)[0]
  const minRho = Math.min(...seasons.map((s) => s.correlations[pair]))
  pairSummaries[pair] = {
    medianAbsMovement: medianMovement,
    shareBeyondThreeRanks: beyondThreshold.length / movements.length,
    movementsBeyondThreeRanks: beyondThreshold.length,
    totalClubSeasons: movements.length,
    minSpearman: minRho,
    worstSingleMovement: worst,
  }
}

// clubs (not club-seasons) that move more than 3 ranks vs R1 at least once
const clubsBeyondThreeVsR1 = {}
for (const pair of ['r1-r2', 'r1-r3', 'r1-r4']) {
  const set = new Set()
  for (const m of movementsByPair.get(pair)) {
    if (m.movement > TOLERANCE.rankMovementThreshold) set.add(m.team)
  }
  clubsBeyondThreeVsR1[pair] = [...set].sort()
}

// gate verdict: every non-R1 pair vs R1 must clear all three tolerances
const gatePairs = ['r1-r2', 'r1-r3', 'r1-r4']
const gateChecks = {}
let gatePasses = true
for (const pair of gatePairs) {
  const s = pairSummaries[pair]
  const okMedian = s.medianAbsMovement <= TOLERANCE.maxMedianAbsMovement
  const okShare = s.shareBeyondThreeRanks <= TOLERANCE.maxShareBeyondThreeRanks
  const okRho = s.minSpearman >= TOLERANCE.minSpearman
  const pass = okMedian && okShare && okRho
  gateChecks[pair] = { okMedian, okShare, okRho, pass }
  if (!pass) gatePasses = false
}

// -------------------------------------------------------------- write files

const generatedAt = new Date().toISOString()
const panel = {
  generatedAt,
  source: 'payroll-by-player.json (W1.1) + first-club-cache.json (real MLB game-log dates)',
  rules: {
    r1: 'pro-rata by combined PA + paPerInning*IP share (W1.1 default, reused verbatim)',
    r2: 'largest-share-takes-all under R1’s own weights',
    r3: 'first-club-only, by real chronological game date -- a stand-in for Opening Day, not Opening Day itself',
    r4: 'traded players excluded entirely, from both numerator and club',
  },
  window: [FIRST_SEASON, LAST_SEASON],
  counts,
  tolerance: TOLERANCE,
  gateChecks,
  gatePasses,
  seasons,
}
writeFileSync(join(__dirname, 'payroll-rules-panel.json'), `${JSON.stringify(panel, null, 1)}\n`)

const findings = {
  generatedAt,
  counts,
  tolerance: TOLERANCE,
  gateChecks,
  gatePasses,
  pairSummaries,
  clubsBeyondThreeVsR1,
}
writeFileSync(join(__dirname, 'payroll-rules-findings.json'), `${JSON.stringify(findings, null, 1)}\n`)

// ----------------------------------------------------------------- report

console.log('player-seasons: %d total, %d split (%s%)', counts.playerSeasons, counts.splitPlayerSeasons,
  ((counts.splitPlayerSeasons / counts.playerSeasons) * 100).toFixed(1))
console.log('R2 ties (equal max share): %d', counts.r2Ties)
console.log('R3 missing a first club: %d', counts.r3Missing)
console.log('R4 excludes $%sM across %d player-seasons', (counts.r4ExcludedDollars / 1e6).toFixed(1), counts.r4ExcludedPlayerSeasons)
console.log('')
console.log('TOLERANCE (proposed before results were read):', TOLERANCE)
console.log('')
for (const pair of RULE_PAIRS) {
  const [a, b] = pair
  const key = `${a}-${b}`
  const s = pairSummaries[key]
  console.log(
    '%s  median|Δrank| %s  >3-rank moves %d/%d (%s%)  min ρ %s  worst: %s %d  %s→%s',
    key,
    s.medianAbsMovement,
    s.movementsBeyondThreeRanks,
    s.totalClubSeasons,
    (s.shareBeyondThreeRanks * 100).toFixed(1),
    s.minSpearman.toFixed(4),
    s.worstSingleMovement.team,
    s.worstSingleMovement.year,
    s.worstSingleMovement.rankA,
    s.worstSingleMovement.rankB,
  )
}
console.log('')
for (const pair of gatePairs) {
  console.log('clubs moving >3 ranks vs R1 at least once (%s): %d -- %s', pair, clubsBeyondThreeVsR1[pair].length, clubsBeyondThreeVsR1[pair].join(', '))
}
console.log('')
console.log('GATE CHECKS')
for (const pair of gatePairs) console.log(' ', pair, gateChecks[pair])
console.log('')
console.log(gatePasses ? 'GATE PASSES: W2 may open.' : 'GATE FAILS: this does not survive the attribution choice.')
