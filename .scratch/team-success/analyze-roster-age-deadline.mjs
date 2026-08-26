// Follow-up to spike #1 (docs/team-success-roster-age.md): does the roster-
// age effect survive when trade-deadline pickups are excluded? Joins
// roster-age-deadline.json (PA/IP through July 31 only) against
// outcome-ladder.json and runs the exact same checks the original spike
// used — same-season-relative measure, Spearman rho, a within-season
// permutation test, and leave-one-season-out — so the two coefficients are
// directly comparable. Also loads roster-age.json (the original, whole-
// season measure) so the two can be reported side by side from one script,
// on the identical row set.
//
// 2020 is EXCLUDED from every headline number (pandemic-shortened season,
// expanded 16-team field), included in one labeled sensitivity check.
//
// Run: node .scratch/team-success/analyze-roster-age-deadline.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ladderData = JSON.parse(readFileSync(join(__dirname, 'outcome-ladder.json'), 'utf8'))
const deadlineData = JSON.parse(readFileSync(join(__dirname, 'roster-age-deadline.json'), 'utf8'))
const fullSeasonData = JSON.parse(readFileSync(join(__dirname, 'roster-age.json'), 'utf8'))

const deadlineBySeason = new Map(deadlineData.seasons.map((s) => [s.year, s]))
const fullSeasonBySeason = new Map(fullSeasonData.seasons.map((s) => [s.year, s]))

function buildRows({ includeShortSeason }) {
  const rows = []
  for (const season of ladderData.seasons) {
    if (season.shortSeason && !includeShortSeason) continue
    const deadlineSeason = deadlineBySeason.get(season.year)
    const fullSeason = fullSeasonBySeason.get(season.year)
    if (!deadlineSeason || !fullSeason) continue
    for (const [teamId, outcome] of Object.entries(season.teams)) {
      const dl = deadlineSeason.teams[teamId]
      const fs = fullSeason.teams[teamId]
      if (!dl || dl.battingAgeRelative == null || dl.pitchingAgeRelative == null) continue
      if (!fs || fs.battingAgeRelative == null || fs.pitchingAgeRelative == null) continue
      rows.push({
        year: season.year,
        teamId: Number(teamId),
        ladder: outcome.ladder,
        madePostseason: outcome.madePostseason,
        wonDivision: outcome.wonDivision,
        // Pre-deadline (through July 31), the question this spike asks:
        battingAgeRelative: dl.battingAgeRelative,
        pitchingAgeRelative: dl.pitchingAgeRelative,
        rosterAgeRelative: (dl.battingAgeRelative + dl.pitchingAgeRelative) / 2,
        // Whole-season, from spike #1, carried on the SAME rows for a direct
        // paired comparison rather than a re-read of the published doc:
        fsBattingAgeRelative: fs.battingAgeRelative,
        fsPitchingAgeRelative: fs.pitchingAgeRelative,
        fsRosterAgeRelative: (fs.battingAgeRelative + fs.pitchingAgeRelative) / 2,
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

// Shuffle the outcome WITHIN each season, same as spike #1.
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

// Wilcoxon signed-rank test (paired, two-sided, normal approximation) — used
// once, to test whether the pre-deadline and whole-season age numbers differ
// from each other ACROSS THE SAME 750 ROWS, not just eyeball two Spearman
// rhos computed from different columns.
function wilcoxonSignedRank(xs, ys) {
  const diffs = xs.map((x, i) => x - ys[i]).filter((d) => d !== 0)
  const n = diffs.length
  const absDiffs = diffs.map(Math.abs)
  const ranks = rank(absDiffs)
  let wPlus = 0
  let wMinus = 0
  diffs.forEach((d, i) => {
    if (d > 0) wPlus += ranks[i]
    else wMinus += ranks[i]
  })
  const W = Math.min(wPlus, wMinus)
  const meanW = (n * (n + 1)) / 4
  const sdW = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24)
  const z = (W - meanW) / sdW
  // two-sided p from the standard normal CDF via erf approximation
  const p = 2 * (1 - normalCdf(Math.abs(z)))
  return { n, wPlus, wMinus, z, p }
}
function normalCdf(z) {
  // Abramowitz-Stegun erf approximation
  const t = 1 / (1 + 0.3275911 * Math.abs(z))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-Math.abs(z) * Math.abs(z))
  const erf = z < 0 ? -y : y
  return 0.5 * (1 + erf)
}

function reportAgeMeasure(rows, key, label) {
  const ladders = rows.map((r) => r.ladder)
  const values = rows.map((r) => r[key])
  const rho = spearman(values, ladders)
  const p = permutationTest(rows, key, 'ladder', rho)
  const loso = leaveOneSeasonOut(rows, key, 'ladder')
  const sameSign = loso.filter((r) => Math.sign(r) === Math.sign(rho)).length
  console.log(
    `  ${label}: Spearman rho=${rho.toFixed(4)} vs ladder (0-5), permutation p=${p.toFixed(4)}, ` +
      `same-sign in ${sameSign}/${loso.length} leave-one-season-out refits ` +
      `(range ${Math.min(...loso).toFixed(4)} to ${Math.max(...loso).toFixed(4)})`,
  )
  return { rho, p, sameSign, loso: loso.length }
}

// Block-bootstrap (resample whole SEASONS with replacement, keep every team
// within a drawn season) the DIFFERENCE between the whole-season rho and the
// pre-deadline rho, to put an interval on the gap itself rather than just
// eyeballing two point estimates computed from different columns on the
// same rows.
function bootstrapRhoGap(rows, dlKey, fsKey, iterations = 2000) {
  const bySeason = new Map()
  for (const row of rows) {
    if (!bySeason.has(row.year)) bySeason.set(row.year, [])
    bySeason.get(row.year).push(row)
  }
  const years = [...bySeason.keys()]
  const gaps = []
  for (let iter = 0; iter < iterations; iter++) {
    const sample = []
    for (let i = 0; i < years.length; i++) {
      const pick = years[Math.floor(Math.random() * years.length)]
      sample.push(...bySeason.get(pick))
    }
    const ladders = sample.map((r) => r.ladder)
    const rhoDl = spearman(
      sample.map((r) => r[dlKey]),
      ladders,
    )
    const rhoFs = spearman(
      sample.map((r) => r[fsKey]),
      ladders,
    )
    gaps.push(rhoFs - rhoDl)
  }
  gaps.sort((a, b) => a - b)
  const lo = gaps[Math.floor(0.025 * iterations)]
  const hi = gaps[Math.floor(0.975 * iterations)]
  const excludesZero = lo > 0 || hi < 0
  return { mean: mean(gaps), lo, hi, excludesZero }
}

function report(rows, label) {
  console.log(`\n=== ${label} (n=${rows.length} team-seasons) ===`)

  console.log('\nPre-deadline (through July 31) age vs. ladder:')
  const preDeadline = {}
  for (const key of ['battingAgeRelative', 'pitchingAgeRelative', 'rosterAgeRelative']) {
    preDeadline[key] = reportAgeMeasure(rows, key, key)
  }

  console.log('\nWhole-season age vs. ladder (spike #1, recomputed on this same row set):')
  const wholeSeason = {}
  for (const key of ['fsBattingAgeRelative', 'fsPitchingAgeRelative', 'fsRosterAgeRelative']) {
    wholeSeason[key] = reportAgeMeasure(rows, key, key)
  }

  console.log('\nDirect comparison (pre-deadline rho vs. whole-season rho, same rows):')
  const pairs = [
    ['battingAgeRelative', 'fsBattingAgeRelative', 'batting'],
    ['pitchingAgeRelative', 'fsPitchingAgeRelative', 'pitching'],
    ['rosterAgeRelative', 'fsRosterAgeRelative', 'roster (mean of both)'],
  ]
  for (const [dlKey, fsKey, name] of pairs) {
    const dl = preDeadline[dlKey]
    const fs = wholeSeason[fsKey]
    const retained = (100 * dl.rho) / fs.rho
    console.log(
      `  ${name}: pre-deadline rho=${dl.rho.toFixed(4)} vs whole-season rho=${fs.rho.toFixed(4)} ` +
        `(${retained.toFixed(0)}% of the whole-season effect size retained)`,
    )
  }

  console.log('\nBlock-bootstrap (season-level, 2000 draws) on the GAP itself (whole-season rho')
  console.log('minus pre-deadline rho), 95% interval:')
  for (const [dlKey, fsKey, name] of pairs) {
    const boot = bootstrapRhoGap(rows, dlKey, fsKey)
    console.log(
      `  ${name}: gap mean=${boot.mean.toFixed(4)}, 95% CI [${boot.lo.toFixed(4)}, ${boot.hi.toFixed(4)}]` +
        `${boot.excludesZero ? ' — excludes zero' : ' — does NOT exclude zero'}`,
    )
  }

  console.log('\nWilcoxon signed-rank test: does excluding deadline additions shift a team\'s')
  console.log('measured age (paired, same 750 team-seasons, pre-deadline vs. whole-season)?')
  for (const [dlKey, fsKey, name] of [
    ['battingAgeRelative', 'fsBattingAgeRelative', 'batting'],
    ['pitchingAgeRelative', 'fsPitchingAgeRelative', 'pitching'],
  ]) {
    const dlValues = rows.map((r) => r[dlKey])
    const fsValues = rows.map((r) => r[fsKey])
    const meanShift = mean(fsValues) - mean(dlValues)
    const w = wilcoxonSignedRank(fsValues, dlValues)
    console.log(
      `  ${name}: whole-season minus pre-deadline mean shift = ${meanShift >= 0 ? '+' : ''}${meanShift.toFixed(4)}yr, ` +
        `Wilcoxon z=${w.z.toFixed(3)}, p=${w.p.toFixed(4)} (n=${w.n})`,
    )
  }

  console.log('\nBand comparisons, pre-deadline age (mean age-relative, in years):')
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

  console.log('\nDivision winners vs. everyone else who made the postseason, pre-deadline age:')
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
    console.log(`  pre-deadline ${key}: mean=${mean(values).toFixed(3)} sd=${sd(values).toFixed(3)}`)
  }
}

const primary = buildRows({ includeShortSeason: false })
report(primary, '2000-2025 excluding 2020')

const withShort = buildRows({ includeShortSeason: true })
report(withShort, 'Sensitivity check: 2020 included')
