// Spike: does the free-agent market pay for what it gets?
//
// Reads .scratch/team-success/free-agency-market.json (built by
// build-free-agency-market.mjs) and answers the four questions the spike was
// commissioned with: past-vs-future WAR pricing, where the overpay concentrates,
// whether a long deal's last year returns less than its first, and whether an
// agency's clients sign for more holding the player fixed. A fifth section
// checks whether changing clubs pays.
//
// STATS LIBRARY: mean/rank/pearson/spearman/ols/residualise/permutation
// helpers are the same shapes as .scratch/team-success/analyze-postseason-
// experience.mjs uses (that file is the house template for this program,
// per docs/team-success-research.md) -- re-typed here rather than imported
// because that file exports nothing; `partialSpearmanCols` is new, needed
// for the agent-axis question, which controls on a POSITION GROUP (a
// category, not a rank) that the original `partialSpearman` has no way to
// take as a control.
//
// DOLLAR NORMALIZATION: this file compares dollars ACROSS 1991-2026, and
// there is no inflation index anywhere in this repo (docs/team-success-
// research.md already flags a historical PAYROLL series as "blocked on a
// data source" for the identical reason -- pulling one in would be new,
// unscoped work for a research spike). Every dollar comparison below uses
// aavIndex = a signing's AAV divided by THAT SAME YEAR's median AAV among
// usable rows -- a dimensionless "how many times the going rate" figure
// that needs no external price level. This is the "index to that
// offseason's mean" option the spike brief offered as an alternative to
// deflating; deflation was not attempted, for the reason above.
//
// Run: node .scratch/team-success/analyze-free-agency-market.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const panel = JSON.parse(readFileSync(join(__dirname, 'free-agency-market.json'), 'utf8'))
const players = panel.players

// ------------------------------------------------------------ stats library
function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
function rank(xs) {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b])
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
function shuffle(a) {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
function ols(X, y) {
  const n = X.length
  const k = X[0].length
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0))
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      let s = 0
      for (let i = 0; i < n; i++) s += X[i][a] * X[i][b]
      A[a][b] = s
    }
    let s = 0
    for (let i = 0; i < n; i++) s += X[i][a] * y[i]
    A[a][k] = s
  }
  for (let col = 0; col < k; col++) {
    let piv = col
    for (let r = col + 1; r < k; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    ;[A[col], A[piv]] = [A[piv], A[col]]
    if (Math.abs(A[col][col]) < 1e-12) continue
    for (let r = 0; r < k; r++) {
      if (r === col) continue
      const f = A[r][col] / A[col][col]
      for (let c = col; c <= k; c++) A[r][c] -= f * A[col][c]
    }
  }
  return A.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[k] / row[i]))
}
function residualise(values, controlCols) {
  const n = values.length
  const X = Array.from({ length: n }, (_, i) => [1, ...controlCols.map((c) => c[i])])
  const beta = ols(X, values)
  return values.map((v, i) => v - X[i].reduce((s, x, j) => s + x * beta[j], 0))
}
// Partial Spearman correlation between two RAW value arrays, controlling on
// a list of already-built numeric columns (each same length as the values).
// Ranks the two values of interest; a control column is used AS GIVEN
// (caller decides rank vs. 0/1 dummy vs. one-hot) -- this is the
// generalization analyze-postseason-experience.mjs's partialSpearman does
// not need: that file only ever controls on ranked continuous measures or a
// single boolean, never a multi-level category like a position group.
function partialSpearmanCols(xsRaw, ysRaw, controlCols) {
  const xs = rank(xsRaw)
  const ys = rank(ysRaw)
  if (!controlCols.length) return pearson(xs, ys)
  return pearson(residualise(xs, controlCols), residualise(ys, controlCols))
}
function permutationTestPartialByYear(rows, xsKey, ysKey, controlCols, observed, iterations = 2000) {
  const byYear = new Map()
  rows.forEach((r, i) => {
    if (!byYear.has(r.year)) byYear.set(r.year, [])
    byYear.get(r.year).push(i)
  })
  const xs = rows.map((r) => r[xsKey])
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const ys = new Array(rows.length)
    for (const idxs of byYear.values()) {
      const vals = shuffle(idxs.map((i) => rows[i][ysKey]))
      idxs.forEach((i, j) => (ys[i] = vals[j]))
    }
    const stat = partialSpearmanCols(
      xs,
      ys,
      controlCols,
    )
    if (Math.abs(stat) >= Math.abs(observed)) extreme++
  }
  return extreme / iterations
}
function leaveOneSeasonOutPartial(rows, xsKey, ysKey, controlColsFn, minYearN = 15) {
  const years = [...new Set(rows.map((r) => r.year))]
  const results = []
  for (const year of years) {
    const subsetIdx = rows.map((r, i) => i).filter((i) => rows[i].year !== year)
    if (rows.length - subsetIdx.length < minYearN) continue // dropping a thin year barely moves anything -- skip, not interesting
    const subset = subsetIdx.map((i) => rows[i])
    const xs = subset.map((r) => r[xsKey])
    const ys = subset.map((r) => r[ysKey])
    const cols = controlColsFn(subset)
    results.push({ droppedYear: year, value: partialSpearmanCols(xs, ys, cols) })
  }
  return results
}
function signPermutationTest(diffs, iterations = 5000) {
  const observed = mean(diffs)
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const flipped = diffs.map((d) => (Math.random() < 0.5 ? d : -d))
    if (Math.abs(mean(flipped)) >= Math.abs(observed)) extreme++
  }
  return extreme / iterations
}

// -------------------------------------------------------------- QO era check
const qoRows = { A: [], B: [], C: [], rejected: [], accepted: [] }
for (const p of players) {
  if (p.qualifyingOffer === 'Type A') qoRows.A.push(p.year)
  if (p.qualifyingOffer === 'Type B') qoRows.B.push(p.year)
  if (p.qualifyingOffer === 'Type C') qoRows.C.push(p.year)
  if (p.qualifyingOffer === 'rejected') qoRows.rejected.push(p.year)
  if (p.qualifyingOffer === 'accepted') qoRows.accepted.push(p.year)
}
console.log('=== qualifying_offer era boundary (confirmed against the rows) ===')
for (const [k, ys] of Object.entries(qoRows)) {
  console.log(k, 'n=' + ys.length, 'years', Math.min(...ys), '-', Math.max(...ys))
}

// -------------------------------------------------------- sentinel sanity check
function usableGuaranteesByYear(year) {
  return players.filter((p) => p.year === year && p.guaranteeAmount != null).map((p) => p.guaranteeAmount)
}
function usableGuaranteesByYearIncludingSentinel(year) {
  return players
    .filter((p) => p.year === year)
    .map((p) => (p.guaranteeAmount != null ? p.guaranteeAmount : p.guaranteeStatus === 'minor-league-deal' ? 1 : null))
    .filter((v) => v != null)
}
console.log('\n=== sentinel sanity check (must reproduce docs/contracts-data-caveats.md) ===')
for (const year of [2020, 2023]) {
  console.log(
    year,
    'median WITH sentinel dropped (correct):',
    median(usableGuaranteesByYear(year)),
    '  median WITH sentinel read as $1 (the bug):',
    median(usableGuaranteesByYearIncludingSentinel(year)),
  )
}
const noUsableGuarantee = players.filter((p) => p.guaranteeAmount == null).length
console.log(
  'no usable guarantee:',
  noUsableGuarantee,
  '=',
  ((100 * noUsableGuarantee) / players.length).toFixed(1) + '%',
  '(quote 39.3% per docs/contracts-data-caveats.md; this panel\'s own denominator differs by the 3 signed-overseas rows, which the doc\'s 2,201 figure does not fold in)',
)

// -------------------------------------------------------------- AAV index
const aavByYear = new Map()
for (const p of players) {
  if (p.aavAmount == null) continue
  if (!aavByYear.has(p.year)) aavByYear.set(p.year, [])
  aavByYear.get(p.year).push(p.aavAmount)
}
const aavMedianByYear = new Map([...aavByYear].map(([y, vs]) => [y, median(vs)]))
for (const p of players) {
  p.aavIndex = p.aavAmount != null && aavByYear.get(p.year)?.length >= 5 ? p.aavAmount / aavMedianByYear.get(p.year) : null
}

// ============================================================ MAIN QUESTION
// Winner's-curse set: fully-scoreable (contract entirely in completed
// seasons), has a usable AAV, and has an aavIndex (year had >=5 usable AAV
// rows to build a stable median off of).
const WC = players.filter((p) => p.fullyScoreable && p.aavIndex != null)
console.log('\n=== MAIN QUESTION: past WAR vs future WAR ===')
console.log('n =', WC.length, '(fully-scoreable contracts with a usable AAV)')
const priorPerYear = WC.map((p) => p.priorWar3 / 3)
const futurePerYear = WC.map((p) => p.futureWarPerYear)
const aavIdx = WC.map((p) => p.aavIndex)
console.log('spearman(aavIndex, priorWarPerYear)  =', spearman(aavIdx, priorPerYear).toFixed(3))
console.log('spearman(aavIndex, futureWarPerYear)  =', spearman(aavIdx, futurePerYear).toFixed(3))
console.log('spearman(priorWarPerYear, futureWarPerYear) [the aging curve itself] =', spearman(priorPerYear, futurePerYear).toFixed(3))

const ageRankWC = rank(WC.map((p) => p.age ?? median(WC.filter((x) => x.age != null).map((x) => x.age))))
const yearRankWC = rank(WC.map((p) => p.year))
const partialPastControllingFuture = partialSpearmanCols(aavIdx, priorPerYear, [rank(futurePerYear), ageRankWC, yearRankWC])
const partialFutureControllingPast = partialSpearmanCols(aavIdx, futurePerYear, [rank(priorPerYear), ageRankWC, yearRankWC])
console.log('partial: aavIndex ~ priorWarPerYear | futureWarPerYear, age, year  =', partialPastControllingFuture.toFixed(3))
console.log('partial: aavIndex ~ futureWarPerYear | priorWarPerYear, age, year  =', partialFutureControllingPast.toFixed(3))

const pPast = permutationTestPartialByYear(
  WC.map((p, i) => ({ year: p.year, aavIndex: aavIdx[i], priorPerYear: priorPerYear[i] })),
  'aavIndex',
  'priorPerYear',
  [rank(futurePerYear), ageRankWC, yearRankWC],
  partialPastControllingFuture,
  2000,
)
const pFuture = permutationTestPartialByYear(
  WC.map((p, i) => ({ year: p.year, aavIndex: aavIdx[i], futurePerYear: futurePerYear[i] })),
  'aavIndex',
  'futurePerYear',
  [rank(priorPerYear), ageRankWC, yearRankWC],
  partialFutureControllingPast,
  2000,
)
console.log('permutation p (past, grouped by year, 2000 iters)   =', pPast)
console.log('permutation p (future, grouped by year, 2000 iters) =', pFuture)

const wcRows = WC.map((p, i) => ({ year: p.year, aavIndex: aavIdx[i], priorPerYear: priorPerYear[i], futurePerYear: futurePerYear[i], age: p.age }))
const losoPast = leaveOneSeasonOutPartial(wcRows, 'aavIndex', 'priorPerYear', (subset) => [
  rank(subset.map((r) => r.futurePerYear)),
  rank(subset.map((r) => r.age ?? median(subset.filter((x) => x.age != null).map((x) => x.age)))),
  rank(subset.map((r) => r.year)),
])
const losoFuture = leaveOneSeasonOutPartial(wcRows, 'aavIndex', 'futurePerYear', (subset) => [
  rank(subset.map((r) => r.priorPerYear)),
  rank(subset.map((r) => r.age ?? median(subset.filter((x) => x.age != null).map((x) => x.age)))),
  rank(subset.map((r) => r.year)),
])
console.log(
  'leave-one-season-out (past): years tested',
  losoPast.length,
  'same-sign-as-full count',
  losoPast.filter((r) => Math.sign(r.value) === Math.sign(partialPastControllingFuture)).length,
  'range',
  Math.min(...losoPast.map((r) => r.value)).toFixed(3),
  'to',
  Math.max(...losoPast.map((r) => r.value)).toFixed(3),
)
console.log(
  'leave-one-season-out (future): years tested',
  losoFuture.length,
  'same-sign-as-full count',
  losoFuture.filter((r) => Math.sign(r.value) === Math.sign(partialFutureControllingPast)).length,
  'range',
  Math.min(...losoFuture.map((r) => r.value)).toFixed(3),
  'to',
  Math.max(...losoFuture.map((r) => r.value)).toFixed(3),
)

// ============================================================ WHERE OVERPAYS MOST
function ageBand(age) {
  if (age == null) return null
  if (age <= 27) return '≤27'
  if (age <= 30) return '28-30'
  if (age <= 33) return '31-33'
  if (age <= 36) return '34-36'
  return '37+'
}
function lengthBand(years) {
  if (years === 1) return '1yr'
  if (years <= 3) return '2-3yr'
  if (years <= 6) return '4-6yr'
  return '7+yr'
}
function bucketReport(keyFn, label) {
  const groups = new Map()
  for (const p of WC) {
    const k = keyFn(p)
    if (k == null) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(p)
  }
  console.log(`\n--- overpay by ${label} ---`)
  const rows = []
  for (const [k, rowsInGroup] of groups) {
    const priorPY = rowsInGroup.map((p) => p.priorWar3 / 3)
    const futurePY = rowsInGroup.map((p) => p.futureWarPerYear)
    const gap = mean(rowsInGroup.map((p, i) => priorPY[i] - futurePY[i]))
    const idx = mean(rowsInGroup.map((p) => p.aavIndex))
    // declineRatio: the gap as a share of what the player was doing before
    // signing -- lets a bucket with naturally bigger WAR numbers (a $300M
    // ace vs. a bench infielder) be compared on the same scale.
    const declineRatio = gap / mean(priorPY)
    console.log(
      k.padEnd(8),
      'n=' + String(rowsInGroup.length).padEnd(5),
      'priorWAR/yr=' + mean(priorPY).toFixed(2).padEnd(7),
      'actualWAR/yr=' + mean(futurePY).toFixed(2).padEnd(7),
      'gap=' + gap.toFixed(2).padEnd(7),
      'declineRatio=' + (100 * declineRatio).toFixed(1) + '%'.padEnd(7),
      'avg aavIndex=' + idx.toFixed(2),
    )
    rows.push({ bucket: k, n: rowsInGroup.length, priorWarPerYear: mean(priorPY), actualWarPerYear: mean(futurePY), gap, declineRatio, avgAavIndex: idx })
  }
  return rows
}
const overpayByAge = bucketReport((p) => ageBand(p.age), 'age band')
const overpayByPosition = bucketReport((p) => p.posGroup, 'position group')
const overpayByLength = bucketReport((p) => lengthBand(p.contractYears), 'contract length')

// ============================================================ LAST YEAR VS FIRST YEAR
function lastVsFirst(minYears) {
  const rows = WC.filter((p) => p.contractYears >= minYears)
  const diffs = rows.map((p) => p.contractYearWar[p.contractYears - 1] - p.contractYearWar[0])
  const declined = diffs.filter((d) => d < 0).length
  const pval = signPermutationTest(diffs, 5000)
  const years = [...new Set(rows.map((p) => p.year))]
  const loso = years.map((year) => {
    const subset = diffs.filter((_, i) => rows[i].year !== year)
    return { droppedYear: year, meanDiff: mean(subset) }
  })
  return {
    minYears,
    n: rows.length,
    meanFirstYearWar: mean(rows.map((p) => p.contractYearWar[0])),
    meanLastYearWar: mean(rows.map((p) => p.contractYearWar[p.contractYears - 1])),
    meanDiff: mean(diffs),
    pctDeclined: (100 * declined) / rows.length,
    permutationP: pval,
    leaveOneSeasonOutSameSignCount: loso.filter((r) => Math.sign(r.meanDiff) === Math.sign(mean(diffs))).length,
    leaveOneSeasonOutYearsTested: loso.length,
  }
}
console.log('\n=== LAST YEAR VS FIRST YEAR OF A LONG DEAL ===')
const lastFirst3 = lastVsFirst(3)
const lastFirst4 = lastVsFirst(4)
console.log(lastFirst3)
console.log(lastFirst4)

// ============================================================ AGENT AXIS
const agentCounts = new Map()
for (const p of players) {
  if (!p.agentRaw) continue
  agentCounts.set(p.agentRaw, (agentCounts.get(p.agentRaw) || 0) + 1)
}
const topAgents = [...agentCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
console.log('\n=== AGENT AXIS ===')
console.log('distinct raw agent strings:', agentCounts.size)
console.log('top 8 by signings, exact-string scope (free_agency.csv alone):', topAgents)

const noAgent = players.filter((p) => !p.agentRaw).length
console.log('no agent recorded (blank or "-"):', noAgent, '=', ((100 * noAgent) / players.length).toFixed(1) + '%')

// Missingness-vs-size check, on rows with a usable aavIndex.
const agentKnownAav = players.filter((p) => p.agentRaw && p.aavIndex != null).map((p) => p.aavIndex)
const agentBlankAav = players.filter((p) => !p.agentRaw && p.aavIndex != null).map((p) => p.aavIndex)
console.log(
  'median aavIndex, agent known:',
  median(agentKnownAav).toFixed(2),
  'n=' + agentKnownAav.length,
  '   agent blank:',
  median(agentBlankAav).toFixed(2),
  'n=' + agentBlankAav.length,
)
// Same check by era, since the field's own coverage could simply have
// improved over time alongside dollar amounts generally rising.
for (const [label, test] of [
  ['1991-2012', (p) => p.year <= 2012],
  ['2013-2026', (p) => p.year >= 2013],
]) {
  const known = players.filter((p) => test(p) && p.agentRaw && p.aavIndex != null).map((p) => p.aavIndex)
  const blank = players.filter((p) => test(p) && !p.agentRaw && p.aavIndex != null).map((p) => p.aavIndex)
  console.log(
    ` ${label}: median aavIndex known=${median(known).toFixed(2)} (n=${known.length})  blank=${median(blank).toFixed(2)} (n=${blank.length})`,
  )
}

// Holding the player fixed: does being a top agency's client predict a
// higher aavIndex, controlling for age, prior production, era, and the
// broad pitcher/hitter split? Runs on WC (fully-scoreable, aavIndex
// present) so priorWarPerYear is available as a control.
console.log('\n--- agent effect holding player fixed (WC set, controls: age, priorWAR/yr, year, pitcher/hitter) ---')
const isPitcherWC = WC.map((p) => (['SP', 'RP', 'P'].includes(p.posGroup) ? 1 : 0))
const controlsWC = [rank(priorPerYear), ageRankWC, yearRankWC, isPitcherWC]
const agentFindings = []
for (const [agency, totalSignings] of topAgents) {
  const dummy = WC.map((p) => (p.agentRaw === agency ? 1 : 0))
  const nInSet = dummy.reduce((a, b) => a + b, 0)
  if (nInSet < 15) {
    console.log(agency, `too few fully-scoreable signings in this set (n=${nInSet} of ${totalSignings} total) -- skipped`)
    continue
  }
  const partial = partialSpearmanCols(dummy, aavIdx, controlsWC)
  const pval = permutationTestPartialByYear(
    WC.map((p, i) => ({ year: p.year, dummy: dummy[i], aavIndex: aavIdx[i] })),
    'dummy',
    'aavIndex',
    controlsWC,
    partial,
    2000,
  )
  console.log(agency, `n=${nInSet} (of ${totalSignings} total signings)`, 'partial r=' + partial.toFixed(3), 'perm p=' + pval)
  agentFindings.push({ agency, nInWinnersCurseSet: nInSet, totalSignings, partialCorrelation: partial, permutationP: pval })
}

// ============================================================ CHANGING CLUBS
console.log('\n=== DOES CHANGING CLUBS PAY? ===')
const clubSet = players.filter((p) => p.movedClubs != null && p.aavIndex != null && p.mlbId)
console.log('n =', clubSet.length, '(old_club and new_club both resolve to an MLB team, and AAV is usable)')
const movedAav = clubSet.filter((p) => p.movedClubs).map((p) => p.aavIndex)
const stayedAav = clubSet.filter((p) => !p.movedClubs).map((p) => p.aavIndex)
console.log('naive: median aavIndex moved=' + median(movedAav).toFixed(2), 'n=' + movedAav.length, '  stayed=' + median(stayedAav).toFixed(2), 'n=' + stayedAav.length)

const clubPriorPerYear = clubSet.map((p) => p.priorWar3 / 3)
const clubAgeRank = rank(clubSet.map((p) => p.age ?? median(clubSet.filter((x) => x.age != null).map((x) => x.age))))
const clubYearRank = rank(clubSet.map((p) => p.year))
const clubIsPitcher = clubSet.map((p) => (['SP', 'RP', 'P'].includes(p.posGroup) ? 1 : 0))
const movedDummy = clubSet.map((p) => (p.movedClubs ? 1 : 0))
const clubAavIdx = clubSet.map((p) => p.aavIndex)
const clubControls = [rank(clubPriorPerYear), clubAgeRank, clubYearRank, clubIsPitcher]
const movedPartial = partialSpearmanCols(movedDummy, clubAavIdx, clubControls)
const movedP = permutationTestPartialByYear(
  clubSet.map((p, i) => ({ year: p.year, movedDummy: movedDummy[i], aavIndex: clubAavIdx[i] })),
  'movedDummy',
  'aavIndex',
  clubControls,
  movedPartial,
  2000,
)
console.log('controlled (age, priorWAR/yr, year, pitcher/hitter): partial r=' + movedPartial.toFixed(3), 'perm p=' + movedP)

// ============================================================ OUTPUT
const findings = {
  generatedAt: new Date().toISOString(),
  n: {
    totalRows: players.length,
    noMlbId: panel.excludedNoMlbId,
    fullyScoreable: players.filter((p) => p.fullyScoreable).length,
    winnersCurseSet: WC.length,
  },
  qoEraBoundary: Object.fromEntries(
    Object.entries(qoRows).map(([k, ys]) => [k, { n: ys.length, minYear: Math.min(...ys), maxYear: Math.max(...ys) }]),
  ),
  sentinelCheck: {
    2020: { withSentinelDropped: median(usableGuaranteesByYear(2020)), withSentinelAsDollar: median(usableGuaranteesByYearIncludingSentinel(2020)) },
    2023: { withSentinelDropped: median(usableGuaranteesByYear(2023)), withSentinelAsDollar: median(usableGuaranteesByYearIncludingSentinel(2023)) },
  },
  mainQuestion: {
    spearmanAavIndexVsPriorWarPerYear: spearman(aavIdx, priorPerYear),
    spearmanAavIndexVsFutureWarPerYear: spearman(aavIdx, futurePerYear),
    spearmanPriorVsFutureWarPerYear: spearman(priorPerYear, futurePerYear),
    partialPastControllingFuture,
    partialFutureControllingPast,
    permutationPPast: pPast,
    permutationPFuture: pFuture,
    leaveOneSeasonOutPast: { yearsTested: losoPast.length, sameSignCount: losoPast.filter((r) => Math.sign(r.value) === Math.sign(partialPastControllingFuture)).length, range: [Math.min(...losoPast.map((r) => r.value)), Math.max(...losoPast.map((r) => r.value))] },
    leaveOneSeasonOutFuture: { yearsTested: losoFuture.length, sameSignCount: losoFuture.filter((r) => Math.sign(r.value) === Math.sign(partialFutureControllingPast)).length, range: [Math.min(...losoFuture.map((r) => r.value)), Math.max(...losoFuture.map((r) => r.value))] },
  },
  overpayByAge,
  overpayByPosition,
  overpayByLength,
  lastYearVsFirstYear: { minYears3: lastFirst3, minYears4: lastFirst4 },
  agentAxis: {
    distinctRawAgents: agentCounts.size,
    top8: topAgents.map(([agency, n]) => ({ agency, n })),
    noAgentCount: noAgent,
    noAgentPct: (100 * noAgent) / players.length,
    findings: agentFindings,
  },
  changingClubs: {
    n: clubSet.length,
    medianAavIndexMoved: median(movedAav),
    medianAavIndexStayed: median(stayedAav),
    nMoved: movedAav.length,
    nStayed: stayedAav.length,
    controlledPartialCorrelation: movedPartial,
    permutationP: movedP,
  },
}
writeFileSync(join(__dirname, 'free-agency-market-findings.json'), JSON.stringify(findings, null, 2))
console.log('\nwritten to .scratch/team-success/free-agency-market-findings.json')
