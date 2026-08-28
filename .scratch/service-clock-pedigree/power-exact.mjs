// POWER FIRST, part two: the model-free test.
//
// At a dozen promotions spread over six hundred cells a Poisson GLM carrying
// twenty-odd nuisance columns is the wrong instrument, and power.mjs shows it —
// the Wald statistic is not even monotone in the effect. So the spike also runs
// the parent's DECISIVE test, which needs no model at all.
//
// THE TEST. The line lands a different number of days into each season, so one
// fixed band of the calendar sits AFTER the line in some seasons and BEFORE it
// in others. Take the season-days in that band, split them by which side of
// the line they fall on, and compare the ranked-promotion rate per day between
// the two piles. Same days of April, opposite service consequence. The null
// distribution is the exact conditional binomial, so nothing is asymptotic.
//
// This script computes what that test could DETECT, before it is run. It uses
// only the exposure — how many season-days fall on each side — and the band's
// total promotions. It never looks at how those promotions SPLIT, which is the
// result.
//
// Run: node .scratch/service-clock-pedigree/power-exact.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCalendar, binomTest, lgamma, fmt } from '../service-clock/lib.mjs'
import { MAX_DAY } from './model.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const j = async (p) => JSON.parse(await readFile(p, 'utf8'))
const say = (s) => process.stdout.write(s + '\n')
const head = (s) => say(`\n${'='.repeat(78)}\n${s}\n${'='.repeat(78)}`)

const panel = await j(join(here, 'panel.json'))
const calendar = await loadCalendar()
const base = panel.filter((r) => r.inBase)

// The band: the days on which the line's position varies across seasons. A day
// outside it is on the same side of the line in every season, so it carries no
// contrast at all.
function bandFor(seasons) {
  const lineDay = new Map(seasons.map((s) => [s, calendar.get(s).preLineDays - 1]))
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
  // Exposure: season-days on each side of the line inside the band.
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
  return { days, expPost, expPre, lineDays: Object.fromEntries(lineDay) }
}

// Exact power. k1 | N ~ Bin(N, pi(rr)) with pi = rr*E1 / (rr*E1 + E0); the test
// is the exact two-sided binomial against pi0 = E1 / (E1 + E0).
function exactPower(N, expPost, expPre, rr, alpha = 0.05) {
  const p0 = expPost / (expPost + expPre)
  const pA = (rr * expPost) / (rr * expPost + expPre)
  const logC = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1)
  let power = 0
  for (let k = 0; k <= N; k++) {
    const t = binomTest(k, N, p0)
    if (t.p > alpha) continue
    // Only count a rejection that points the right way.
    if (k / N <= p0) continue
    power += Math.exp(logC(N, k) + k * Math.log(pA) + (N - k) * Math.log(1 - pA))
  }
  return power
}

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

const RR_GRID = [1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20]
const results = []
for (const g of GRAINS) {
  const seasons = [...new Set(g.events.map((r) => r.debutSeason))].sort((a, b) => a - b)
  const band = bandFor(seasons)
  const bandDays = new Set(band.days)
  const N = g.events.filter((r) => bandDays.has(r.addSeasonDay)).length
  const curve = RR_GRID.map((rr) => ({ rr, power: exactPower(N, band.expPost, band.expPre, rr) }))
  let mde80 = null
  for (let i = 1; i < curve.length; i++) {
    if (curve[i - 1].power < 0.8 && curve[i].power >= 0.8) {
      const t = (0.8 - curve[i - 1].power) / (curve[i].power - curve[i - 1].power)
      mde80 = curve[i - 1].rr + t * (curve[i].rr - curve[i - 1].rr)
      break
    }
  }
  results.push({
    key: g.key,
    label: g.label,
    seasons,
    bandDays: band.days,
    exposurePostLineDays: band.expPost,
    exposurePreLineDays: band.expPre,
    nInBand: N,
    nTotal: g.events.length,
    curve,
    mde80,
    maxPower: Math.max(...curve.map((c) => c.power)),
  })
}

head('EXACT TEST — WHAT IT COULD DETECT, COMPUTED BEFORE IT IS RUN')
say('  The band is the set of days that fall on DIFFERENT sides of the line in')
say('  different seasons. Only promotions landing there carry any contrast.')
say('')
say(`  ${'grain'.padEnd(28)} ${'band'.padStart(9)} ${'exposure'.padStart(12)} ${'n in'.padStart(5)} ${'MDE80'.padStart(6)} ${'peak'.padStart(5)}`)
say(`  ${''.padEnd(28)} ${'days'.padStart(9)} ${'post/pre'.padStart(12)} ${'band'.padStart(5)} ${''.padStart(6)} ${'power'.padStart(5)}`)
for (const r of results) {
  say(
    `  ${r.label.padEnd(28)} ${(r.bandDays[0] + '-' + r.bandDays[r.bandDays.length - 1]).padStart(9)} ${(r.exposurePostLineDays + '/' + r.exposurePreLineDays).padStart(12)} ${String(r.nInBand).padStart(5)} ${(r.mde80 == null ? 'none' : r.mde80.toFixed(2)).padStart(6)} ${fmt(r.maxPower, 2).padStart(5)}`,
  )
}
say('')
say('  "none" means no rate ratio up to 20 reaches 80% power. "peak power" is the')
say('  best this test can do at ANY effect size, so a peak below 0.80 means the')
say('  grain cannot reach the conventional standard however large the truth is.')
say('')
for (const r of results) {
  const at = (v) => r.curve.find((c) => c.rr === v)
  say(`  ${r.label}: ${r.nInBand} of ${r.nTotal} promotions land in the band`)
  say(`    power at 2 / 3 / 5 / 10: ${fmt(at(2).power, 2)} / ${fmt(at(3).power, 2)} / ${fmt(at(5).power, 2)} / ${fmt(at(10).power, 2)}`)
}

await writeFile(join(here, 'power-exact.json'), JSON.stringify({ builtAt: new Date().toISOString(), grid: RR_GRID, results }, null, 1))
say('\nwrote power-exact.json')
