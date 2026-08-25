// Follow-up robustness check on spike #1 (docs/team-success-roster-age.md),
// requested directly: the age finding could be an artifact of trade-deadline
// rentals who inflate a team's SEASON-LONG age without actually playing much
// once October starts. This checks that directly rather than guessing at it
// from a date cutoff — for every player who appeared in a team's regular
// season AND/OR its postseason that year, compare his share of the team's
// regular-season playing time against his share of its POSTSEASON playing
// time. A big mismatch (postseason share far above regular-season share) is
// exactly the "stepped up when it mattered" case a deadline addition — or a
// September call-up, or a bench player who got hot — would produce.
//
// From that, three things:
//   1. A "postseason-actual age" per playoff team — age weighted by who
//      ACTUALLY played in October, not by full-season role — compared
//      against that same team's regular-season age.
//   2. Whether postseason-actual age still predicts how far a team went,
//      among the playoff teams (the only population it's defined for).
//   3. The biggest mismatch outliers league-wide, for their own sake — this
//      is the general-purpose primitive the framework doc can point future
//      spikes (trades, situational rosters) at, not just this one.
//
// Run: node .scratch/team-success/analyze-usage-mismatch.mjs
// Reads: outcome-ladder.json, roster-age-cache.json, roster-age.json,
//        postseason-usage.json
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (name) => JSON.parse(readFileSync(join(__dirname, name), 'utf8'))

const ladderData = read('outcome-ladder.json')
const regularCache = read('roster-age-cache.json')
const rosterAge = read('roster-age.json')
const postseasonUsage = read('postseason-usage.json')

const rosterAgeBySeason = new Map(rosterAge.seasons.map((s) => [s.year, s]))
const postseasonBySeason = new Map(postseasonUsage.seasons.map((s) => [s.year, s]))

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function rank(xs) {
  const idx = xs.map((v, i) => i).sort((a, b) => xs[a] - xs[b])
  const ranks = new Array(xs.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[idx[k]] = avgRank
    i = j + 1
  }
  return ranks
}
function pearson(xs, ys) {
  const mx = mean(xs)
  const my = mean(ys)
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0))
  return den === 0 ? 0 : num / den
}
function spearman(xs, ys) {
  return pearson(rank(xs), rank(ys))
}
// Rank y against x, subtract the fitted line — the residual is "y with x's
// (rank) effect removed." Used to control for total postseason playing time,
// which correlates at rho=0.91 with the ladder BY CONSTRUCTION (more rounds
// won = more games played = more innings), so anything measured as a SHARE
// of a team's postseason playing time is a candidate to be confounded by it.
function residualizeRanks(y, x) {
  const ry = rank(y)
  const rx = rank(x)
  const mx = mean(rx)
  const my = mean(ry)
  const b = ry.reduce((s, v, i) => s + (rx[i] - mx) * (v - my), 0) / rx.reduce((s, v) => s + (v - mx) ** 2, 0)
  const a = my - b * mx
  return ry.map((v, i) => v - (a + b * rx[i]))
}
function partialSpearman(y, x, control) {
  return pearson(residualizeRanks(y, control), residualizeRanks(x, control))
}

function permutationTestWithinGroups(rows, valueKey, outcomeKey, groupKey, observed, iterations = 5000) {
  const byGroup = new Map()
  for (const row of rows) {
    if (!byGroup.has(row[groupKey])) byGroup.set(row[groupKey], [])
    byGroup.get(row[groupKey]).push(row)
  }
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const xs = []
    const ys = []
    for (const groupRows of byGroup.values()) {
      const outcomes = groupRows.map((r) => r[outcomeKey])
      for (let i = outcomes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]]
      }
      groupRows.forEach((r, i) => {
        xs.push(r[valueKey])
        ys.push(outcomes[i])
      })
    }
    if (Math.abs(spearman(xs, ys)) >= Math.abs(observed)) extreme++
  }
  return extreme / iterations
}

// Permutation test for a PARTIAL correlation: shuffle the outcome within
// each season (same as the plain test), then residualize the shuffled
// outcome against the control variable before comparing — since the control
// variable and the other side of the correlation never change under
// permutation, this correctly asks "how often does chance alone produce a
// partial correlation this extreme," not just a plain one.
function permutationTestPartialWithinGroups(rows, valueKey, outcomeKey, controlKey, groupKey, observed, iterations = 5000) {
  const controlRanks = rank(rows.map((r) => r[controlKey]))
  const residualizedValue = residualizeRanks(
    rows.map((r) => r[valueKey]),
    rows.map((r) => r[controlKey]),
  )
  const byGroup = new Map()
  rows.forEach((row, i) => {
    if (!byGroup.has(row[groupKey])) byGroup.set(row[groupKey], [])
    byGroup.get(row[groupKey]).push(i)
  })
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const shuffledOutcome = rows.map((r) => r[outcomeKey])
    for (const idxs of byGroup.values()) {
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const a = idxs[i]
        const b = idxs[j]
        ;[shuffledOutcome[a], shuffledOutcome[b]] = [shuffledOutcome[b], shuffledOutcome[a]]
      }
    }
    // Residualize the shuffled outcome against the (unshuffled) control.
    const shuffledRanks = rank(shuffledOutcome)
    const mx = mean(controlRanks)
    const my = mean(shuffledRanks)
    const b =
      shuffledRanks.reduce((s, v, i) => s + (controlRanks[i] - mx) * (v - my), 0) /
      controlRanks.reduce((s, v) => s + (v - mx) ** 2, 0)
    const a = my - b * mx
    const residualizedShuffled = shuffledRanks.map((v, i) => v - (a + b * controlRanks[i]))
    if (Math.abs(pearson(residualizedShuffled, residualizedValue)) >= Math.abs(observed)) extreme++
  }
  return extreme / iterations
}

// --- Build per-team-season player rows: regular-season role + postseason role ---
const outliers = [] // { year, teamId, personId, name, kind: 'hitting'|'pitching', regularShare, postseasonShare, mismatch }
const teamPostseasonAge = [] // { year, teamId, ladder, battingAgeRel, pitchingAgeRel, postseasonBattingAge, postseasonPitchingAge, regularBattingAge, regularPitchingAge }

for (const season of ladderData.seasons) {
  const psSeason = postseasonBySeason.get(season.year)
  const raSeason = rosterAgeBySeason.get(season.year)
  if (!psSeason || !raSeason) continue

  for (const [teamId, outcome] of Object.entries(season.teams)) {
    if (!outcome.madePlayoffs) continue
    const psTeam = psSeason.teams[teamId]
    if (!psTeam) continue

    for (const kind of ['hitting', 'pitching']) {
      const group = kind === 'hitting' ? 'hitting' : 'pitching'
      const regularSplits = regularCache[`${group}-${teamId}-${season.year}`] ?? []
      const regularTotal = regularSplits.reduce((s, r) => s + (r.weight > 0 ? r.weight : 0), 0)
      const regularByPlayer = new Map(regularSplits.map((r) => [r.personId, r]))

      const psPlayers = psTeam[kind] ?? []
      const psTotal = psPlayers.reduce((s, r) => s + (kind === 'hitting' ? r.pa : r.ip), 0)

      const allPersonIds = new Set([...regularByPlayer.keys(), ...psPlayers.map((p) => p.personId)])
      for (const personId of allPersonIds) {
        const reg = regularByPlayer.get(personId)
        const ps = psPlayers.find((p) => p.personId === personId)
        const regWeight = reg?.weight > 0 ? reg.weight : 0
        const psWeight = kind === 'hitting' ? ps?.pa ?? 0 : ps?.ip ?? 0
        const regularShare = regularTotal > 0 ? regWeight / regularTotal : 0
        const postseasonShare = psTotal > 0 ? psWeight / psTotal : 0
        if (regWeight === 0 && psWeight === 0) continue
        outliers.push({
          year: season.year,
          teamId: Number(teamId),
          personId,
          name: reg?.name ?? ps?.name ?? `#${personId}`,
          kind,
          regularShare,
          postseasonShare,
          mismatch: postseasonShare - regularShare,
        })
      }
    }

    // Postseason-actual age for this team: weight by POSTSEASON PA/IP, using
    // the regular-season cache purely as the age lookup (statsapi doesn't
    // report age on the boxscore endpoint).
    const raTeam = raSeason.teams[teamId]
    if (!raTeam) continue
    const ageFor = (group) => {
      const regularSplits = regularCache[`${group}-${teamId}-${season.year}`] ?? []
      const ageByPlayer = new Map(regularSplits.map((r) => [r.personId, r.age]))
      const psPlayers = psTeam[group === 'hitting' ? 'hitting' : 'pitching'] ?? []
      let weightSum = 0
      let ageWeightSum = 0
      for (const p of psPlayers) {
        const age = ageByPlayer.get(p.personId)
        const weight = group === 'hitting' ? p.pa : p.ip
        if (typeof age !== 'number' || weight <= 0) continue
        weightSum += weight
        ageWeightSum += age * weight
      }
      return weightSum > 0 ? ageWeightSum / weightSum : null
    }

    const postseasonBattingAge = ageFor('hitting')
    const postseasonPitchingAge = ageFor('pitching')
    const totalPostseasonIP = (psTeam.pitching ?? []).reduce((s, r) => s + r.ip, 0)
    teamPostseasonAge.push({
      year: season.year,
      teamId: Number(teamId),
      ladder: outcome.ladder,
      totalPostseasonIP,
      regularBattingAge: raTeam.battingAge,
      regularPitchingAge: raTeam.pitchingAge,
      postseasonBattingAge,
      postseasonPitchingAge,
      // Relative to the REGULAR-SEASON league average that year (larger,
      // more stable sample than trying to build a postseason-only league
      // average from a couple hundred playoff plate appearances).
      postseasonBattingAgeRel: postseasonBattingAge != null ? postseasonBattingAge - raSeason.leagueBattingAge : null,
      postseasonPitchingAgeRel:
        postseasonPitchingAge != null ? postseasonPitchingAge - raSeason.leaguePitchingAge : null,
    })
  }
}

console.log(`\n=== Postseason-actual age vs. regular-season age, ${teamPostseasonAge.length} playoff team-seasons ===`)
const deltas = teamPostseasonAge
  .filter((t) => t.postseasonBattingAge != null && t.postseasonPitchingAge != null)
  .map((t) => ({
    ...t,
    battingDelta: t.postseasonBattingAge - t.regularBattingAge,
    pitchingDelta: t.postseasonPitchingAge - t.regularPitchingAge,
  }))
console.log(
  `Mean (postseason age − regular-season age): batting ${mean(deltas.map((d) => d.battingDelta)).toFixed(3)}yr, ` +
    `pitching ${mean(deltas.map((d) => d.pitchingDelta)).toFixed(3)}yr`,
)
console.log(
  `(A number near zero means the players who actually played in October were, on average, the same age as the ` +
    `team's full-season roster — i.e. spike #1's age effect is not just deadline rentals who never got in a game.)`,
)

console.log('\n=== Does postseason-actual age still predict how far a team went? (playoff teams only) ===')
for (const key of ['postseasonBattingAgeRel', 'postseasonPitchingAgeRel']) {
  const rows = teamPostseasonAge.filter((t) => t[key] != null)
  const rho = spearman(
    rows.map((r) => r[key]),
    rows.map((r) => r.ladder),
  )
  const p = permutationTestWithinGroups(rows, key, 'ladder', 'year', rho)
  console.log(`  ${key}: rho=${rho.toFixed(4)} vs ladder (1-5, n=${rows.length}), permutation p=${p.toFixed(4)}`)
}

console.log('\n=== Biggest mismatches: played far more in October than regular-season role predicted ===')
const bySurge = [...outliers].sort((a, b) => b.mismatch - a.mismatch).slice(0, 15)
for (const o of bySurge) {
  console.log(
    `  ${o.year} ${o.teamId} ${o.name} (${o.kind}): regular share ${(o.regularShare * 100).toFixed(1)}% -> ` +
      `postseason share ${(o.postseasonShare * 100).toFixed(1)}%  (+${(o.mismatch * 100).toFixed(1)}pp)`,
  )
}

console.log('\n=== Biggest mismatches the other way: regulars who barely played in October ===')
const byDrop = [...outliers].sort((a, b) => a.mismatch - b.mismatch).slice(0, 15)
for (const o of byDrop) {
  console.log(
    `  ${o.year} ${o.teamId} ${o.name} (${o.kind}): regular share ${(o.regularShare * 100).toFixed(1)}% -> ` +
      `postseason share ${(o.postseasonShare * 100).toFixed(1)}%  (${(o.mismatch * 100).toFixed(1)}pp)`,
  )
}

console.log('\n=== Does relying on high-mismatch ("surprise") contributors associate with going further? ===')
const surpriseByTeam = new Map()
for (const o of outliers) {
  const key = `${o.year}-${o.teamId}`
  const cur = surpriseByTeam.get(key) ?? 0
  surpriseByTeam.set(key, cur + Math.max(0, o.mismatch))
}
const surpriseRows = teamPostseasonAge.map((t) => ({
  ...t,
  surpriseReliance: surpriseByTeam.get(`${t.year}-${t.teamId}`) ?? 0,
}))
const rhoSurpriseRaw = spearman(
  surpriseRows.map((r) => r.surpriseReliance),
  surpriseRows.map((r) => r.ladder),
)
const pSurpriseRaw = permutationTestWithinGroups(surpriseRows, 'surpriseReliance', 'ladder', 'year', rhoSurpriseRaw)
console.log(
  `  RAW: surpriseReliance (sum of positive mismatch shares) vs ladder: rho=${rhoSurpriseRaw.toFixed(4)}, ` +
    `permutation p=${pSurpriseRaw.toFixed(4)}, n=${surpriseRows.length}`,
)

// MECHANICAL CONFOUND CHECK: a "share of total postseason playing time" is
// measured over a denominator that IS the number of games/innings a team
// played — which correlates at rho≈0.91 with the ladder itself, by
// construction (win more rounds -> play more games). A team that lost in
// three games has a much lumpier, higher-variance share denominator than one
// that played twenty. That alone can produce a spurious relationship here.
const rhoVsIP = spearman(
  surpriseRows.map((r) => r.surpriseReliance),
  surpriseRows.map((r) => r.totalPostseasonIP),
)
console.log(
  `  Confound check: surpriseReliance vs. total postseason innings played: rho=${rhoVsIP.toFixed(4)} — ` +
    `if this is large, the RAW number above is suspect.`,
)
const rhoSurprisePartial = partialSpearman(
  surpriseRows.map((r) => r.surpriseReliance),
  surpriseRows.map((r) => r.ladder),
  surpriseRows.map((r) => r.totalPostseasonIP),
)
const pSurprisePartial = permutationTestPartialWithinGroups(
  surpriseRows,
  'surpriseReliance',
  'ladder',
  'totalPostseasonIP',
  'year',
  rhoSurprisePartial,
)
console.log(
  `  CONTROLLED for total postseason innings played: partial rho=${rhoSurprisePartial.toFixed(4)}, ` +
    `permutation p=${pSurprisePartial.toFixed(4)}`,
)
