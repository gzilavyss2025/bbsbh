// Q2, second pass. The first pass found one thing worth keeping and one thing
// worth doubting, and this is the pass that tries to break both.
//
// WHAT IT FOUND. Not a slope — a U. A player's WEIGHT, measured against the
// average for his own position, adds time in the minors in EITHER direction:
// |z| costs about 0.17 of a season per standard deviation (p=0.001), with the
// plain linear term at nothing. Height does the opposite: a weak straight line
// (taller = slower, p=0.03) and no U at all.
//
// WHY THE FIRST PASS'S OWN TABLES COULD NOT SHOW IT. Seasons-to-debut is an
// integer. Every tercile's MEDIAN came back 4.0, which is what a median does to
// a fifth-of-a-season effect. Means are used here instead — the effect is small
// and a reader is entitled to see it at the size it actually is rather than be
// told a coefficient.
//
// THE OBJECTION THAT MATTERS MOST, stated before the numbers: statsapi's
// listed weight is a CURRENT listing, not a measurement taken during the man's
// minor-league seasons. For a player who retired in 2014 it is whatever he was
// last listed at. Height barely moves after 18; weight does. Everything below
// is measured against a ruler that was read at the wrong time, and no amount of
// robustness checking inside this data can repair that.
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCohort, here, fmt, summarize } from './lib.mjs'
import { fitOLS, invert, matTMat, tTwoSidedP } from '../level-benchmarks/homegrown-stats.mjs'

const players = await buildCohort()
const POS_GROUP = {
  C: 'C', SS: 'MID', '2B': 'MID', CF: 'MID',
  '3B': 'CORNER', '1B': 'CORNER', LF: 'CORNER', RF: 'CORNER', OF: 'CORNER', DH: 'CORNER',
}
for (const p of players) {
  p.posGroup = p.group === 'pitching' ? 'P' : (POS_GROUP[p.pos] ?? null)
  p.totalVolume = p.group === 'hitting'
    ? p.segs.reduce((a, s) => a + s.pa, 0)
    : p.segs.reduce((a, s) => a + s.outs, 0) / 3
}
const cohort = players.filter(
  (p) => p.heightIn && p.weightLb && p.seasonsToDebut != null && p.seasonsToDebut >= 0 && p.posGroup,
)

function zify(set, key, groupKey = 'posGroup') {
  const stats = {}
  for (const g of [...new Set(set.map((p) => p[groupKey]))]) {
    const v = set.filter((p) => p[groupKey] === g).map((p) => p[key]).filter(Number.isFinite)
    const m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
    stats[g] = { m, sd }
  }
  return (p) => (p[key] - stats[p[groupKey]].m) / stats[p[groupKey]].sd
}
const zW = zify(cohort, 'weightLb')
const zH = zify(cohort, 'heightIn')
for (const p of cohort) {
  p.zWeight = zW(p)
  p.zHeight = zH(p)
}

const meanOf = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)

// --- 1. the shape, in quintiles ----------------------------------------------
console.log('=== seasons to debut, by weight quintile within position group ===')
console.log('(means, not medians — the outcome is an integer and a median cannot resolve a fifth of a season)')
const quintileRows = []
for (const grp of ['P', 'C', 'MID', 'CORNER']) {
  const g = cohort.filter((p) => p.posGroup === grp).sort((a, b) => a.weightLb - b.weightLb)
  if (g.length < 150) continue
  const step = g.length / 5
  const cells = []
  for (let i = 0; i < 5; i++) {
    const c = g.slice(Math.floor(i * step), Math.floor((i + 1) * step))
    cells.push({
      n: c.length,
      lb: summarize(c.map((p) => p.weightLb)).median,
      seasons: meanOf(c.map((p) => p.seasonsToDebut)),
    })
  }
  quintileRows.push({ group: grp, cells })
  console.log(
    `  ${grp.padEnd(7)} ` +
      cells.map((c) => `${fmt(c.lb, 0)}lb ${fmt(c.seasons, 2)}`).join('  |  ') +
      `   (n=${cells.map((c) => c.n).join('/')})`,
  )
}

// Pooled across positions, in z-space, which is the form the U was found in.
console.log('\n=== pooled, in standard deviations from the position average ===')
const bands = [
  ['below −1.5 SD', (z) => z < -1.5],
  ['−1.5 to −0.5', (z) => z >= -1.5 && z < -0.5],
  ['−0.5 to +0.5', (z) => z >= -0.5 && z <= 0.5],
  ['+0.5 to +1.5', (z) => z > 0.5 && z <= 1.5],
  ['above +1.5 SD', (z) => z > 1.5],
]
const bandRows = []
for (const [name, test] of bands) {
  const g = cohort.filter((p) => test(p.zWeight))
  const row = {
    band: name,
    n: g.length,
    seasons: meanOf(g.map((p) => p.seasonsToDebut)),
    volume: summarize(g.map((p) => p.totalVolume)).median,
  }
  bandRows.push(row)
  console.log(`  weight ${name.padEnd(14)} n=${String(row.n).padStart(4)}  mean seasons to debut ${fmt(row.seasons, 2)}`)
}
console.log('')
for (const [name, test] of bands) {
  const g = cohort.filter((p) => test(p.zHeight))
  console.log(`  height ${name.padEnd(14)} n=${String(g.length).padStart(4)}  mean seasons to debut ${fmt(meanOf(g.map((p) => p.seasonsToDebut)), 2)}`)
}

// --- 2. is it one position group carrying it? --------------------------------
function fitDeviation(set, sizeKey, { extra = [] } = {}) {
  const usable = set.filter((p) => Number.isFinite(p.seasonsToDebut) && Number.isFinite(p[sizeKey]) && extra.every((e) => Number.isFinite(e.get(p))))
  if (usable.length < 100) return null
  const groups = [...new Set(usable.map((p) => p.posGroup))].sort().slice(1)
  const tiers = [...new Set(usable.map((p) => p.draftTier))].sort().slice(1)
  const eras = [...new Set(usable.map((p) => Math.floor(p.debutYear / 5)))].sort().slice(1)
  const X = usable.map((p) => [
    1,
    Math.abs(p[sizeKey]),
    p[sizeKey],
    ...extra.map((e) => e.get(p)),
    ...groups.map((g) => (p.posGroup === g ? 1 : 0)),
    ...tiers.map((t) => (p.draftTier === t ? 1 : 0)),
    ...eras.map((e) => (Math.floor(p.debutYear / 5) === e ? 1 : 0)),
  ])
  const y = usable.map((p) => p.seasonsToDebut)
  const f = fitOLS(X, y)
  if (!f) return null
  const n = X.length
  const k = X[0].length
  const s2 = f.resid.reduce((a, b) => a + b * b, 0) / (n - k)
  const XtXinv = invert(matTMat(X))
  const b = f.beta[1]
  const se = Math.sqrt(s2 * XtXinv[1][1])
  return { n, beta: b, se, p: tTwoSidedP(b / se, n - k) }
}

console.log('\n=== leave one position group out ===')
console.log('(the |weight| term, seasons to debut. If one group carries it, dropping that group kills it.)')
const loo = []
for (const drop of [null, 'P', 'C', 'MID', 'CORNER']) {
  const set = drop ? cohort.filter((p) => p.posGroup !== drop) : cohort
  const r = fitDeviation(set, 'zWeight')
  if (!r) continue
  loo.push({ dropped: drop ?? 'nothing', ...r })
  console.log(`  drop ${String(drop ?? 'nothing').padEnd(8)} n=${String(r.n).padStart(4)}  |zWeight| ${fmt(r.beta, 3)} ± ${fmt(r.se, 3)}  p=${r.p < 0.0001 ? '<1e-4' : r.p.toFixed(4)}`)
}

console.log('\n=== one position group at a time ===')
const perGroup = []
for (const grp of ['P', 'C', 'MID', 'CORNER']) {
  const set = cohort.filter((p) => p.posGroup === grp)
  const r = fitDeviation(set, 'zWeight')
  if (!r) continue
  perGroup.push({ group: grp, ...r })
  console.log(`  ${grp.padEnd(7)} n=${String(r.n).padStart(4)}  |zWeight| ${fmt(r.beta, 3)} ± ${fmt(r.se, 3)}  p=${r.p.toFixed(4)}`)
}

// --- 3. does it survive an era split? ----------------------------------------
console.log('\n=== by debut era ===')
const eraRows = []
for (const [name, lo, hi] of [['2005-2011', 2005, 2011], ['2012-2017', 2012, 2017], ['2018-2023', 2018, 2023]]) {
  const set = cohort.filter((p) => p.debutYear >= lo && p.debutYear <= hi)
  const r = fitDeviation(set, 'zWeight')
  if (!r) continue
  eraRows.push({ era: name, ...r })
  console.log(`  ${name.padEnd(10)} n=${String(r.n).padStart(4)}  |zWeight| ${fmt(r.beta, 3)} ± ${fmt(r.se, 3)}  p=${r.p.toFixed(4)}`)
}

// --- 4. height, the straight line, same treatment ----------------------------
console.log('\n=== height, linear, one group at a time (seasons to debut) ===')
function fitLinear(set, sizeKey) {
  const usable = set.filter((p) => Number.isFinite(p.seasonsToDebut) && Number.isFinite(p[sizeKey]))
  if (usable.length < 100) return null
  const groups = [...new Set(usable.map((p) => p.posGroup))].sort().slice(1)
  const tiers = [...new Set(usable.map((p) => p.draftTier))].sort().slice(1)
  const eras = [...new Set(usable.map((p) => Math.floor(p.debutYear / 5)))].sort().slice(1)
  const X = usable.map((p) => [
    1, p[sizeKey],
    ...groups.map((g) => (p.posGroup === g ? 1 : 0)),
    ...tiers.map((t) => (p.draftTier === t ? 1 : 0)),
    ...eras.map((e) => (Math.floor(p.debutYear / 5) === e ? 1 : 0)),
  ])
  const y = usable.map((p) => p.seasonsToDebut)
  const f = fitOLS(X, y)
  if (!f) return null
  const n = X.length
  const k = X[0].length
  const s2 = f.resid.reduce((a, b) => a + b * b, 0) / (n - k)
  const XtXinv = invert(matTMat(X))
  const b = f.beta[1]
  const se = Math.sqrt(s2 * XtXinv[1][1])
  return { n, beta: b, se, p: tTwoSidedP(b / se, n - k) }
}
const heightPerGroup = []
for (const grp of ['P', 'C', 'MID', 'CORNER']) {
  const r = fitLinear(cohort.filter((p) => p.posGroup === grp), 'zHeight')
  if (!r) continue
  heightPerGroup.push({ group: grp, ...r })
  console.log(`  ${grp.padEnd(7)} n=${String(r.n).padStart(4)}  zHeight ${fmt(r.beta, 3)} ± ${fmt(r.se, 3)}  p=${r.p.toFixed(4)}`)
}

// --- 5. what it is worth, in English ------------------------------------------
// The extremes, since the question was about them: how much longer does the
// most unusual tenth take than the middle?
const extreme = cohort.filter((p) => Math.abs(p.zWeight) >= 1.28)
const middle = cohort.filter((p) => Math.abs(p.zWeight) < 1.28)
const days = (s) => Math.round(s * 365.25)
const gap = meanOf(extreme.map((p) => p.seasonsToDebut)) - meanOf(middle.map((p) => p.seasonsToDebut))
console.log(
  `\nthe most unusual tenth by weight (n=${extreme.length}) take ${fmt(meanOf(extreme.map((p) => p.seasonsToDebut)), 2)} seasons; ` +
    `everyone else (n=${middle.length}) take ${fmt(meanOf(middle.map((p) => p.seasonsToDebut)), 2)}. Gap ${fmt(gap, 2)} seasons.`,
)

await writeFile(
  join(here, 'q2b-size-robustness.json'),
  JSON.stringify({ quintileRows, bandRows, loo, perGroup, eraRows, heightPerGroup, extremeGap: gap }, null, 1),
)
console.log('\nwrote q2b-size-robustness.json')
