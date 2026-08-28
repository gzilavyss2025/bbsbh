// Analysis for the extension-value spike (W3.3). Reads the panels
// build-panel.mjs writes and prints every number docs/contracts-extension-value.md
// cites. Re-run any time after build-panel.mjs: `node
// .scratch/contracts-extensions/analyze-extension-value.mjs`.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCsv, REPO_ROOT } from './lib.mjs'
import { normalizePosition } from '../../src/lib/contracts/positions.js'
import { splitExecutiveCell, buildCanonicalizer } from './gmNames.mjs'

const DIR = join(REPO_ROOT, '.scratch', 'contracts-extensions')
const panel = JSON.parse(readFileSync(join(DIR, 'extension-outcomes.json'), 'utf8'))
const pricePanel = JSON.parse(readFileSync(join(DIR, 'fa-war-price.json'), 'utf8'))
const rows = panel.outcomes

function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  if (n === 0) return null
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}
function pct(n, d) {
  return d === 0 ? null : (100 * n) / d
}
function rankOf(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
  const ranks = new Array(arr.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k += 1) ranks[idx[k][1]] = avgRank
    i = j + 1
  }
  return ranks
}
function pearson(a, b) {
  const n = a.length
  const ma = mean(a)
  const mb = mean(b)
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < n; i += 1) {
    cov += (a[i] - ma) * (b[i] - mb)
    va += (a[i] - ma) ** 2
    vb += (b[i] - mb) ** 2
  }
  return cov / Math.sqrt(va * vb)
}
function spearman(a, b) {
  return pearson(rankOf(a), rankOf(b))
}

console.log('='.repeat(78))
console.log('EXTENSION VALUE SPIKE -- headline numbers')
console.log('='.repeat(78))
console.log(`extensions.csv rows: ${panel.counts.extensionsCsvRows}`)
console.log('exclusions:', panel.counts)
console.log(`scored n = ${rows.length}`)

const signYears = rows.map((r) => Number(String(r.signedDate ?? '').slice(0, 4))).filter(Number.isFinite)
console.log(`signing years in SCORED subset: ${Math.min(...signYears)}-${Math.max(...signYears)}`)

// ---------------------------------------------------------------------------
// The price-of-a-win choice, stated up front.
// ---------------------------------------------------------------------------
const sumG = rows.reduce((a, r) => a + r.guarantee, 0)
const sumMVSlope = rows.reduce((a, r) => a + r.marketValueSlope, 0)
const sumMVRatio = rows.reduce((a, r) => a + r.marketValueRatio, 0)
const winsSlope = rows.filter((r) => r.surplusSlope > 0).length
const winsRatio = rows.filter((r) => r.surplusRatio > 0).length

console.log('\n--- PRICE OF A WIN: two season-specific estimates from free_agency.csv ---')
console.log(`  RATIO  (sum AAV / sum WAR delivered, per signing-performance-season): PRIMARY`)
console.log(`  SLOPE  (OLS AAV ~ WAR within season, marginal price net of replacement pay): ALTERNATIVE`)
console.log(`Total guarantee committed (scored n=${rows.length}): $${(sumG / 1e9).toFixed(2)}B`)
console.log(`Total market value of delivered WAR -- RATIO pricing: $${(sumMVRatio / 1e9).toFixed(2)}B  (club wins ${winsRatio}/${rows.length} = ${pct(winsRatio, rows.length).toFixed(1)}%)`)
console.log(`Total market value of delivered WAR -- SLOPE pricing: $${(sumMVSlope / 1e9).toFixed(2)}B  (club wins ${winsSlope}/${rows.length} = ${pct(winsSlope, rows.length).toFixed(1)}%)`)
console.log(`Median surplus/guarantee (RATIO): ${(median(rows.map((r) => r.surplusRatio / r.guarantee)) * 100).toFixed(1)}%`)
console.log(`Median surplus/guarantee (SLOPE): ${(median(rows.map((r) => r.surplusSlope / r.guarantee)) * 100).toFixed(1)}%`)

// ---------------------------------------------------------------------------
// 2020 era anomaly: shortened season inflates both price estimates because
// AAV is not pro-rated to the 60-game schedule the way WAR naturally is.
// ---------------------------------------------------------------------------
const touch2020 = rows.filter((r) => r.firstYear <= 2020 && r.finalYear >= 2020)
console.log(`\n--- ERA CHECK: 2020 (60-game season) ---`)
console.log(`Extensions whose window includes 2020: ${touch2020.length} of ${rows.length}`)
console.log(`2020 FA price panel: n=${pricePanel.bySeason['2020'].n}, ratio=$${(pricePanel.bySeason['2020'].ratioDollarsPerWar / 1e6).toFixed(2)}M/WAR, slope=$${(pricePanel.bySeason['2020'].slopeDollarsPerWar / 1e6).toFixed(2)}M/WAR`)
const nextHighestRatio = Math.max(
  ...Object.entries(pricePanel.bySeason)
    .filter(([s]) => s !== '2020')
    .map(([, v]) => v.ratioDollarsPerWar),
)
console.log(`Next-highest season ratio (excluding 2020): $${(nextHighestRatio / 1e6).toFixed(2)}M/WAR -- 2020 is an outlier by construction (full-season AAV against a 60-game WAR denominator), not a real market move.`)
// Sensitivity: rescore with 2020 treated as unpriced (its price is untrustworthy).
let sensSlope = 0
let sensRatio = 0
for (const r of rows) {
  let mvS = r.marketValueSlope
  let mvR = r.marketValueRatio
  const season2020 = r.perSeason.find((p) => p.season === 2020 && p.priced)
  if (season2020) {
    mvS -= season2020.slopeValue
    mvR -= season2020.ratioValue
  }
  if (mvR - r.guarantee > 0) sensRatio += 1
  if (mvS - r.guarantee > 0) sensSlope += 1
}
console.log(`With 2020 excluded from pricing entirely: club wins RATIO ${sensRatio}/${rows.length} (${pct(sensRatio, rows.length).toFixed(1)}%), SLOPE ${sensSlope}/${rows.length} (${pct(sensSlope, rows.length).toFixed(1)}%) -- vs. ${pct(winsRatio, rows.length).toFixed(1)}%/${pct(winsSlope, rows.length).toFixed(1)}% with 2020 priced as-is.`)

// ---------------------------------------------------------------------------
// Cut 1: service time at signing.
// ---------------------------------------------------------------------------
function serviceBucket(mls) {
  if (mls == null) return 'unknown'
  if (mls < 2) return 'pre-arb (<2 yrs)'
  if (mls < 5) return 'arb-era (2-<5 yrs)'
  return 'FA-era (>=5 yrs)'
}
console.log('\n--- CUT 1: service time at signing ---')
const byService = new Map()
for (const r of rows) {
  const b = serviceBucket(r.serviceTimeAtSigning)
  if (!byService.has(b)) byService.set(b, [])
  byService.get(b).push(r)
}
for (const [bucket, rs] of byService) {
  const w = rs.filter((r) => r.surplusRatio > 0).length
  const wS = rs.filter((r) => r.surplusSlope > 0).length
  console.log(
    `${bucket}: n=${rs.length}, club-win RATIO=${pct(w, rs.length).toFixed(1)}%, club-win SLOPE=${pct(wS, rs.length).toFixed(1)}%, median surplus/guarantee RATIO=${(median(rs.map((r) => r.surplusRatio / r.guarantee)) * 100).toFixed(1)}%, median guarantee=$${(median(rs.map((r) => r.guarantee)) / 1e6).toFixed(1)}M`,
  )
}

// ---------------------------------------------------------------------------
// Cut 2: age at signing.
// ---------------------------------------------------------------------------
function ageBucket(age) {
  if (age == null) return 'unknown'
  if (age <= 25) return '<=25'
  if (age <= 29) return '26-29'
  if (age <= 33) return '30-33'
  return '34+'
}
console.log('\n--- CUT 2: age at signing ---')
const byAge = new Map()
for (const r of rows) {
  const b = ageBucket(r.ageAtSigning)
  if (!byAge.has(b)) byAge.set(b, [])
  byAge.get(b).push(r)
}
for (const bucket of ['<=25', '26-29', '30-33', '34+', 'unknown']) {
  const rs = byAge.get(bucket)
  if (!rs) continue
  const w = rs.filter((r) => r.surplusRatio > 0).length
  const wS = rs.filter((r) => r.surplusSlope > 0).length
  console.log(
    `${bucket}: n=${rs.length}, club-win RATIO=${pct(w, rs.length).toFixed(1)}%, club-win SLOPE=${pct(wS, rs.length).toFixed(1)}%, median surplus/guarantee RATIO=${(median(rs.map((r) => r.surplusRatio / r.guarantee)) * 100).toFixed(1)}%`,
  )
}

// ---------------------------------------------------------------------------
// Cut 3: position -- hitters vs. pitchers.
// ---------------------------------------------------------------------------
console.log('\n--- CUT 3: hitters vs. pitchers ---')
const PITCHER_CODES = new Set(['P', 'RHP', 'LHP', 'SP', 'RP'])
function isPitcher(positionCell) {
  const { primary } = normalizePosition(positionCell)
  return PITCHER_CODES.has(primary)
}
const pitchers = rows.filter((r) => isPitcher(r.position))
const hitters = rows.filter((r) => !isPitcher(r.position) && normalizePosition(r.position).primary !== 'unknown')
const unknownPos = rows.length - pitchers.length - hitters.length
console.log(`pitchers n=${pitchers.length}, hitters n=${hitters.length}, unresolved position n=${unknownPos}`)
for (const [label, rs] of [
  ['pitchers', pitchers],
  ['hitters', hitters],
]) {
  const w = rs.filter((r) => r.surplusRatio > 0).length
  const wS = rs.filter((r) => r.surplusSlope > 0).length
  console.log(
    `${label}: n=${rs.length}, club-win RATIO=${pct(w, rs.length).toFixed(1)}%, club-win SLOPE=${pct(wS, rs.length).toFixed(1)}%, median surplus/guarantee RATIO=${(median(rs.map((r) => r.surplusRatio / r.guarantee)) * 100).toFixed(1)}%, median surplus/guarantee SLOPE=${(median(rs.map((r) => r.surplusSlope / r.guarantee)) * 100).toFixed(1)}%`,
  )
}

// ---------------------------------------------------------------------------
// Leave-one-signing-year-out: how much does the headline club-win rate move?
// ---------------------------------------------------------------------------
console.log('\n--- LEAVE-ONE-SIGNING-YEAR-OUT (headline club-win rate, both pricings) ---')
const withSignYear = rows
  .map((r) => ({ ...r, signYear: Number(String(r.signedDate ?? '').slice(0, 4)) }))
  .filter((r) => Number.isFinite(r.signYear))
const signYearSet = [...new Set(withSignYear.map((r) => r.signYear))].sort((a, b) => a - b)
let looRatioRange = [Infinity, -Infinity]
let looSlopeRange = [Infinity, -Infinity]
for (const y of signYearSet) {
  const subset = withSignYear.filter((r) => r.signYear !== y)
  const wR = pct(subset.filter((r) => r.surplusRatio > 0).length, subset.length)
  const wS = pct(subset.filter((r) => r.surplusSlope > 0).length, subset.length)
  looRatioRange = [Math.min(looRatioRange[0], wR), Math.max(looRatioRange[1], wR)]
  looSlopeRange = [Math.min(looSlopeRange[0], wS), Math.max(looSlopeRange[1], wS)]
}
console.log(`${signYearSet.length} signing years refit (dropping one at a time).`)
console.log(`RATIO club-win% range across refits: [${looRatioRange[0].toFixed(1)}%, ${looRatioRange[1].toFixed(1)}%] (full-sample: ${pct(winsRatio, rows.length).toFixed(1)}%)`)
console.log(`SLOPE club-win% range across refits: [${looSlopeRange[0].toFixed(1)}%, ${looSlopeRange[1].toFixed(1)}%] (full-sample: ${pct(winsSlope, rows.length).toFixed(1)}%)`)

// ---------------------------------------------------------------------------
// Front-office axis: canonicalized GM.
// ---------------------------------------------------------------------------
console.log('\n--- FRONT-OFFICE AXIS: gm ---')
const rawExtRows = loadCsv('extensions')
const allFragments = new Set()
for (const r of rawExtRows) if (r.gm) for (const f of splitExecutiveCell(r.gm)) allFragments.add(f)
const canonicalize = buildCanonicalizer([...allFragments])

const byGm = new Map() // canonical name -> rows (one row credited per gm on a joint cell)
for (const r of rows) {
  const rawGm = rawExtRows[Number(r.rowKey.split('#')[1])].gm
  for (const frag of splitExecutiveCell(rawGm)) {
    const canon = canonicalize(frag)
    if (!byGm.has(canon)) byGm.set(canon, [])
    byGm.get(canon).push(r)
  }
}
const GM_MIN_N = 8
const gmAgg = [...byGm.entries()]
  .filter(([, rs]) => rs.length >= GM_MIN_N)
  .map(([name, rs]) => ({
    name,
    n: rs.length,
    medianServiceTime: median(rs.map((r) => r.serviceTimeAtSigning).filter((v) => v != null)),
    medianSurplusPerDollarRatio: median(rs.map((r) => r.surplusRatio / r.guarantee)),
    medianSurplusPerDollarSlope: median(rs.map((r) => r.surplusSlope / r.guarantee)),
    winRateRatio: pct(rs.filter((r) => r.surplusRatio > 0).length, rs.length),
  }))
  .sort((a, b) => a.medianServiceTime - b.medianServiceTime)
console.log(`Canonicalized to ${byGm.size} distinct executives across ${rows.length} scored extensions; ${gmAgg.length} clear the n>=${GM_MIN_N} reporting floor.`)
for (const g of gmAgg) {
  console.log(
    `  ${g.name}: n=${g.n}, median service time at signing=${g.medianServiceTime.toFixed(2)}, club-win% (RATIO)=${g.winRateRatio.toFixed(0)}%, median surplus/$ (RATIO)=${(g.medianSurplusPerDollarRatio * 100).toFixed(0)}%, median surplus/$ (SLOPE)=${(g.medianSurplusPerDollarSlope * 100).toFixed(0)}%`,
  )
}
if (gmAgg.length >= 4) {
  const rho = spearman(
    gmAgg.map((g) => g.medianServiceTime),
    gmAgg.map((g) => g.medianSurplusPerDollarRatio),
  )
  console.log(`\nAcross ${gmAgg.length} executives (n>=${GM_MIN_N} each): Spearman(median service time at signing, median surplus/$ under RATIO) = ${rho.toFixed(4)}`)
  const rhoSlope = spearman(
    gmAgg.map((g) => g.medianServiceTime),
    gmAgg.map((g) => g.medianSurplusPerDollarSlope),
  )
  console.log(`Same executives, SLOPE pricing: Spearman = ${rhoSlope.toFixed(4)}`)
}

console.log('\nDone.')

// ---------------------------------------------------------------------------
// Continuous, row-level tests underlying cuts 1-3, with permutation p-values
// and leave-one-signing-year-out survival counts.
// ---------------------------------------------------------------------------
function seedRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function permutationTest(a, b, rng, n = 5000) {
  const rho0 = spearman(a, b)
  let countGE = 0
  const bCopy = [...b]
  for (let p = 0; p < n; p += 1) {
    for (let i = bCopy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[bCopy[i], bCopy[j]] = [bCopy[j], bCopy[i]]
    }
    const r = spearman(a, bCopy)
    if (Math.abs(r) >= Math.abs(rho0)) countGE += 1
  }
  return { rho: rho0, p: countGE / n }
}

console.log('\n--- ROW-LEVEL CONTINUOUS TESTS (n=864, permutation p over 5000 shuffles) ---')
const rng1 = seedRandom(20260828)
const serviceArr = rows.map((r) => r.serviceTimeAtSigning ?? 0)
const ageArr = rows.map((r) => r.ageAtSigning ?? 0)
const surplusPerDollarRatio = rows.map((r) => r.surplusRatio / r.guarantee)
const surplusPerDollarSlope = rows.map((r) => r.surplusSlope / r.guarantee)

for (const [label, xArr] of [
  ['service time at signing', serviceArr],
  ['age at signing', ageArr],
]) {
  const testRatio = permutationTest(xArr, surplusPerDollarRatio, rng1)
  const testSlope = permutationTest(xArr, surplusPerDollarSlope, rng1)
  console.log(`Spearman(${label}, surplus/$ RATIO) = ${testRatio.rho.toFixed(4)}, p=${testRatio.p.toFixed(4)}`)
  console.log(`Spearman(${label}, surplus/$ SLOPE) = ${testSlope.rho.toFixed(4)}, p=${testSlope.p.toFixed(4)}`)
}

// Leave-one-signing-year-out survival: does the SIGN of Spearman(service
// time, surplus/$) survive dropping each signing year?
function looSurvival(xKey, yArr) {
  let survivedRatio = 0
  let survivedSlope = 0
  const baseRatioSign = Math.sign(spearman(withSignYear.map((r) => r[xKey] ?? 0), withSignYear.map((r) => r.surplusRatio / r.guarantee)))
  const baseSlopeSign = Math.sign(spearman(withSignYear.map((r) => r[xKey] ?? 0), withSignYear.map((r) => r.surplusSlope / r.guarantee)))
  for (const y of signYearSet) {
    const subset = withSignYear.filter((r) => r.signYear !== y)
    const rhoR = spearman(subset.map((r) => r[xKey] ?? 0), subset.map((r) => r.surplusRatio / r.guarantee))
    const rhoS = spearman(subset.map((r) => r[xKey] ?? 0), subset.map((r) => r.surplusSlope / r.guarantee))
    if (Math.sign(rhoR) === baseRatioSign) survivedRatio += 1
    if (Math.sign(rhoS) === baseSlopeSign) survivedSlope += 1
  }
  return { survivedRatio, survivedSlope, total: signYearSet.length, baseRatioSign, baseSlopeSign }
}
const serviceLoo = looSurvival('serviceTimeAtSigning', surplusPerDollarRatio)
console.log(`\nLeave-one-signing-year-out (${serviceLoo.total} refits), Spearman(service time, surplus/$) sign survives:`)
console.log(`  RATIO: ${serviceLoo.survivedRatio}/${serviceLoo.total} (base sign ${serviceLoo.baseRatioSign})`)
console.log(`  SLOPE: ${serviceLoo.survivedSlope}/${serviceLoo.total} (base sign ${serviceLoo.baseSlopeSign})`)
const ageLoo = looSurvival('ageAtSigning', surplusPerDollarRatio)
console.log(`Leave-one-signing-year-out (${ageLoo.total} refits), Spearman(age, surplus/$) sign survives:`)
console.log(`  RATIO: ${ageLoo.survivedRatio}/${ageLoo.total} (base sign ${ageLoo.baseRatioSign})`)
console.log(`  SLOPE: ${ageLoo.survivedSlope}/${ageLoo.total} (base sign ${ageLoo.baseSlopeSign})`)

// Pitchers vs hitters: permutation test on the group-label shuffle for
// median surplus/$ difference (RATIO and SLOPE).
console.log('\n--- PITCHER VS HITTER: permutation test on the surplus/$ gap ---')
function groupGapPermutation(rowsAll, isPitcherFn, valueFn, rng, n = 5000) {
  const labels = rowsAll.map(isPitcherFn)
  const values = rowsAll.map(valueFn)
  const meanP = mean(values.filter((_, i) => labels[i]))
  const meanH = mean(values.filter((_, i) => !labels[i]))
  const obsGap = meanH - meanP // positive means hitters do better for the club
  let countGE = 0
  const labelsCopy = [...labels]
  for (let p = 0; p < n; p += 1) {
    for (let i = labelsCopy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[labelsCopy[i], labelsCopy[j]] = [labelsCopy[j], labelsCopy[i]]
    }
    const mP = mean(values.filter((_, i) => labelsCopy[i]))
    const mH = mean(values.filter((_, i) => !labelsCopy[i]))
    if (Math.abs(mH - mP) >= Math.abs(obsGap)) countGE += 1
  }
  return { meanP, meanH, obsGap, p: countGE / n }
}
const rng2 = seedRandom(20260828)
const pitcherFlags = rows.map((r) => isPitcher(r.position))
const gapRatio = groupGapPermutation(rows, (r) => isPitcher(r.position), (r) => r.surplusRatio / r.guarantee, rng2)
const gapSlope = groupGapPermutation(rows, (r) => isPitcher(r.position), (r) => r.surplusSlope / r.guarantee, rng2)
console.log(`RATIO: mean surplus/$ hitters=${(gapRatio.meanH * 100).toFixed(1)}%, pitchers=${(gapRatio.meanP * 100).toFixed(1)}%, gap=${(gapRatio.obsGap * 100).toFixed(1)}pp, permutation p=${gapRatio.p.toFixed(4)}`)
console.log(`SLOPE: mean surplus/$ hitters=${(gapSlope.meanH * 100).toFixed(1)}%, pitchers=${(gapSlope.meanP * 100).toFixed(1)}%, gap=${(gapSlope.obsGap * 100).toFixed(1)}pp, permutation p=${gapSlope.p.toFixed(4)}`)

// GM-axis correlation, permutation test (small n=39, so treat cautiously).
console.log('\n--- GM AXIS: permutation test on service-time/surplus correlation across executives ---')
const rng3 = seedRandom(20260828)
const gmService = gmAgg.map((g) => g.medianServiceTime)
const gmSurplusRatio = gmAgg.map((g) => g.medianSurplusPerDollarRatio)
const gmTest = permutationTest(gmService, gmSurplusRatio, rng3)
console.log(`Spearman(GM median service time, GM median surplus/$ RATIO), n=${gmAgg.length} executives: rho=${gmTest.rho.toFixed(4)}, permutation p=${gmTest.p.toFixed(4)}`)

console.log('\nDone (extended tests).')
