// POWER FIRST. This script runs and is committed BEFORE the analysis, and it
// never fits a line coefficient at any pedigree grain.
//
// The parent spike's proxy pedigree cut returned n=116 with an interval from
// 0.379 to 3.226 — consistent with almost anything. A true-rank cut is the same
// size or smaller. So the question that has to be answered first is not "what
// is the effect" but "what effect could this test SEE at all". A point estimate
// whose interval spans a halving and a doubling carries no information, and
// finding that out afterwards is finding it out too late.
//
// WHERE THE POWER ACTUALLY COMES FROM, which is smaller than the cohort.
// The model carries season fixed effects and three-day day-of-season bins. In a
// bin that sits wholly after the line in EVERY season, the line indicator is
// one in every cell of that bin, so the bin dummy absorbs it exactly and that
// bin tells the line coefficient nothing. Only the bins the line falls INSIDE
// in some seasons and not others identify it. The line lands between day 8 and
// day 15, so a handful of bins carry the whole test. `identifyingEvents` counts
// the promotions that land on those days, and it is the honest n of this test.
//
// Three calculations, all under the null:
//
//   ANALYTIC. Fit the design WITHOUT the tested term to the real counts, take
//   the fitted cell intensities as the null intensities, and read the
//   asymptotic standard error of the tested coefficient off the expected
//   information matrix of the FULL design evaluated at them. That standard
//   error is what the test will have. The minimum detectable effect at 80%
//   power and alpha 0.05 two-sided is exp(2.8016 x SE); exp(1.96 x SE) is the
//   smaller effect that would merely reach significance half the time.
//
//   SIMULATION, WALD. The parent spike reports a Wald interval, so this is the
//   test that is actually run. Simulate Poisson counts under the null
//   intensities scaled by a candidate rate ratio after the line, holding the
//   expected cohort size fixed, refit, and count rejections.
//
//   SIMULATION, LIKELIHOOD RATIO. The Wald test is not monotone in the effect
//   at this grain. As the true rate ratio grows the fit separates, and the
//   standard error grows faster than the coefficient, so the z statistic falls
//   back towards zero — the Hauck-Donner effect. A Wald power curve that peaks
//   and then DROPS is a property of the test, not of the data, so a
//   likelihood-ratio test is run beside it. It is the fair best case: the most
//   this design could detect if the test statistic were well behaved.
//
// Nothing here reads the real line coefficient at a pedigree grain. The one
// line coefficient it does fit is the parent spike's own published headline on
// the full cohort, used to prove this mirror of the model is faithful.
//
// Run: node .scratch/service-clock-pedigree/power.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCalendar, fmt } from '../service-clock/lib.mjs'
import { solve } from '../service-clock/glm.mjs'
import { buildDesign, fitLine, MAX_DAY, BIN } from './model.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const j = async (p) => JSON.parse(await readFile(p, 'utf8'))
const say = (s) => process.stdout.write(s + '\n')
const head = (s) => say(`\n${'='.repeat(78)}\n${s}\n${'='.repeat(78)}`)

const panel = await j(join(here, 'panel.json'))
const calendar = await loadCalendar()
const base = panel.filter((r) => r.inBase)
const CLUBS = [...new Set(base.map((r) => r.clubId))].sort((a, b) => a - b)

// --- 0. the mirror is faithful ----------------------------------------------

head('0. The model mirror reproduces the parent spike')
const naive = fitLine(base, calendar, CLUBS, { dayBins: false })
const full = fitLine(base, calendar, CLUBS, { dayBins: true })
say(`  season FE only          ratio ${fmt(naive.rateRatio, 3)}   published 1.560`)
say(`  + day-of-season bins    ratio ${fmt(full.rateRatio, 3)}   published 1.266`)
if (Math.abs(naive.rateRatio - 1.56) > 0.005 || Math.abs(full.rateRatio - 1.266) > 0.005) {
  throw new Error('the mirrored model does not reproduce the parent spike — do not trust anything below')
}
say("  Both match to three decimals. The specification below is the parent's.")

// --- the grains -------------------------------------------------------------

const OBS = new Set(['observed-deep', 'observed-shallow'])
const deepOnly = (r) => r.windowStatus === 'observed-deep'
const observed = (r) => OBS.has(r.windowStatus)
const ranked = (thr) => (r) => r.peakRankLE != null && r.peakRankLE <= thr

const GRAINS = [
  {
    key: 'top100-deep',
    label: 'top-100, observed-deep',
    note: 'A "ranked at all" cut is only comparable where every list year is a top-100 list, so it runs on the observed-deep window alone (debut 2016-2023).',
    events: base.filter((r) => deepOnly(r) && ranked(100)(r)),
  },
  {
    key: 'top30-obs',
    label: 'top-30, observed',
    note: 'Rank 30 exists on a top-50 list, so the shallow years are comparable and the observed window (debut 2013-2023) is usable.',
    events: base.filter((r) => observed(r) && ranked(30)(r)),
  },
  {
    key: 'top10-obs',
    label: 'top-10, observed',
    note: 'The grain the well-known individual cases live in.',
    events: base.filter((r) => observed(r) && ranked(10)(r)),
  },
  {
    key: 'top30-ext',
    label: 'top-30, all seasons',
    note: 'Every debut season 2009-2025. The censored years capture fewer ranked men, and a season fixed effect absorbs an undercount that does not vary across days within a season. An explicitly labelled power arm, never the primary.',
    events: base.filter(ranked(30)),
  },
  {
    key: 'top10-ext',
    label: 'top-10, all seasons',
    note: 'The same extension at the sharpest grain.',
    events: base.filter(ranked(10)),
  },
]

const INTERACTION = {
  key: 'top100-deep-interaction',
  label: 'top-100 x line, interaction',
  note: 'The rank-matched question asked as ONE model: does the line coefficient DIFFER between ranked and unranked men? The day-of-season bins are then estimated off all 399 men of the observed-deep cohort rather than off the 70 ranked ones.',
  // WHERE ITS POWER COMES FROM, AND WHAT IT COSTS. The subset fits are
  // identified only inside the bins the line falls in, because elsewhere the
  // bin dummy absorbs the indicator. The interaction is not: the day bins are
  // SHARED between the two groups, so the interaction is identified by the
  // ranked group's rate before the line against its rate after it, across all
  // forty-five days. That is far more information, and it is bought with an
  // assumption the subset fits never make — that absent a service clock a
  // top-100 prospect follows the SAME April promotion shape as everyone else.
  // The placebo is what tests that assumption: if shifted dates move the
  // interaction as much as the real line does, it is reading a shape
  // difference, not a discontinuity at the line.
  identification: 'shared day bins across groups; assumes a common April shape',
  events: base.filter(deepOnly),
  markGroup: ranked(100),
}

// --- IRLS, returning the deviance so a likelihood ratio can be taken ---------

function irls(rows, y, offset, p, { maxIter = 60, tol = 1e-10, ridge = 1e-8 } = {}) {
  let beta = new Array(p).fill(0)
  const total = y.reduce((a, b) => a + b, 0)
  beta[0] = Math.log(Math.max(total, 0.5) / Math.max(rows.length, 1))
  let lastDev = Infinity
  for (let it = 0; it < maxIter; it++) {
    const A = Array.from({ length: p }, () => new Array(p).fill(0))
    const b = new Array(p).fill(0)
    let dev = 0
    for (let i = 0; i < y.length; i++) {
      const row = rows[i]
      let eta = offset[i]
      for (const [k, v] of row) if (k < p) eta += v * beta[k]
      const mu = Math.exp(Math.min(30, eta))
      const w = Math.max(mu, 1e-10)
      const z = eta - offset[i] + (y[i] - mu) / w
      for (let a = 0; a < row.length; a++) {
        const [ka, va] = row[a]
        if (ka >= p) continue
        b[ka] += w * va * z
        for (let c = 0; c < row.length; c++) {
          const [kc, vc] = row[c]
          if (kc >= p) continue
          A[ka][kc] += w * va * vc
        }
      }
      dev += 2 * ((y[i] ? y[i] * Math.log(y[i] / mu) : 0) - (y[i] - mu))
    }
    for (let a = 0; a < p; a++) A[a][a] += ridge
    const next = solve(A, b)
    if (!next) return null
    beta = next
    if (Math.abs(lastDev - dev) < tol) {
      lastDev = dev
      break
    }
    lastDev = dev
  }
  return { beta, deviance: lastDev }
}

// SE of one column, from the expected information at given intensities.
function seOfColumn(rows, mu, p, col, ridge = 1e-8) {
  const I = Array.from({ length: p }, () => new Array(p).fill(0))
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    for (let a = 0; a < row.length; a++) {
      const [ka, va] = row[a]
      for (let c = 0; c < row.length; c++) {
        const [kc, vc] = row[c]
        I[ka][kc] += mu[i] * va * vc
      }
    }
  }
  for (let a = 0; a < p; a++) I[a][a] += ridge
  const e = new Array(p).fill(0)
  e[col] = 1
  const colv = solve(I, e)
  if (!colv) return null
  return Math.sqrt(Math.max(colv[col], 0))
}

function intensities(rows, offset, beta, p) {
  return rows.map((row, i) => {
    let eta = offset[i]
    for (const [k, v] of row) if (k < p) eta += v * beta[k]
    return Math.exp(Math.min(30, eta))
  })
}

// The tested column is always the LAST one, so the null model is the same
// design fitted with p reduced by one.
function assertLast(design, col) {
  if (col !== design.p - 1) throw new Error('the tested column is not last; the null fit would drop the wrong one')
}

// --- which days actually identify the line ----------------------------------

// A bin whose cells are all past the line, in every season, carries no
// information: the bin dummy absorbs the indicator exactly. Only the bins the
// line falls inside for SOME seasons identify the coefficient.
function identifyingDays(seasons) {
  const nBins = Math.ceil(MAX_DAY / BIN)
  const bins = []
  const days = new Set()
  for (let b = 0; b < nBins; b++) {
    const vals = new Set()
    for (const s of seasons) {
      const cal = calendar.get(s)
      const maxD = Math.min(MAX_DAY, cal.lengthDays - 1)
      for (let d = b * BIN + 1; d <= Math.min((b + 1) * BIN, maxD); d++) vals.add(d > cal.preLineDays - 1)
    }
    if (vals.size > 1) {
      bins.push(b)
      for (let d = b * BIN + 1; d <= Math.min((b + 1) * BIN, MAX_DAY); d++) days.add(d)
    }
  }
  return { bins, days: [...days].sort((a, b) => a - b) }
}

// --- the simulation ----------------------------------------------------------

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Knuth. Every cell intensity here is well under one, so this is exact and fast.
function rpois(lambda, rnd) {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rnd()
  } while (p > L)
  return k - 1
}

const SIMS = Number(process.env.SIMS ?? 1000)
const RR_GRID = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0]
const CHI1_95 = 3.841458820694124

function simulate(design, mu0, col, treatedFlag, seed) {
  const rnd = mulberry32(seed)
  const p = design.p
  const nullTotal = mu0.reduce((a, b) => a + b, 0)
  const out = []
  for (const rr of RR_GRID) {
    // Hold the expected cohort size fixed, so a rate ratio moves men across the
    // line rather than inventing extra promotions.
    let raw = 0
    for (let i = 0; i < mu0.length; i++) raw += mu0[i] * (treatedFlag[i] ? rr : 1)
    const c = nullTotal / raw
    const mu = mu0.map((m, i) => m * (treatedFlag[i] ? rr : 1) * c)

    let waldRight = 0
    let lrtRight = 0
    let converged = 0
    let sumPost = 0
    for (let s = 0; s < SIMS; s++) {
      const y = mu.map((m) => rpois(m, rnd))
      let post = 0
      for (let i = 0; i < y.length; i++) if (treatedFlag[i]) post += y[i]
      sumPost += post
      const fitF = irls(design.rows, y, design.offset, p, { maxIter: 40, tol: 1e-8 })
      const fitN = irls(design.rows, y, design.offset, p - 1, { maxIter: 40, tol: 1e-8 })
      if (!fitF || !fitN) continue
      converged++
      // Wald, exactly as the parent spike reports it. A non-finite standard
      // error is a FAILURE TO REJECT, never a discarded draw: dropping the
      // draws where the estimate runs away would inflate the power curve.
      const muHat = intensities(design.rows, design.offset, fitF.beta, p)
      const se = seOfColumn(design.rows, muHat, p, col)
      if (se != null && Number.isFinite(se) && se > 0 && fitF.beta[col] > 0 && Math.abs(fitF.beta[col] / se) >= 1.96) {
        waldRight++
      }
      // Likelihood ratio, which does not suffer the Hauck-Donner reversal.
      const lr = fitN.deviance - fitF.deviance
      if (Number.isFinite(lr) && lr >= CHI1_95 && fitF.beta[col] > 0) lrtRight++
    }
    out.push({
      rr,
      waldPower: waldRight / SIMS,
      lrtPower: lrtRight / SIMS,
      convergedShare: converged / SIMS,
      meanPostLineEvents: sumPost / SIMS,
    })
  }
  return out
}

function mdeFromCurve(curve, field, target = 0.8) {
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]
    const b = curve[i]
    if (a[field] < target && b[field] >= target) {
      const t = (target - a[field]) / (b[field] - a[field])
      return a.rr + t * (b.rr - a.rr)
    }
  }
  return null
}

// --- run ---------------------------------------------------------------------

const results = []
for (const g of [...GRAINS, INTERACTION]) {
  const isInter = !!g.markGroup
  const design = buildDesign(g.events, calendar, CLUBS, { dayBins: true, markGroup: g.markGroup ?? null })
  const col = isInter ? design.OFF_INTER : design.OFF_LINE
  assertLast(design, col)
  const fitNull = irls(design.rows, design.y, design.offset, design.p - 1)
  const mu0 = intensities(design.rows, design.offset, fitNull.beta, design.p - 1)
  const seAnalytic = seOfColumn(design.rows, mu0, design.p, col)

  const treatedFlag = design.rows.map((row) => row.some(([k]) => k === col))
  const curve = simulate(design, mu0, col, treatedFlag, 20260828 + results.length)

  const treatedEvents = isInter ? g.events.filter(g.markGroup) : g.events
  const post = treatedEvents.filter((r) => r.addRelDay >= 1).length
  const ident = identifyingDays(design.seasons)
  const identSet = new Set(ident.days)
  const identEvents = treatedEvents.filter((r) => identSet.has(r.addSeasonDay)).length

  results.push({
    key: g.key,
    label: g.label,
    note: g.note,
    identification: g.identification ?? 'within-group; identified only inside the bins the line falls in',
    nCohort: g.events.length,
    n: treatedEvents.length,
    postLine: post,
    preLine: treatedEvents.length - post,
    identifyingBins: ident.bins,
    identifyingDays: ident.days,
    identifyingEvents: identEvents,
    seasons: design.seasons,
    cells: design.rows.length,
    columns: design.p,
    analytic: {
      se: seAnalytic,
      mde80: seAnalytic == null ? null : Math.exp(2.8016 * seAnalytic),
      mdeJustSignificant: seAnalytic == null ? null : Math.exp(1.96 * seAnalytic),
      ciSpanFactorAtNull: seAnalytic == null ? null : Math.exp(1.96 * seAnalytic) ** 2,
    },
    simulation: {
      sims: SIMS,
      curve,
      mde80Wald: mdeFromCurve(curve, 'waldPower'),
      mde80Lrt: mdeFromCurve(curve, 'lrtPower'),
      maxWaldPower: Math.max(...curve.map((c) => c.waldPower)),
      maxLrtPower: Math.max(...curve.map((c) => c.lrtPower)),
      sizeWald: curve[0].waldPower,
      sizeLrt: curve[0].lrtPower,
    },
  })
}

head('MINIMUM DETECTABLE EFFECT, COMPUTED BEFORE THE TEST IS RUN')
say('  alpha 0.05 two-sided, power counted only for rejections in the right')
say('  direction. The cohort size is held fixed, so a rate ratio moves men across')
say('  the line rather than adding promotions.')
say('')
say(`  ${'grain'.padEnd(30)} ${'n'.padStart(4)} ${'ident'.padStart(5)} ${'SE'.padStart(6)} ${'MDE80'.padStart(8)} ${'MDE80'.padStart(6)} ${'MDE80'.padStart(6)}`)
say(`  ${''.padEnd(30)} ${''.padStart(4)} ${'n'.padStart(5)} ${''.padStart(6)} ${'analytic'.padStart(8)} ${'Wald'.padStart(6)} ${'LRT'.padStart(6)}`)
const show = (x) => (x == null ? 'none' : x.toFixed(2))
for (const r of results) {
  say(
    `  ${r.label.padEnd(30)} ${String(r.n).padStart(4)} ${String(r.identifyingEvents).padStart(5)} ${fmt(r.analytic.se, 3).padStart(6)} ${fmt(r.analytic.mde80, 2).padStart(8)} ${show(r.simulation.mde80Wald).padStart(6)} ${show(r.simulation.mde80Lrt).padStart(6)}`,
  )
}
say('')
say('  "none" means no rate ratio in the grid up to 10 reaches 80% power.')
say('')
for (const r of results) {
  say(`  ${r.label}`)
  say(`    seasons ${r.seasons.length}: ${r.seasons.join(', ')}`)
  say(`    the line is identified only inside day bins ${r.identifyingBins.join(', ')} — days ${r.identifyingDays[0]} to ${r.identifyingDays[r.identifyingDays.length - 1]}`)
  say(`    of ${r.n} promotions, ${r.identifyingEvents} land on those days`)
  say(`    a 95% Wald interval at the null spans a factor of ${fmt(r.analytic.ciSpanFactorAtNull, 1)} end to end`)
  const at = (v) => r.simulation.curve.find((c) => c.rr === v)
  say(`    Wald power 1.5 / 2 / 3 / 5 / 10: ${fmt(at(1.5).waldPower, 2)} / ${fmt(at(2).waldPower, 2)} / ${fmt(at(3).waldPower, 2)} / ${fmt(at(5).waldPower, 2)} / ${fmt(at(10).waldPower, 2)}   peak ${fmt(r.simulation.maxWaldPower, 2)}`)
  say(`    LRT  power 1.5 / 2 / 3 / 5 / 10: ${fmt(at(1.5).lrtPower, 2)} / ${fmt(at(2).lrtPower, 2)} / ${fmt(at(3).lrtPower, 2)} / ${fmt(at(5).lrtPower, 2)} / ${fmt(at(10).lrtPower, 2)}   peak ${fmt(r.simulation.maxLrtPower, 2)}`)
  say(`    size at the null (should be near 0.025 one-sided): Wald ${fmt(r.simulation.sizeWald, 3)}, LRT ${fmt(r.simulation.sizeLrt, 3)}`)
  say('')
}

await writeFile(join(here, 'power.json'), JSON.stringify({ builtAt: new Date().toISOString(), sims: SIMS, grid: RR_GRID, results }, null, 1))
say('wrote power.json')
