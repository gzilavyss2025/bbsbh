// Q1, second pass: the two confounds the first pass produced rather than
// controlled for. Both were visible in its own output, which is the only
// reason they are being chased.
//
// 1. PITCHERS AND THE AGE PARADOX. The first pass says an older pitching
//    debutant posts a BETTER rate line (+4.4 points of ERA+ per standard
//    deviation of age, p=0.01) and a WORSE season by WAR (−0.14 per SD,
//    p=0.0001). Both cannot be a fact about age. The obvious suspect is role:
//    relievers debut later, throw 50 innings, and can post a fine ERA while
//    being worth almost nothing. If role explains it, the age term should
//    collapse once role is in the model.
//
// 2. HITTERS AND SIZE. The single largest separator of a good rookie RATE line
//    among hitters is weight (d=0.49) and then height (d=0.35) — larger than
//    any measure of how the man moved through the minors. But OPS+ is
//    position-blind: a first baseman at 105 is a poor first baseman and a
//    shortstop at 105 is a good shortstop. If the size result is really a
//    position result, it should collapse once position is in the model.
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCohort, here, fmt, summarize } from './lib.mjs'
import { buildOutcomes } from './outcomes.mjs'
import { fitOLS, invert, matTMat, tTwoSidedP } from '../level-benchmarks/homegrown-stats.mjs'

const players = await buildCohort()
const rows = await buildOutcomes(players)

const MIN_PT = { hitting: 150, pitching: 40 }
const base = rows.filter((p) => p.rookieFound && p.debutYear >= 2010 && p.rookieLagYears <= 2)

// Role, read off the rookie season itself: share of appearances that were
// starts. A man at 0.8 is a starter, at 0.0 a reliever, and the middle is the
// swingman it honestly is.
for (const p of base) {
  if (p.group !== 'pitching') continue
  const g = p.rookieRaw?.gamesPitched ?? p.rookieRaw?.gamesPlayed ?? 0
  const gs = p.rookieRaw?.gamesStarted ?? 0
  p.startShare = g > 0 ? gs / g : null
  p.isStarter = p.startShare == null ? null : p.startShare >= 0.5 ? 1 : 0
}

// Position group for hitters. Catcher and the middle infield are the defensive
// premium; the corners are where a club puts a bat. Designated hitter goes in
// with the corners, which is where the bar for a bat actually sits.
const POS_GROUP = {
  C: 'C',
  SS: 'MID',
  '2B': 'MID',
  CF: 'MID',
  '3B': 'CORNER',
  '1B': 'CORNER',
  LF: 'CORNER',
  RF: 'CORNER',
  OF: 'CORNER',
  DH: 'CORNER',
}
for (const p of base) if (p.group === 'hitting') p.posGroup = POS_GROUP[p.pos] ?? null

function standardize(vals) {
  const ok = vals.filter(Number.isFinite)
  const m = ok.reduce((a, b) => a + b, 0) / ok.length
  const sd = Math.sqrt(ok.reduce((a, b) => a + (b - m) ** 2, 0) / (ok.length - 1))
  return { m, sd }
}

// One OLS with named terms, era dummies always on, printed as a table.
function model({ set, outcome, terms, dummies = [], label }) {
  const usable = set.filter(
    (p) => Number.isFinite(p[outcome]) && terms.every((t) => Number.isFinite(t.get(p))) && dummies.every((d) => d.get(p) != null),
  )
  if (usable.length < 60) {
    console.log(`${label}: only ${usable.length} rows, skipped`)
    return null
  }
  const norms = terms.map((t) => standardize(usable.map((p) => t.get(p))))
  const dummyLevels = dummies.map((d) => [...new Set(usable.map((p) => d.get(p)))].sort().slice(1))
  const eras = [...new Set(usable.map((p) => Math.floor(p.debutYear / 5)))].sort().slice(1)

  const X = usable.map((p) => [
    1,
    ...terms.map((t, i) => (t.get(p) - norms[i].m) / norms[i].sd),
    ...dummies.flatMap((d, i) => dummyLevels[i].map((lv) => (d.get(p) === lv ? 1 : 0))),
    ...eras.map((e) => (Math.floor(p.debutYear / 5) === e ? 1 : 0)),
  ])
  const y = usable.map((p) => p[outcome])
  const fit = fitOLS(X, y)
  if (!fit) {
    console.log(`${label}: singular design`)
    return null
  }
  const { beta, resid } = fit
  const n = X.length
  const k = X[0].length
  const s2 = resid.reduce((a, b) => a + b * b, 0) / (n - k)
  const XtXinv = invert(matTMat(X))
  const yMean = y.reduce((a, b) => a + b, 0) / n
  const r2 = 1 - resid.reduce((a, b) => a + b * b, 0) / y.reduce((a, b) => a + (b - yMean) ** 2, 0)
  console.log(`\n${label}: n=${n}, R2=${r2.toFixed(3)}`)
  const out = []
  terms.forEach((t, i) => {
    const b = beta[i + 1]
    const se = Math.sqrt(s2 * XtXinv[i + 1][i + 1])
    const p = tTwoSidedP(b / se, n - k)
    out.push({ term: t.name, beta: b, se, p })
    console.log(
      `  ${t.name.padEnd(20)} ${fmt(b, 3).padStart(8)} ± ${fmt(se, 3).padStart(6)}  p=${p < 0.0001 ? '<0.0001' : p.toFixed(4)}`,
    )
  })
  dummies.forEach((d, i) => {
    dummyLevels[i].forEach((lv, jj) => {
      const idx = 1 + terms.length + dummyLevels.slice(0, i).reduce((a, l) => a + l.length, 0) + jj
      const b = beta[idx]
      const se = Math.sqrt(s2 * XtXinv[idx][idx])
      const p = tTwoSidedP(b / se, n - k)
      out.push({ term: `${d.name}=${lv}`, beta: b, se, p })
      console.log(
        `  ${`${d.name}=${lv}`.padEnd(20)} ${fmt(b, 3).padStart(8)} ± ${fmt(se, 3).padStart(6)}  p=${p < 0.0001 ? '<0.0001' : p.toFixed(4)}`,
      )
    })
  })
  return { n, r2, rows: out }
}

const T = {
  age: { name: 'ageAtDebut', get: (p) => p.ageAtDebut },
  seasons: { name: 'seasonsToDebut', get: (p) => p.seasonsToDebut },
  height: { name: 'heightIn', get: (p) => p.heightIn },
  weight: { name: 'weightLb', get: (p) => p.weightLb },
  startShare: { name: 'startShare', get: (p) => p.startShare },
}

// ---------------------------------------------------------------- 1. pitchers
const pit = base.filter((p) => p.group === 'pitching')
const pitRate = pit.filter((p) => p.rookieRate != null && p.rookieSeasonPT >= MIN_PT.pitching)
const pitWar = pit.filter((p) => p.rookieWar != null)

console.log('=== PITCHERS: is the age paradox really role? ===')
console.log(`starters vs relievers in the rate set: ${pitRate.filter((p) => p.isStarter === 1).length} / ${pitRate.filter((p) => p.isStarter === 0).length}`)
const ageByRole = ['starter', 'reliever'].map((r, i) => {
  const g = pit.filter((p) => p.isStarter === (i === 0 ? 1 : 0) && p.ageAtDebut != null)
  return { role: r, n: g.length, medianAge: summarize(g.map((p) => p.ageAtDebut)).median }
})
for (const r of ageByRole) console.log(`  ${r.role.padEnd(9)} n=${String(r.n).padStart(4)}  median debut age ${fmt(r.medianAge, 2)}`)

const pitOut = {}
pitOut.rateNoRole = model({ set: pitRate, outcome: 'rookieRate', terms: [T.age, T.seasons], label: 'rookie RATE ~ age (no role control)' })
pitOut.rateRole = model({ set: pitRate, outcome: 'rookieRate', terms: [T.age, T.seasons, T.startShare], label: 'rookie RATE ~ age + role' })
pitOut.warNoRole = model({ set: pitWar, outcome: 'rookieWar', terms: [T.age, T.seasons], label: 'rookie WAR ~ age (no role control)' })
pitOut.warRole = model({ set: pitWar, outcome: 'rookieWar', terms: [T.age, T.seasons, T.startShare], label: 'rookie WAR ~ age + role' })

// The same question without a regression: split by role and look.
console.log('\nrookie season by role and debut age:')
for (const [roleName, roleVal] of [['starters', 1], ['relievers', 0]]) {
  console.log(`-- ${roleName}`)
  for (const [name, test] of [
    ['22 or younger', (a) => a < 23],
    ['23-24', (a) => a >= 23 && a < 25],
    ['25-26', (a) => a >= 25 && a < 27],
    ['27 or older', (a) => a >= 27],
  ]) {
    const g = pitRate.filter((p) => p.isStarter === roleVal && p.ageAtDebut != null && test(p.ageAtDebut))
    const w = pitWar.filter((p) => p.isStarter === roleVal && p.ageAtDebut != null && test(p.ageAtDebut))
    if (g.length < 15) continue
    console.log(
      `   ${name.padEnd(14)} n=${String(g.length).padStart(4)}  median ERA+ ${fmt(summarize(g.map((p) => p.rookieRate)).median, 0).padStart(4)}  median WAR ${fmt(summarize(w.map((p) => p.rookieWar)).median, 1).padStart(5)}`,
    )
  }
}

// ---------------------------------------------------------------- 2. hitters
const hit = base.filter((p) => p.group === 'hitting')
const hitRate = hit.filter((p) => p.rookieRate != null && p.rookieSeasonPT >= MIN_PT.hitting)

console.log('\n\n=== HITTERS: is size really position? ===')
const posCounts = {}
for (const p of hitRate) posCounts[p.posGroup ?? 'unknown'] = (posCounts[p.posGroup ?? 'unknown'] ?? 0) + 1
console.log('position groups in the rate set:', JSON.stringify(posCounts))
for (const grp of ['C', 'MID', 'CORNER']) {
  const g = hitRate.filter((p) => p.posGroup === grp)
  console.log(
    `  ${grp.padEnd(7)} n=${String(g.length).padStart(4)}  median weight ${fmt(summarize(g.map((p) => p.weightLb)).median, 0).padStart(4)}  median height ${fmt(summarize(g.map((p) => p.heightIn)).median, 0).padStart(3)}  median OPS+ ${fmt(summarize(g.map((p) => p.rookieRate)).median, 0).padStart(4)}`,
  )
}

const hitOut = {}
hitOut.sizeNoPos = model({ set: hitRate, outcome: 'rookieRate', terms: [T.height, T.weight], label: 'rookie RATE ~ size (no position control)' })
hitOut.sizePos = model({
  set: hitRate.filter((p) => p.posGroup),
  outcome: 'rookieRate',
  terms: [T.height, T.weight],
  dummies: [{ name: 'pos', get: (p) => p.posGroup }],
  label: 'rookie RATE ~ size + position group',
})
hitOut.sizeWar = model({
  set: hit.filter((p) => p.rookieWar != null && p.posGroup),
  outcome: 'rookieWar',
  terms: [T.height, T.weight],
  dummies: [{ name: 'pos', get: (p) => p.posGroup }],
  label: 'rookie WAR ~ size + position group',
})

// Within position group, does weight still separate? The blunt version of the
// same test, and the one that cannot be argued with on functional-form grounds.
console.log('\nrookie OPS+ by weight tercile, WITHIN position group:')
for (const grp of ['C', 'MID', 'CORNER']) {
  const g = hitRate.filter((p) => p.posGroup === grp && Number.isFinite(p.weightLb))
  if (g.length < 60) continue
  const sorted = [...g].sort((a, b) => a.weightLb - b.weightLb)
  const third = Math.floor(sorted.length / 3)
  const cuts = [sorted.slice(0, third), sorted.slice(third, 2 * third), sorted.slice(2 * third)]
  console.log(
    `  ${grp.padEnd(7)} ` +
      cuts
        .map((c, i) => `${['light', 'middle', 'heavy'][i]} ${fmt(summarize(c.map((p) => p.weightLb)).median, 0)}lb → OPS+ ${fmt(summarize(c.map((p) => p.rookieRate)).median, 0)}`)
        .join('   '),
  )
}

await writeFile(join(here, 'q1b-confounds.json'), JSON.stringify({ pitchers: pitOut, hitters: hitOut, ageByRole }, null, 1))
console.log('\nwrote q1b-confounds.json')
