// Q1: what do players with above-average MLB rookie seasons share, in the
// minors?
//
// THE SHAPE OF THE QUESTION, AND ITS ONE FATAL TRAP. Everybody in this cohort
// reached the majors and stuck. So this can never say "trait X makes a good
// rookie" — the men who had trait X and washed out at Double-A are not here.
// What it CAN say is: among players who all made it, which minor-league
// histories separate the good rookie seasons from the poor ones. That is a
// narrower claim and it is the only honest one available, so it is the one
// made throughout.
//
// COHORT. Debuts 2010–2023 for the headline, because FanGraphs WAR in this repo
// starts at 2010 and the level-season peer pools start at 2009. The full
// 2005–2023 cohort is reported alongside wherever the measure allows it, so a
// reader can see whether the window is doing the work.
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCohort, here, summarize, percentile, fmt, LEVELS } from './lib.mjs'
import { buildOutcomes } from './outcomes.mjs'
import { readFile } from 'node:fs/promises'
import { pearson, spearman, tTwoSidedP, normalTwoSidedP, fitOLS, invert, matTMat } from '../level-benchmarks/homegrown-stats.mjs'

const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }

const players = await buildCohort()
const rows = await buildOutcomes(players)
const perfPool = JSON.parse(await readFile(join(here, '..', 'level-benchmarks', 'perf-pool.json'), 'utf8'))

// --- level-season peer percentile -------------------------------------------
// perf-pool.json is the FULL population at a (level, season) — everyone who
// played there, not just the men who eventually graduated. Ranking a cohort
// player against his own cohort would be ranking survivors against survivors.
const poolCache = new Map()
function poolFor(sportId, season, group) {
  const key = `${sportId}:${season}:${group}`
  if (!poolCache.has(key)) {
    const raw = perfPool[key]
    if (!raw) {
      poolCache.set(key, null)
    } else {
      const vals = raw
        .filter((r) => (group === 'hitting' ? r.plateAppearances >= 100 : r.inningsPitched >= 20))
        .map((r) => (group === 'hitting' ? r.ops : r.era))
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b)
      poolCache.set(key, vals.length >= 30 ? vals : null)
    }
  }
  return poolCache.get(key)
}

// Percentile of a value in its level-season pool, oriented so HIGHER IS BETTER
// for both groups (a pitcher's ERA is flipped).
function peerPct(value, sportId, season, group) {
  const pool = poolFor(sportId, season, group)
  if (!pool || !Number.isFinite(value)) return null
  let below = 0
  for (const v of pool) if (v < value) below++
  const pct = below / pool.length
  return group === 'hitting' ? pct : 1 - pct
}

// --- per-player minor-league traits -----------------------------------------
function traitsFor(p) {
  const hitting = p.group === 'hitting'
  const segs = p.segs
  const last = segs[segs.length - 1] ?? null
  const totalPA = segs.reduce((a, s) => a + s.pa, 0)
  const totalOuts = segs.reduce((a, s) => a + s.outs, 0)
  const byLevel = p.byLevel

  // Rate lines at the top two rungs, where a promotion decision actually gets
  // made. Combining AA and AAA keeps the sample usable for the men who skipped
  // one of them.
  const upper = ['AA', 'AAA'].map((l) => byLevel[l]).filter(Boolean)
  const uraw = {}
  for (const s of upper) for (const [k, v] of Object.entries(s.raw)) uraw[k] = (uraw[k] ?? 0) + v

  let upperRate = null
  let kRate = null
  let bbRate = null
  if (hitting) {
    const ab = uraw.atBats ?? 0
    const obpDen = ab + (uraw.baseOnBalls ?? 0) + (uraw.hitByPitch ?? 0) + (uraw.sacFlies ?? 0)
    if (ab >= 150) {
      upperRate =
        (uraw.hits + uraw.baseOnBalls + uraw.hitByPitch) / obpDen + (uraw.totalBases ?? 0) / ab
      const pa = upper.reduce((a, s) => a + s.pa, 0)
      kRate = pa ? (uraw.strikeOuts ?? 0) / pa : null
      bbRate = pa ? (uraw.baseOnBalls ?? 0) / pa : null
    }
  } else {
    const outs = upper.reduce((a, s) => a + s.outs, 0)
    if (outs >= 150) {
      const innings = outs / 3
      upperRate = ((uraw.earnedRuns ?? 0) * 9) / innings
      const bf = uraw.battersFaced ?? 0
      kRate = bf ? (uraw.strikeOuts ?? 0) / bf : null
      bbRate = bf ? (uraw.baseOnBalls ?? 0) / bf : null
    }
  }

  // Peer percentile at the LAST level before the debut, the closest thing in
  // the data to "how he was playing when they called him up".
  let lastPeer = null
  if (last) {
    const value = hitting
      ? last.raw.atBats >= 100
        ? (last.raw.hits + last.raw.baseOnBalls + last.raw.hitByPitch) /
            (last.raw.atBats + last.raw.baseOnBalls + last.raw.hitByPitch + (last.raw.sacFlies ?? 0)) +
          last.raw.totalBases / last.raw.atBats
        : null
      : last.outs >= 60
        ? ((last.raw.earnedRuns ?? 0) * 9) / (last.outs / 3)
        : null
    if (value != null) lastPeer = peerPct(value, LEVEL_SPORT[last.level], last.lastSeason, p.group)
  }

  const levelsUsed = segs.length
  const reachedAAA = !!byLevel.AAA
  const wireDays = p.durations.reduce((a, d) => a + d.days, 0) || null

  return {
    seasonsToDebut: p.seasonsToDebut,
    ageAtDebut: p.ageAtDebut,
    proSeasonCount: p.proSeasonCount,
    totalPA: hitting ? totalPA : null,
    totalIP: hitting ? null : totalOuts / 3,
    volume: hitting ? totalPA : totalOuts / 3,
    aaaPA: hitting ? (byLevel.AAA?.pa ?? 0) : null,
    aaaIP: hitting ? null : (byLevel.AAA?.outs ?? 0) / 3,
    aaaVolume: hitting ? (byLevel.AAA?.pa ?? 0) : (byLevel.AAA?.outs ?? 0) / 3,
    levelsUsed,
    reachedAAA: reachedAAA ? 1 : 0,
    upperRate,
    kRate,
    bbRate,
    lastPeer,
    wireDays,
    heightIn: p.heightIn,
    weightLb: p.weightLb,
    draftAge: p.draftAge,
  }
}

for (const p of rows) p.traits = traitsFor(p)

// --- the two "above average" definitions ------------------------------------
const MIN_PT = { hitting: 150, pitching: 40 } // rookie-season PA / IP for the rate read
const eligible = rows.filter(
  (p) => p.rookieFound && p.debutYear >= 2010 && p.rookieLagYears <= 2,
)
const rateSet = eligible.filter(
  (p) => p.rookieRate != null && p.rookieSeasonPT >= MIN_PT[p.group],
)
const warSet = eligible.filter((p) => p.rookieWar != null)

console.log(`cohort 2010-2023, rookie season within 2 yrs of debut: ${eligible.length}`)
console.log(`  with a gradeable rate line (>=${MIN_PT.hitting} PA / ${MIN_PT.pitching} IP): ${rateSet.length}`)
console.log(`  with a season WAR: ${warSet.length}`)

const aboveRate = (p) => p.rookieRate >= 100
const aboveWar = (p) => p.rookieWar >= 2.0

console.log(`\nabove-average by rate: ${rateSet.filter(aboveRate).length}/${rateSet.length}`)
console.log(`above-average by WAR>=2: ${warSet.filter(aboveWar).length}/${warSet.length}`)

// How much do the two definitions agree? If they disagree a lot, the headline
// has to say so.
const both = rateSet.filter((p) => p.rookieWar != null)
const agree = both.filter((p) => aboveRate(p) === aboveWar(p)).length
console.log(`the two definitions agree on ${agree}/${both.length} (${((100 * agree) / both.length).toFixed(0)}%)`)

// --- trait comparison --------------------------------------------------------
const TRAITS = [
  ['seasonsToDebut', 'Seasons from first pro season to debut'],
  ['ageAtDebut', 'Age at MLB debut'],
  ['volume', 'Total MiLB PA (or IP)'],
  ['aaaVolume', 'Triple-A PA (or IP)'],
  ['levelsUsed', 'Full-season levels used'],
  ['reachedAAA', 'Reached Triple-A before debuting'],
  ['upperRate', 'AA+AAA OPS (or ERA)'],
  ['kRate', 'AA+AAA strikeout rate'],
  ['bbRate', 'AA+AAA walk rate'],
  ['lastPeer', 'Peer percentile at last level'],
  ['wireDays', 'Total dated days at level'],
  ['heightIn', 'Height (in)'],
  ['weightLb', 'Weight (lb)'],
  ['draftAge', 'Age in draft year'],
]

// Mann-Whitney U, normal approximation with a tie correction. Rank-based
// because almost none of these traits is remotely normal — days at level and
// Triple-A volume both have long right tails.
function mannWhitney(a, b) {
  const all = [...a.map((v) => [v, 0]), ...b.map((v) => [v, 1])].sort((x, y) => x[0] - y[0])
  const ranks = new Array(all.length)
  let i = 0
  let tieSum = 0
  while (i < all.length) {
    let jj = i
    while (jj + 1 < all.length && all[jj + 1][0] === all[i][0]) jj++
    const r = (i + jj + 2) / 2
    const t = jj - i + 1
    if (t > 1) tieSum += t ** 3 - t
    for (let k = i; k <= jj; k++) ranks[k] = r
    i = jj + 1
  }
  let rA = 0
  for (let k = 0; k < all.length; k++) if (all[k][1] === 0) rA += ranks[k]
  const n1 = a.length
  const n2 = b.length
  const U = rA - (n1 * (n1 + 1)) / 2
  const mu = (n1 * n2) / 2
  const N = n1 + n2
  const sd = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tieSum / (N * (N - 1))))
  const z = sd > 0 ? (U - mu) / sd : 0
  return { U, z, p: normalTwoSidedP(z) }
}

function compare(set, isAbove, label, group) {
  const g = set.filter((p) => p.group === group)
  const hi = g.filter(isAbove)
  const lo = g.filter((p) => !isAbove(p))
  const out = []
  for (const [key, name] of TRAITS) {
    const A = hi.map((p) => p.traits[key]).filter((v) => v != null && Number.isFinite(v))
    const B = lo.map((p) => p.traits[key]).filter((v) => v != null && Number.isFinite(v))
    if (A.length < 25 || B.length < 25) continue
    const sa = summarize(A)
    const sb = summarize(B)
    const mw = mannWhitney(A, B)
    // Standardized difference, so traits on different units are comparable.
    const pooledSD = Math.sqrt((sa.sd ** 2 * (sa.n - 1) + sb.sd ** 2 * (sb.n - 1)) / (sa.n + sb.n - 2))
    out.push({
      key,
      name,
      nHi: sa.n,
      nLo: sb.n,
      medHi: sa.median,
      medLo: sb.median,
      meanHi: sa.mean,
      meanLo: sb.mean,
      d: pooledSD ? (sa.mean - sb.mean) / pooledSD : null,
      z: mw.z,
      p: mw.p,
    })
  }
  // Benjamini-Hochberg over the traits tested in this one comparison.
  const sorted = [...out].sort((a, b) => a.p - b.p)
  sorted.forEach((r, i) => {
    r.q = Math.min(1, (r.p * sorted.length) / (i + 1))
  })
  for (let i = sorted.length - 2; i >= 0; i--) sorted[i].q = Math.min(sorted[i].q, sorted[i + 1].q)
  console.log(`\n=== ${label} — ${group} (above n=${out[0]?.nHi ?? 0}, below n=${out[0]?.nLo ?? 0}) ===`)
  console.log(
    ['trait'.padEnd(38), 'above'.padStart(9), 'below'.padStart(9), 'd'.padStart(7), 'p'.padStart(9), 'q'.padStart(8)].join(''),
  )
  for (const r of sorted) {
    console.log(
      [
        r.name.padEnd(38),
        fmt(r.medHi, 2).padStart(9),
        fmt(r.medLo, 2).padStart(9),
        fmt(r.d, 2).padStart(7),
        (r.p < 0.0001 ? '<0.0001' : r.p.toFixed(4)).padStart(9),
        (r.q < 0.0001 ? '<0.0001' : r.q.toFixed(4)).padStart(8),
      ].join(''),
    )
  }
  return sorted
}

const results = {}
for (const group of ['hitting', 'pitching']) {
  results[`rate:${group}`] = compare(rateSet, aboveRate, 'ABOVE AVERAGE BY RATE', group)
  results[`war:${group}`] = compare(warSet, aboveWar, 'ABOVE AVERAGE BY WAR>=2', group)
}

// --- do the traits survive together? ----------------------------------------
// A multiple regression on the continuous outcome, so a trait that is only
// standing in for another one loses its coefficient here. Standardized inputs,
// so the coefficients are directly comparable to each other.
function standardize(vals) {
  const ok = vals.filter(Number.isFinite)
  const m = ok.reduce((a, b) => a + b, 0) / ok.length
  const sd = Math.sqrt(ok.reduce((a, b) => a + (b - m) ** 2, 0) / (ok.length - 1))
  return { m, sd }
}

function regress(set, outcomeKey, group, keys, label) {
  const g = set.filter((p) => p.group === group && Number.isFinite(p[outcomeKey]))
  const usable = g.filter((p) => keys.every((k) => Number.isFinite(p.traits[k])))
  if (usable.length < 60) {
    console.log(`\n${label} — ${group}: only ${usable.length} complete rows, skipped`)
    return null
  }
  const norm = {}
  for (const k of keys) norm[k] = standardize(usable.map((p) => p.traits[k]))
  // Era controls: one dummy per debut half-decade, so a league-wide drift in
  // rookie quality cannot masquerade as a trait.
  const eras = [...new Set(usable.map((p) => Math.floor(p.debutYear / 5)))].sort()
  const X = usable.map((p) => [
    1,
    ...keys.map((k) => (p.traits[k] - norm[k].m) / norm[k].sd),
    ...eras.slice(1).map((e) => (Math.floor(p.debutYear / 5) === e ? 1 : 0)),
  ])
  const y = usable.map((p) => p[outcomeKey])
  const fit = fitOLS(X, y)
  if (!fit) return null
  const { beta, resid } = fit
  const n = X.length
  const k = X[0].length
  const s2 = resid.reduce((a, b) => a + b * b, 0) / (n - k)
  const XtXinv = invert(matTMat(X))
  const yMean = y.reduce((a, b) => a + b, 0) / n
  const ssTot = y.reduce((a, b) => a + (b - yMean) ** 2, 0)
  const ssRes = resid.reduce((a, b) => a + b * b, 0)
  console.log(`\n${label} — ${group}: n=${n}, R2=${(1 - ssRes / ssTot).toFixed(3)}`)
  const rowsOut = []
  keys.forEach((key, i) => {
    const b = beta[i + 1]
    const se = Math.sqrt(s2 * XtXinv[i + 1][i + 1])
    const t = b / se
    const p = tTwoSidedP(t, n - k)
    rowsOut.push({ key, beta: b, se, t, p })
    console.log(`  ${key.padEnd(18)} ${fmt(b, 3).padStart(8)} ± ${fmt(se, 3).padStart(6)}   t=${fmt(t, 2).padStart(6)}  p=${p < 0.0001 ? '<0.0001' : p.toFixed(4)}`)
  })
  return { n, r2: 1 - ssRes / ssTot, rows: rowsOut }
}

const REG_KEYS = ['seasonsToDebut', 'ageAtDebut', 'volume', 'aaaVolume', 'upperRate', 'kRate', 'bbRate', 'lastPeer']
const reg = {}
for (const group of ['hitting', 'pitching']) {
  reg[`rate:${group}`] = regress(rateSet, 'rookieRate', group, REG_KEYS, 'REGRESSION on rookie rate')
  reg[`war:${group}`] = regress(warSet, 'rookieWar', group, REG_KEYS, 'REGRESSION on rookie WAR')
}

// --- the headline cut, for the write-up -------------------------------------
// Age at debut, in plain buckets, because it is the trait a reader can actually
// carry to a ballpark.
console.log('\n=== rookie season by age at debut ===')
for (const group of ['hitting', 'pitching']) {
  const g = rateSet.filter((p) => p.group === group)
  const buckets = [
    ['21 or younger', (a) => a < 22],
    ['22', (a) => a >= 22 && a < 23],
    ['23', (a) => a >= 23 && a < 24],
    ['24', (a) => a >= 24 && a < 25],
    ['25', (a) => a >= 25 && a < 26],
    ['26 or older', (a) => a >= 26],
  ]
  console.log(`-- ${group}`)
  for (const [name, test] of buckets) {
    const b = g.filter((p) => p.ageAtDebut != null && test(p.ageAtDebut))
    if (b.length < 15) continue
    const rate = b.map((p) => p.rookieRate).sort((x, y) => x - y)
    const war = b.filter((p) => p.rookieWar != null).map((p) => p.rookieWar)
    console.log(
      `   ${name.padEnd(14)} n=${String(b.length).padStart(4)}  median rate ${fmt(percentile(rate, 0.5), 0).padStart(5)}  share above avg ${((100 * b.filter(aboveRate).length) / b.length).toFixed(0).padStart(3)}%  median WAR ${fmt(percentile([...war].sort((x, y) => x - y), 0.5), 1).padStart(5)}`,
    )
  }
}

await writeFile(
  join(here, 'q1-rookie-traits.json'),
  JSON.stringify(
    {
      meta: {
        cohort: eligible.length,
        rateSet: rateSet.length,
        warSet: warSet.length,
        agreement: { both: both.length, agree },
        minPT: MIN_PT,
      },
      comparisons: results,
      regressions: reg,
    },
    null,
    1,
  ),
)
console.log('\nwrote q1-rookie-traits.json')
