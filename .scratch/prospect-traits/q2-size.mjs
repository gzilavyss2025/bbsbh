// Q2: does a player's size — above or below the average — lengthen or shorten
// his stay in the minors?
//
// THE PHRASING MATTERS AND IS TESTED LITERALLY. "Either above or below the
// average" is not the same question as "does height help". It asks whether
// being UNUSUAL in either direction costs a player time — a club taking longer
// to trust the 5'8" second baseman AND longer to sort out the 6'7" arm. That is
// a U-shape, not a slope, and a plain linear term cannot see it. So every model
// here is run three ways:
//    linear      z(size)          — does bigger move faster?
//    quadratic   z(size)²         — does the middle move fastest?
//    deviation   |z(size)|        — does being unusual, either way, cost time?
// A finding that only shows up in one of the three is reported as such.
//
// THREE OUTCOMES, on purpose. Time in the minors has no single honest ruler,
// and the standing notes on this research say why: the transaction wire is
// thin before 2011 and every duration drawn from it inherits that. So the
// headline runs on the WIRE-FREE measures — seasons from first professional
// season to debut, and total playing time accumulated — with the wire-dated
// days reported alongside as the third opinion rather than the first.
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCohort, here, fmt, summarize } from './lib.mjs'
import { fitOLS, invert, matTMat, tTwoSidedP, clusterCov } from '../level-benchmarks/homegrown-stats.mjs'

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
  // Body mass index, the one summary that separates "tall" from "heavy" —
  // 703 * lb / in², the customary-units form.
  p.bmi = p.heightIn && p.weightLb ? (703 * p.weightLb) / p.heightIn ** 2 : null
}

const cohort = players.filter(
  (p) => p.heightIn && p.weightLb && p.seasonsToDebut != null && p.seasonsToDebut >= 0 && p.posGroup,
)
console.log(`cohort with size + a wire-free clock: ${cohort.length} of ${players.length}`)

// --- how big are they, and how much do they vary? ---------------------------
console.log('\n=== the population ===')
for (const grp of ['P', 'C', 'MID', 'CORNER']) {
  const g = cohort.filter((p) => p.posGroup === grp)
  const h = summarize(g.map((p) => p.heightIn))
  const w = summarize(g.map((p) => p.weightLb))
  console.log(
    `  ${grp.padEnd(7)} n=${String(g.length).padStart(4)}  height ${fmt(h.median, 1)}" (sd ${fmt(h.sd, 1)})   weight ${fmt(w.median, 0)}lb (sd ${fmt(w.sd, 1)})`,
  )
}

// Standardize WITHIN position group. A 6'4" pitcher is ordinary and a 6'4"
// second baseman is not, so a league-wide z-score would just re-measure
// position. This is the whole reason the question is worth asking carefully.
const byGroup = {}
for (const grp of [...new Set(cohort.map((p) => p.posGroup))]) {
  const g = cohort.filter((p) => p.posGroup === grp)
  const stat = (key) => {
    const v = g.map((p) => p[key]).filter(Number.isFinite)
    const m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
    return { m, sd }
  }
  byGroup[grp] = { height: stat('heightIn'), weight: stat('weightLb'), bmi: stat('bmi') }
}
for (const p of cohort) {
  const g = byGroup[p.posGroup]
  p.zHeight = (p.heightIn - g.height.m) / g.height.sd
  p.zWeight = (p.weightLb - g.weight.m) / g.weight.sd
  p.zBmi = p.bmi == null ? null : (p.bmi - g.bmi.m) / g.bmi.sd
}

// --- models ------------------------------------------------------------------
function fit({ set, outcome, sizeKey, form, label, log = false, clusterBy = null }) {
  const usable = set.filter((p) => Number.isFinite(p[outcome]) && Number.isFinite(p[sizeKey]) && (!log || p[outcome] > 0))
  if (usable.length < 80) return null
  const z = (p) => p[sizeKey]
  const sizeTerms = (p) =>
    form === 'linear' ? [z(p)] : form === 'quadratic' ? [z(p), z(p) ** 2] : [Math.abs(z(p))]
  const groups = [...new Set(usable.map((p) => p.posGroup))].sort().slice(1)
  const tiers = [...new Set(usable.map((p) => p.draftTier))].sort().slice(1)
  const eras = [...new Set(usable.map((p) => Math.floor(p.debutYear / 5)))].sort().slice(1)
  const X = usable.map((p) => [
    1,
    ...sizeTerms(p),
    ...groups.map((g) => (p.posGroup === g ? 1 : 0)),
    ...tiers.map((t) => (p.draftTier === t ? 1 : 0)),
    ...eras.map((e) => (Math.floor(p.debutYear / 5) === e ? 1 : 0)),
  ])
  const y = usable.map((p) => (log ? Math.log(p[outcome]) : p[outcome]))
  const f = fitOLS(X, y)
  if (!f) return null
  const n = X.length
  const k = X[0].length
  const XtXinv = invert(matTMat(X))
  let cov
  if (clusterBy) {
    cov = clusterCov(X, f.resid, usable.map(clusterBy), XtXinv).cov
  } else {
    const s2 = f.resid.reduce((a, b) => a + b * b, 0) / (n - k)
    cov = XtXinv.map((row) => row.map((v) => v * s2))
  }
  const names = form === 'quadratic' ? [`${sizeKey}`, `${sizeKey}²`] : form === 'deviation' ? [`|${sizeKey}|`] : [`${sizeKey}`]
  const out = names.map((name, i) => {
    const b = f.beta[i + 1]
    const se = Math.sqrt(cov[i + 1][i + 1])
    return { name, beta: b, se, p: tTwoSidedP(b / se, n - k) }
  })
  const yMean = y.reduce((a, b) => a + b, 0) / n
  const r2 = 1 - f.resid.reduce((a, b) => a + b * b, 0) / y.reduce((a, b) => a + (b - yMean) ** 2, 0)
  console.log(`  ${label.padEnd(46)} n=${String(n).padStart(4)}  ` + out.map((o) => `${o.name} ${fmt(o.beta, 3)}±${fmt(o.se, 3)} p=${o.p < 0.0001 ? '<1e-4' : o.p.toFixed(3)}`).join('   '))
  return { n, r2, terms: out }
}

const results = {}
console.log('\n=== outcome 1: seasons from first professional season to MLB debut ===')
console.log('(wire-free. Positive = the trait ADDS time in the minors.)')
for (const sizeKey of ['zHeight', 'zWeight', 'zBmi']) {
  for (const form of ['linear', 'quadratic', 'deviation']) {
    results[`seasons:${sizeKey}:${form}`] = fit({
      set: cohort, outcome: 'seasonsToDebut', sizeKey, form, label: `${sizeKey} ${form}`,
    })
  }
}

console.log('\n=== outcome 2: total minor-league playing time before the debut ===')
console.log('(wire-free. log scale, so a coefficient is roughly a percentage.)')
for (const sizeKey of ['zHeight', 'zWeight', 'zBmi']) {
  for (const form of ['linear', 'quadratic', 'deviation']) {
    results[`volume:${sizeKey}:${form}`] = fit({
      set: cohort.filter((p) => p.totalVolume > 0), outcome: 'totalVolume', sizeKey, form, log: true, label: `${sizeKey} ${form}`,
    })
  }
}

// --- outcome 3: the wire-dated days ------------------------------------------
// One row per level stay, clustered on the player, matching how every duration
// model in this research has been fitted. Reported third and trusted least,
// for the reasons in the standing notes.
const durRows = []
const byId = new Map(cohort.map((p) => [p.id, p]))
for (const p of cohort) {
  for (const d of p.durations) {
    if (d.days > 0 && d.days <= 900) durRows.push({ ...d, p })
  }
}
console.log(`\n=== outcome 3: wire-dated days at a level (${durRows.length} stays, ${new Set(durRows.map((r) => r.playerId)).size} players) ===`)
for (const sizeKey of ['zHeight', 'zWeight', 'zBmi']) {
  for (const form of ['linear', 'quadratic', 'deviation']) {
    const set = durRows.map((r) => ({
      ...r.p,
      days: r.days,
      level: r.level,
      durSeason: r.season,
      clusterId: r.playerId,
    }))
    // level dummies replace position dummies here — a stay is at a level.
    const usable = set.filter((p) => Number.isFinite(p[sizeKey]))
    const z = (p) => p[sizeKey]
    const sizeTerms = (p) => (form === 'linear' ? [z(p)] : form === 'quadratic' ? [z(p), z(p) ** 2] : [Math.abs(z(p))])
    const levels = [...new Set(usable.map((r) => r.level))].sort().slice(1)
    const groups = [...new Set(usable.map((r) => r.posGroup))].sort().slice(1)
    const eras = [...new Set(usable.map((r) => Math.floor(r.durSeason / 5)))].sort().slice(1)
    const X = usable.map((r) => [
      1, ...sizeTerms(r),
      ...levels.map((l) => (r.level === l ? 1 : 0)),
      ...groups.map((g) => (r.posGroup === g ? 1 : 0)),
      ...eras.map((e) => (Math.floor(r.durSeason / 5) === e ? 1 : 0)),
    ])
    const y = usable.map((r) => Math.log(r.days))
    const f = fitOLS(X, y)
    if (!f) continue
    const XtXinv = invert(matTMat(X))
    const { cov } = clusterCov(X, f.resid, usable.map((r) => r.clusterId), XtXinv)
    const names = form === 'quadratic' ? [sizeKey, `${sizeKey}²`] : form === 'deviation' ? [`|${sizeKey}|`] : [sizeKey]
    const nClust = new Set(usable.map((r) => r.clusterId)).size
    const out = names.map((name, i) => {
      const b = f.beta[i + 1]
      const se = Math.sqrt(cov[i + 1][i + 1])
      return { name, beta: b, se, p: tTwoSidedP(b / se, nClust - 1) }
    })
    results[`days:${sizeKey}:${form}`] = { n: usable.length, terms: out }
    console.log(
      `  ${`${sizeKey} ${form}`.padEnd(46)} n=${String(usable.length).padStart(4)}  ` +
        out.map((o) => `${o.name} ${fmt(o.beta, 3)}±${fmt(o.se, 3)} p=${o.p < 0.0001 ? '<1e-4' : o.p.toFixed(3)}`).join('   '),
    )
  }
}

// --- the blunt version -------------------------------------------------------
// Terciles, within position group, so a reader can see the thing without
// taking a coefficient on trust.
console.log('\n=== the same question without a model: size terciles within position ===')
for (const [sizeKey, sizeLabel, unit] of [['heightIn', 'height', '"'], ['weightLb', 'weight', 'lb']]) {
  console.log(`-- by ${sizeLabel}`)
  for (const grp of ['P', 'C', 'MID', 'CORNER']) {
    const g = cohort.filter((p) => p.posGroup === grp).sort((a, b) => a[sizeKey] - b[sizeKey])
    if (g.length < 90) continue
    const third = Math.floor(g.length / 3)
    const cuts = [g.slice(0, third), g.slice(third, 2 * third), g.slice(2 * third)]
    console.log(
      `   ${grp.padEnd(7)} ` +
        cuts
          .map(
            (c, i) =>
              `${['small', 'middle', 'large'][i]} ${fmt(summarize(c.map((p) => p[sizeKey])).median, 0)}${unit} → ${fmt(summarize(c.map((p) => p.seasonsToDebut)).median, 1)} seasons`,
          )
          .join('  '),
    )
  }
}

// The extremes, since the question is explicitly about them.
console.log('\n=== the tails: the most unusual tenth in each direction ===')
for (const grp of ['P', 'C', 'MID', 'CORNER']) {
  const g = cohort.filter((p) => p.posGroup === grp)
  if (g.length < 90) continue
  const short = g.filter((p) => p.zHeight <= -1.28)
  const tall = g.filter((p) => p.zHeight >= 1.28)
  const mid = g.filter((p) => Math.abs(p.zHeight) < 1.28)
  console.log(
    `  ${grp.padEnd(7)} shortest 10% (n=${String(short.length).padStart(3)}) ${fmt(summarize(short.map((p) => p.seasonsToDebut)).median, 1)} seasons   ` +
      `middle (n=${String(mid.length).padStart(4)}) ${fmt(summarize(mid.map((p) => p.seasonsToDebut)).median, 1)}   ` +
      `tallest 10% (n=${String(tall.length).padStart(3)}) ${fmt(summarize(tall.map((p) => p.seasonsToDebut)).median, 1)}`,
  )
}

await writeFile(join(here, 'q2-size.json'), JSON.stringify({ byGroup, results }, null, 1))
console.log('\nwrote q2-size.json')
