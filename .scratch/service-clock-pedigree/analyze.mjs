// The retest, at true pedigree grain.
//
// READ power.json AND power-exact.json FIRST. They were computed and committed
// before this script existed, and they decide how anything below may be read.
// The short version: at top-10 only two promotions land on a day that carries
// any contrast at all, and the exact test's peak power there is zero — it
// cannot reject at ANY effect size. A point estimate from a test that cannot
// reject is not evidence about clubs.
//
// Two tests at every grain, because one of them is unfit for this n:
//
//   THE PARENT'S POISSON GLM, so the numbers are comparable with the published
//   null. Its Wald statistic is reported with a likelihood-ratio p beside it,
//   because power.mjs shows the Wald test is not monotone in the effect here.
//
//   THE EXACT CONDITIONAL TEST, which needs no model. The line lands a
//   different number of days into each season, so one fixed band of the
//   calendar sits after the line in some seasons and before it in others. Same
//   days of April, opposite service consequence. The null distribution is the
//   conditional binomial, so nothing is asymptotic and nothing is fitted.
//
// Run: node .scratch/service-clock-pedigree/analyze.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCalendar, binomTest, lgamma, zToP, fmt, pct } from '../service-clock/lib.mjs'
import { poissonFitSparse } from '../service-clock/glm.mjs'
import { buildDesign, fitLine, MAX_DAY } from './model.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const j = async (p) => JSON.parse(await readFile(p, 'utf8'))
const say = (s) => process.stdout.write(s + '\n')
const head = (s) => say(`\n${'='.repeat(78)}\n${s}\n${'='.repeat(78)}`)

const panel = await j(join(here, 'panel.json'))
const power = await j(join(here, 'power.json'))
const powerExact = await j(join(here, 'power-exact.json'))
const calendar = await loadCalendar()
const base = panel.filter((r) => r.inBase)
const CLUBS = [...new Set(base.map((r) => r.clubId))].sort((a, b) => a - b)
const out = {}

// --- the grains, defined exactly as the power scripts defined them ----------

const OBS = new Set(['observed-deep', 'observed-shallow'])
const deepOnly = (r) => r.windowStatus === 'observed-deep'
const observed = (r) => OBS.has(r.windowStatus)
const ranked = (thr) => (r) => r.peakRankLE != null && r.peakRankLE <= thr

const GRAINS = [
  { key: 'top100-deep', label: 'top-100, observed-deep', events: base.filter((r) => deepOnly(r) && ranked(100)(r)) },
  { key: 'top30-obs', label: 'top-30, observed', events: base.filter((r) => observed(r) && ranked(30)(r)) },
  { key: 'top10-obs', label: 'top-10, observed', events: base.filter((r) => observed(r) && ranked(10)(r)) },
  { key: 'top30-ext', label: 'top-30, all seasons', events: base.filter(ranked(30)) },
  { key: 'top10-ext', label: 'top-10, all seasons', events: base.filter(ranked(10)) },
  { key: 'all', label: 'the whole cohort, for scale', events: base },
]
const powerByKey = new Map(power.results.map((r) => [r.key, r]))
const exactPowerByKey = new Map(powerExact.results.map((r) => [r.key, r]))

// --- the exact conditional test ---------------------------------------------

function bandFor(seasons, shift = 0) {
  const lineDay = new Map(seasons.map((s) => [s, calendar.get(s).preLineDays - 1 + shift]))
  const days = []
  for (let d = 1; d <= MAX_DAY; d++) {
    const sides = new Set()
    for (const s of seasons) {
      const cal = calendar.get(s)
      if (d > Math.min(MAX_DAY, cal.lengthDays - 1)) continue
      sides.add(d > lineDay.get(s))
    }
    if (sides.size > 1) days.push(d)
  }
  let expPost = 0
  let expPre = 0
  for (const s of seasons) {
    const cal = calendar.get(s)
    for (const d of days) {
      if (d > Math.min(MAX_DAY, cal.lengthDays - 1)) continue
      if (d > lineDay.get(s)) expPost++
      else expPre++
    }
  }
  return { days, expPost, expPre, lineDay }
}

const logC = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1)
function binomTailGE(k, n, p) {
  let s = 0
  for (let i = k; i <= n; i++) s += Math.exp(logC(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p))
  return s
}
function binomTailLE(k, n, p) {
  let s = 0
  for (let i = 0; i <= k; i++) s += Math.exp(logC(n, i) + i * Math.log(p) + (n - i) * Math.log(1 - p))
  return s
}
// Clopper-Pearson on the conditional binomial, by bisection.
function cpInterval(k, n, alpha = 0.05) {
  const bisect = (f, lo, hi) => {
    for (let i = 0; i < 200; i++) {
      const m = (lo + hi) / 2
      if (f(m) > 0) hi = m
      else lo = m
    }
    return (lo + hi) / 2
  }
  const lower = k === 0 ? 0 : bisect((p) => binomTailGE(k, n, p) - alpha / 2, 1e-12, 1 - 1e-12)
  const upper = k === n ? 1 : bisect((p) => alpha / 2 - binomTailLE(k, n, p), 1e-12, 1 - 1e-12)
  return [lower, upper]
}

// The band test. Exposure is season-days, so the estimand is the same rate
// ratio the GLM reports: promotions per day after the line against before it.
function exactTest(events, seasons, shift = 0) {
  const band = bandFor(seasons, shift)
  const days = new Set(band.days)
  let k1 = 0
  let k0 = 0
  for (const r of events) {
    if (!days.has(r.addSeasonDay)) continue
    if (r.addSeasonDay > band.lineDay.get(r.debutSeason)) k1++
    else k0++
  }
  const N = k1 + k0
  const { expPost: E1, expPre: E0 } = band
  const p0 = E1 / (E1 + E0)
  const t = N ? binomTest(k1, N, p0) : { p: 1 }
  const toRR = (pi) => (pi >= 1 ? Infinity : (pi / (1 - pi)) * (E0 / E1))
  const ci = N ? cpInterval(k1, N, 0.05).map(toRR) : [null, null]
  return {
    bandDays: band.days,
    exposurePost: E1,
    exposurePre: E0,
    kPost: k1,
    kPre: k0,
    n: N,
    ratePost: E1 ? k1 / E1 : null,
    ratePre: E0 ? k0 / E0 : null,
    rateRatio: k0 && E1 ? (k1 / E1) / (k0 / E0) : k1 ? Infinity : null,
    ci,
    p: t.p,
  }
}

// --- the GLM, with a likelihood-ratio p beside the Wald one ------------------

function glm(events, opts = {}) {
  const w = fitLine(events, calendar, CLUBS, { dayBins: true, ...opts })
  if (!w) return null
  const design = buildDesign(events, calendar, CLUBS, { dayBins: true, ...opts })
  const col = opts.markGroup ? design.OFF_INTER : design.OFF_LINE
  let lrtP = null
  if (col === design.p - 1) {
    // poissonFitSparse has no out-of-range guard on a column index, so the
    // null fit gets the tested column stripped rather than merely ignored.
    const nullRows = design.rows.map((r) => r.filter(([k]) => k !== col))
    const f = poissonFitSparse(design.rows, design.y, design.offset, design.p)
    const n0 = poissonFitSparse(nullRows, design.y, design.offset, design.p - 1)
    if (f && n0) {
      const lr = n0.deviance - f.deviance
      lrtP = Number.isFinite(lr) && lr > 0 ? zToP(Math.sqrt(lr)) : 1
      w.lr = lr
    }
  }
  w.lrtP = lrtP
  return w
}

// --- 1. the headline at each grain ------------------------------------------

head('1. THE RETEST AT TRUE PEDIGREE GRAIN')
say('  Read the power columns first. They were fixed before any of this was run.')
say('')
say(
  `  ${'grain'.padEnd(28)} ${'n'.padStart(4)} ${'RR'.padStart(7)} ${'95% CI'.padStart(17)} ${'Wald'.padStart(6)} ${'LRT'.padStart(6)} ${'MDE80'.padStart(6)}`,
)
const grainOut = {}
for (const g of GRAINS) {
  const f = glm(g.events)
  const pw = powerByKey.get(g.key)
  const ex = exactTest(g.events, [...new Set(g.events.map((r) => r.debutSeason))].sort((a, b) => a - b))
  grainOut[g.key] = { label: g.label, n: g.events.length, glm: f, exact: ex, power: pw ?? null, exactPower: exactPowerByKey.get(g.key) ?? null }
  const mde = pw?.simulation?.mde80Lrt
  say(
    `  ${g.label.padEnd(28)} ${String(g.events.length).padStart(4)} ${fmt(f.rateRatio, 3).padStart(7)} ${(fmt(f.ci?.[0], 3) + '-' + fmt(f.ci?.[1], 3)).padStart(17)} ${fmt(f.p, 3).padStart(6)} ${fmt(f.lrtP, 3).padStart(6)} ${(mde == null ? 'none' : mde.toFixed(1)).padStart(6)}`,
  )
}
say('')
say('  The same grains under the EXACT test, which fits nothing:')
say('')
say(`  ${'grain'.padEnd(28)} ${'band n'.padStart(7)} ${'post/pre'.padStart(9)} ${'RR'.padStart(7)} ${'95% CI'.padStart(19)} ${'p'.padStart(6)}`)
for (const g of GRAINS) {
  const e = grainOut[g.key].exact
  const ciTxt = e.ci[0] == null ? '—' : `${fmt(e.ci[0], 2)}-${e.ci[1] === Infinity ? 'inf' : fmt(e.ci[1], 2)}`
  say(
    `  ${g.label.padEnd(28)} ${String(e.n).padStart(7)} ${(e.kPost + '/' + e.kPre).padStart(9)} ${fmt(e.rateRatio, 3).padStart(7)} ${ciTxt.padStart(19)} ${fmt(e.p, 3).padStart(6)}`,
  )
}
out.grains = grainOut

// --- 2. the rank-matched control, as one model ------------------------------

head('2. KILL CRITERION — rank-matched controls')
say('  A club only gains by managing the clock for a man it means to hold six')
say('  years, so the effect must be LARGER for ranked men. Asked as one model:')
say('  does the line coefficient DIFFER between ranked and unranked men?')
say('')
const deepCohort = base.filter(deepOnly)
const interactions = {}
for (const thr of [100, 30, 10]) {
  const f = glm(deepCohort, { markGroup: ranked(thr) })
  interactions[`top${thr}`] = f
  say(
    `  top-${String(thr).padEnd(4)} x line   interaction ${fmt(f.interaction.rateRatio, 3)}  CI ${fmt(f.interaction.ci?.[0], 3)}-${fmt(f.interaction.ci?.[1], 3)}  Wald p=${fmt(f.interaction.p, 3)}  LRT p=${fmt(f.lrtP, 3)}`,
  )
}
say('')
say('  The interaction is the only specification here with usable power, and it')
say('  buys that power with an assumption the subset fits never make: that absent')
say('  a service clock a ranked man follows the SAME April promotion shape as an')
say('  unranked one. Section 4 tests exactly that assumption.')
out.interaction = interactions

// --- 3. monotonicity ---------------------------------------------------------

head('3. Does the estimate sharpen as the pedigree sharpens?')
say('  A practice aimed at the men worth holding should grow as the cut tightens.')
say('')
for (const key of ['top100-deep', 'top30-obs', 'top10-obs']) {
  const g = grainOut[key]
  say(`  ${g.label.padEnd(28)} n ${String(g.n).padStart(3)}   GLM ${fmt(g.glm.rateRatio, 3)}   exact ${fmt(g.exact.rateRatio, 3)} on ${g.exact.n} in-band promotions`)
}

// --- 4. the placebo ----------------------------------------------------------

head('4. KILL CRITERION — the placebo')
say('  Each season\'s line is slid by a fixed number of days and everything is')
say('  refitted. A real line must stand out from its neighbours. In the parent')
say('  spike three shifted dates were individually MORE significant than the')
say('  true line, and the pedigree cut gets no easier test.')
say('')
const placebo = {}
for (const key of ['top100-deep', 'top30-obs', 'top30-ext']) {
  const g = GRAINS.find((x) => x.key === key)
  const seasons = [...new Set(g.events.map((r) => r.debutSeason))].sort((a, b) => a - b)
  const sweep = []
  for (let k = -10; k <= 40; k += 2) {
    const f = glm(g.events, { shift: k })
    const e = exactTest(g.events, seasons, k)
    if (f) sweep.push({ shift: k, ratio: f.rateRatio, p: f.p, lrtP: f.lrtP, exactRatio: e.rateRatio, exactP: e.p, exactN: e.n })
  }
  const real = sweep.find((s) => s.shift === 0)
  const others = sweep.filter((s) => s.shift !== 0)
  const atLeast = others.filter((s) => Number.isFinite(s.ratio) && s.ratio >= real.ratio).length
  const permP = (atLeast + 1) / (others.length + 1)
  placebo[key] = { sweep, real, placebosAtLeastAsLarge: atLeast, placebosRun: others.length, permutationP: permP }
  say(`  ${grainOut[key].label}`)
  say(`    true line   GLM ${fmt(real.ratio, 3)} (p=${fmt(real.p, 3)}, LRT p=${fmt(real.lrtP, 3)})   exact ${fmt(real.exactRatio, 3)} (p=${fmt(real.exactP, 3)}) on ${real.exactN}`)
  say(`    placebo shifts at least as large: ${atLeast} of ${others.length}  ->  permutation p = ${fmt(permP, 3)}`)
  const sig = others.filter((s) => s.p < 0.05)
  say(`    placebo shifts individually significant at p<0.05: ${sig.length}${sig.length ? ' (shifts ' + sig.map((s) => s.shift).join(', ') + ')' : ''}`)
  say('')
}
// The same placebo on the interaction, which is the specification with power.
const interPlacebo = []
for (let k = -10; k <= 40; k += 2) {
  const f = glm(deepCohort, { markGroup: ranked(100), shift: k })
  if (f) interPlacebo.push({ shift: k, ratio: f.interaction.rateRatio, p: f.interaction.p, lrtP: f.lrtP })
}
const interReal = interPlacebo.find((s) => s.shift === 0)
const interOthers = interPlacebo.filter((s) => s.shift !== 0)
const interAtLeast = interOthers.filter((s) => Number.isFinite(s.ratio) && s.ratio >= interReal.ratio).length
say('  top-100 x line INTERACTION under the same placebo sweep')
say(`    true line ${fmt(interReal.ratio, 3)} (p=${fmt(interReal.p, 3)})`)
say(`    placebo shifts at least as large: ${interAtLeast} of ${interOthers.length}  ->  permutation p = ${fmt((interAtLeast + 1) / (interOthers.length + 1), 3)}`)
const interSig = interOthers.filter((s) => s.p < 0.05)
say(`    placebo shifts individually significant: ${interSig.length}${interSig.length ? ' (shifts ' + interSig.map((s) => s.shift).join(', ') + ')' : ''}`)
placebo.interaction = { sweep: interPlacebo, real: interReal, placebosAtLeastAsLarge: interAtLeast, placebosRun: interOthers.length, permutationP: (interAtLeast + 1) / (interOthers.length + 1) }
out.placebo = placebo

// --- 5. roster need ----------------------------------------------------------

head('5. KILL CRITERION — roster need')
say('  Injured-list placements by the promoting club in the 21 days before the')
say('  promotion, at the arriving man\'s own side of the roster. In the parent')
say('  spike this ran AGAINST the clock reading: need is higher BEFORE the line.')
say('')
const need = {}
for (const key of ['top100-deep', 'top30-obs', 'all']) {
  const g = GRAINS.find((x) => x.key === key)
  const pre = g.events.filter((r) => r.addRelDay <= 0)
  const post = g.events.filter((r) => r.addRelDay >= 1)
  const m = (a) => (a.length ? a.reduce((x, y) => x + y.ilSameGroup21, 0) / a.length : null)
  need[key] = { meanBefore: m(pre), meanAfter: m(post), nBefore: pre.length, nAfter: post.length }
  say(`  ${grainOut[key].label.padEnd(28)} before the line ${fmt(m(pre), 2)} (n=${pre.length})   after ${fmt(m(post), 2)} (n=${post.length})`)
}
out.rosterNeed = need

// --- 6. club fixed effects ---------------------------------------------------

head('6. KILL CRITERION — club fixed effects')
say('  The parent spike showed a club dummy is ORTHOGONAL to the line: the line')
say('  falls on the same date for all thirty clubs in a season, so adding club')
say('  dummies cannot move the coefficient, and its doing nothing is arithmetic')
say('  rather than a passed test. That reasoning is unchanged here, so it is not')
say('  repeated as though it were evidence.')
say('')
say('  The within-club question the parent asked instead — give every club its')
say('  own line coefficient and test whether they differ — CANNOT be asked at')
say('  this grain, and the reason is countable:')
for (const key of ['top100-deep', 'top30-obs', 'top10-obs']) {
  const g = GRAINS.find((x) => x.key === key)
  const clubs = new Set(g.events.map((r) => r.clubId))
  say(`    ${grainOut[key].label.padEnd(28)} ${g.events.length} promotions across ${clubs.size} clubs — ${fmt(g.events.length / clubs.size, 2)} per club`)
}
say('  A model asking thirty clubs to differ needs thirty coefficients. It is not')
say('  run, and no club is named.')
out.clubs = Object.fromEntries(
  ['top100-deep', 'top30-obs', 'top10-obs'].map((k) => {
    const g = GRAINS.find((x) => x.key === k)
    return [k, { promotions: g.events.length, clubs: new Set(g.events.map((r) => r.clubId)).size }]
  }),
)

// --- 7. leave one season out -------------------------------------------------

head('7. Leave one season out')
const loso = {}
for (const key of ['top100-deep', 'top30-obs', 'top30-ext']) {
  const g = GRAINS.find((x) => x.key === key)
  const seasons = [...new Set(g.events.map((r) => r.debutSeason))].sort((a, b) => a - b)
  const fits = []
  for (const s of seasons) {
    const f = glm(g.events.filter((r) => r.debutSeason !== s))
    if (f) fits.push({ dropped: s, ratio: f.rateRatio, p: f.p, lrtP: f.lrtP })
  }
  const sig = fits.filter((f) => f.p < 0.05).length
  const sigL = fits.filter((f) => f.lrtP != null && f.lrtP < 0.05).length
  loso[key] = { fits, significantWald: sig, significantLrt: sigL }
  say(
    `  ${grainOut[key].label.padEnd(28)} ${fits.length} refits, ratio ${fmt(Math.min(...fits.map((f) => f.ratio)), 3)} to ${fmt(Math.max(...fits.map((f) => f.ratio)), 3)}; significant in ${sig} of ${fits.length} (Wald), ${sigL} of ${fits.length} (LRT)`,
  )
}
out.loso = loso

// --- 8. sensitivity ----------------------------------------------------------

head('8. Sensitivity — the choices that could have made this come out otherwise')
const rankedAny = (thr) => (r) => r.peakRankAny != null && r.peakRankAny <= thr
const sens = {}
say('  a. peak rank known at promotion time, against peak rank over the whole')
say('     ranking window (which lets a rank published AFTER the debut season in):')
for (const [label, filt, base2] of [
  ['top-100 observed-deep', ranked(100), deepCohort],
  ['top-30 observed', ranked(30), base.filter(observed)],
]) {
  const a = glm(base2.filter(filt))
  const anyF = label.startsWith('top-100') ? rankedAny(100) : rankedAny(30)
  const b = glm(base2.filter(anyF))
  sens[label] = { knownAtPromotion: a, wholeWindow: b }
  say(`     ${label.padEnd(24)} known at promotion ${fmt(a.rateRatio, 3)} (n=${a.n})   whole window ${fmt(b.rateRatio, 3)} (n=${b.n})`)
}
say('')
say('  b. the window groups. The censored years capture fewer ranked men because')
say('     the lists that would have named them do not exist. Coding those men as')
say('     unranked is the trap the prospect-value spike measured at a 35%')
say('     overstatement, so they never enter a ranked-versus-unranked comparison:')
const wc = {}
for (const r of base) wc[r.windowStatus] = (wc[r.windowStatus] ?? 0) + 1
say(`     base cohort by window: ${JSON.stringify(wc)}`)
const capt = {}
for (const r of base) {
  const k = r.windowStatus
  capt[k] = capt[k] ?? { n: 0, ranked: 0 }
  capt[k].n++
  if (r.peakRankLE != null && r.peakRankLE <= 30) capt[k].ranked++
}
for (const [k, v] of Object.entries(capt)) {
  say(`     ${k.padEnd(18)} ${v.ranked} of ${v.n} promotions are top-30 (${pct(v.ranked / v.n)})`)
}
say('     The censored share is lower because the early lists are missing, not')
say('     because those men were worse. A season fixed effect absorbs it.')
out.sensitivity = { fits: sens, windowCounts: wc, top30ShareByWindow: capt }

// --- 9. the descriptive picture ---------------------------------------------

head('9. What the raw calendar looks like, before any control')
say('  This is the number the day-of-season shape explains away in the parent')
say('  spike. It is shown for completeness, not as evidence.')
say('')
for (const key of ['top100-deep', 'top30-obs', 'top10-obs', 'all']) {
  const g = GRAINS.find((x) => x.key === key)
  const post = g.events.filter((r) => r.addRelDay >= 1).length
  say(`  ${grainOut[key].label.padEnd(28)} ${post} of ${g.events.length} promotions fall after the line (${pct(post / g.events.length)})`)
}
say('')
say('  Every grain sits near the cohort share, and the cohort share is mostly')
say('  exposure: only a week or two of the first forty-five days sits before the')
say('  line at all.')

await writeFile(join(here, 'findings.json'), JSON.stringify(out, null, 1))
say('\nwrote findings.json')
