// Spike #1: does roster age predict how far a team goes? Joins
// roster-age.json (built by build-roster-age.mjs) against
// outcome-ladder.json (built by build-outcome-ladder.mjs) and runs the
// checks docs/team-success-research.md commits every spike to: a
// same-season-relative measure (already baked into roster-age.json),
// a permutation test, and a leave-one-season-out stability check.
//
// 2020 is EXCLUDED from every headline number (pandemic-shortened season,
// expanded 16-team field — see docs/team-success-research.md, "The 2020
// problem") but included in one clearly-labeled sensitivity check at the end.
//
// Run: node .scratch/team-success/analyze-roster-age.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ladderData = JSON.parse(readFileSync(join(__dirname, 'outcome-ladder.json'), 'utf8'))
const ageData = JSON.parse(readFileSync(join(__dirname, 'roster-age.json'), 'utf8'))

const ageBySeason = new Map(ageData.seasons.map((s) => [s.year, s]))

function buildRows({ includeShortSeason }) {
  const rows = []
  for (const season of ladderData.seasons) {
    if (season.shortSeason && !includeShortSeason) continue
    const ageSeason = ageBySeason.get(season.year)
    if (!ageSeason) continue
    for (const [teamId, outcome] of Object.entries(season.teams)) {
      const age = ageSeason.teams[teamId]
      if (!age || age.battingAgeRelative == null || age.pitchingAgeRelative == null) continue
      rows.push({
        year: season.year,
        teamId: Number(teamId),
        ladder: outcome.ladder,
        madePostseason: outcome.madePostseason,
        wonDivision: outcome.wonDivision,
        battingAgeRelative: age.battingAgeRelative,
        pitchingAgeRelative: age.pitchingAgeRelative,
        rosterAgeRelative: (age.battingAgeRelative + age.pitchingAgeRelative) / 2,
      })
    }
  }
  return rows
}

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function sd(xs) {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
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

// Shuffle the outcome WITHIN each season (age-relative is already
// season-demeaned, so this preserves era/season structure while breaking
// any real link between a team's age and its own season's outcome).
function permutationTest(rows, valueKey, outcomeKey, observed, iterations = 5000) {
  const bySeason = new Map()
  for (const row of rows) {
    if (!bySeason.has(row.year)) bySeason.set(row.year, [])
    bySeason.get(row.year).push(row)
  }
  let atLeastAsExtreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const xs = []
    const ys = []
    for (const seasonRows of bySeason.values()) {
      const outcomes = seasonRows.map((r) => r[outcomeKey])
      for (let i = outcomes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]]
      }
      seasonRows.forEach((r, i) => {
        xs.push(r[valueKey])
        ys.push(outcomes[i])
      })
    }
    const stat = spearman(xs, ys)
    if (Math.abs(stat) >= Math.abs(observed)) atLeastAsExtreme++
  }
  return atLeastAsExtreme / iterations
}

function leaveOneSeasonOut(rows, valueKey, outcomeKey) {
  const years = [...new Set(rows.map((r) => r.year))]
  const results = []
  for (const year of years) {
    const subset = rows.filter((r) => r.year !== year)
    const r = spearman(
      subset.map((row) => row[valueKey]),
      subset.map((row) => row[outcomeKey]),
    )
    results.push(r)
  }
  return results
}

function meanDiff(rows, valueKey, groupKey) {
  const inGroup = rows.filter((r) => r[groupKey]).map((r) => r[valueKey])
  const outGroup = rows.filter((r) => !r[groupKey]).map((r) => r[valueKey])
  return { inGroup: mean(inGroup), outGroup: mean(outGroup), n: [inGroup.length, outGroup.length] }
}

function permutationTestMeanDiff(rows, valueKey, groupKey, observedDiff, iterations = 5000) {
  const bySeason = new Map()
  for (const row of rows) {
    if (!bySeason.has(row.year)) bySeason.set(row.year, [])
    bySeason.get(row.year).push(row)
  }
  let atLeastAsExtreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    let inSum = 0,
      inN = 0,
      outSum = 0,
      outN = 0
    for (const seasonRows of bySeason.values()) {
      const flags = seasonRows.map((r) => r[groupKey])
      for (let i = flags.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[flags[i], flags[j]] = [flags[j], flags[i]]
      }
      seasonRows.forEach((r, i) => {
        if (flags[i]) {
          inSum += r[valueKey]
          inN++
        } else {
          outSum += r[valueKey]
          outN++
        }
      })
    }
    const diff = inSum / inN - outSum / outN
    if (Math.abs(diff) >= Math.abs(observedDiff)) atLeastAsExtreme++
  }
  return atLeastAsExtreme / iterations
}

function report(rows, label) {
  console.log(`\n=== ${label} (n=${rows.length} team-seasons) ===`)

  for (const key of ['battingAgeRelative', 'pitchingAgeRelative', 'rosterAgeRelative']) {
    const ladders = rows.map((r) => r.ladder)
    const values = rows.map((r) => r[key])
    const rho = spearman(values, ladders)
    const p = permutationTest(rows, key, 'ladder', rho)
    const loso = leaveOneSeasonOut(rows, key, 'ladder')
    const sameSign = loso.filter((r) => Math.sign(r) === Math.sign(rho)).length
    console.log(
      `${key}: Spearman rho=${rho.toFixed(4)} vs ladder (0-5), permutation p=${p.toFixed(4)}, ` +
        `same-sign in ${sameSign}/${loso.length} leave-one-season-out refits ` +
        `(range ${Math.min(...loso).toFixed(4)} to ${Math.max(...loso).toFixed(4)})`,
    )
  }

  console.log('\nBand comparisons (mean age-relative, in years):')
  const bands = [
    ['made the postseason at all', (r) => r.ladder >= 1],
    ['reached the LCS or better', (r) => r.ladder >= 3],
    ['won the World Series', (r) => r.ladder === 5],
  ]
  for (const [bandLabel, pred] of bands) {
    for (const key of ['battingAgeRelative', 'pitchingAgeRelative']) {
      const flagged = rows.map((r) => ({ ...r, __flag: pred(r) }))
      const { inGroup, outGroup, n } = meanDiff(flagged, key, '__flag')
      const diff = inGroup - outGroup
      const p = permutationTestMeanDiff(flagged, key, '__flag', diff)
      console.log(
        `  ${bandLabel} (${key}): ${inGroup >= 0 ? '+' : ''}${inGroup.toFixed(2)}yr (n=${n[0]}) vs ` +
          `${outGroup >= 0 ? '+' : ''}${outGroup.toFixed(2)}yr (n=${n[1]}) — diff ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}yr, permutation p=${p.toFixed(4)}`,
      )
    }
  }

  console.log('\nDivision winners vs. everyone else who made the postseason:')
  const postseasonRows = rows.filter((r) => r.madePostseason)
  for (const key of ['battingAgeRelative', 'pitchingAgeRelative']) {
    const flagged = postseasonRows.map((r) => ({ ...r, __flag: r.wonDivision }))
    const { inGroup, outGroup, n } = meanDiff(flagged, key, '__flag')
    const diff = inGroup - outGroup
    const p = permutationTestMeanDiff(flagged, key, '__flag', diff)
    console.log(
      `  wonDivision (${key}): ${inGroup >= 0 ? '+' : ''}${inGroup.toFixed(2)}yr (n=${n[0]}) vs ` +
        `${outGroup >= 0 ? '+' : ''}${outGroup.toFixed(2)}yr (n=${n[1]}) — diff ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}yr, permutation p=${p.toFixed(4)}`,
    )
  }

  console.log('\nSample stats (relative-age spread across all rows):')
  for (const key of ['battingAgeRelative', 'pitchingAgeRelative']) {
    const values = rows.map((r) => r[key])
    console.log(`  ${key}: mean=${mean(values).toFixed(3)} sd=${sd(values).toFixed(3)}`)
  }
}

const primary = buildRows({ includeShortSeason: false })
report(primary, '2000-2025 excluding 2020')

const withShort = buildRows({ includeShortSeason: true })
report(withShort, 'Sensitivity check: 2020 included')
