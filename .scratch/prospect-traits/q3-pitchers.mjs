// Q3: does a pitcher's handedness, pitch mix or velocity change how fast he
// gets promoted?
//
// ONE OF THESE THREE IS A CLEAN QUESTION AND TWO ARE NOT. Say so first.
//
//   HANDEDNESS is clean. It is fixed at birth, recorded for every pitcher in
//   the cohort, and cannot be affected by anything that happens in the minors.
//   Whatever this finds is a fact about how clubs treat left-handers.
//
//   MIX and VELOCITY are not clean, and the reason is a fact about the sport's
//   instrumentation rather than a shortcut taken here. Pitch-type and speed
//   data exist only where the cameras are. Double-A and below have never had
//   them; Triple-A only got Hawk-Eye in the 2020s (gen-pitch-arsenal.mjs's
//   header, established against a live AAA feed). So there is NO measurement of
//   what a 2014 prospect threw at Double-A, and there never will be.
//
//   What can be measured is what he threw in his MLB rookie season — AFTER the
//   promotion this question is about. Using it means assuming a man's fastball
//   in his rookie year is a fair read on his fastball the previous September.
//   That assumption is reasonable and it is still an assumption, and it points
//   the wrong way in time. Every velocity and mix result below is therefore
//   stated as an association with a stated direction problem, never as a cause.
//   Anyone who wants the clean version needs minor-league tracking data that
//   does not exist for these players.
//
// Velocity is standardized WITHIN the rookie season. The league's average
// four-seamer went from 91.0 in 2008 to 94.2 in 2024; without that correction
// this would mostly re-measure the calendar.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCohort, here, fmt, summarize } from './lib.mjs'
import { buildOutcomes } from './outcomes.mjs'
import { fitOLS, invert, matTMat, tTwoSidedP, normalTwoSidedP } from '../level-benchmarks/homegrown-stats.mjs'

const players = await buildCohort()
const rows = await buildOutcomes(players)
const arsenal = JSON.parse(await readFile(join(here, 'arsenal.json'), 'utf8'))

const FASTBALLS = new Set(['FF', 'SI', 'FA', 'FC'])
const BREAKING = new Set(['SL', 'CU', 'ST', 'SV', 'KC', 'CS', 'SC', 'KN'])
const OFFSPEED = new Set(['CH', 'FS', 'FO', 'EP'])

const pit = rows.filter((p) => p.group === 'pitching' && p.seasonsToDebut != null && p.seasonsToDebut >= 0)
for (const p of pit) {
  p.totalIP = p.segs.reduce((a, s) => a + s.outs, 0) / 3
  const g = p.rookieRaw?.gamesPitched ?? p.rookieRaw?.gamesPlayed ?? 0
  const gs = p.rookieRaw?.gamesStarted ?? 0
  p.startShare = g > 0 ? gs / g : null
  const a = arsenal[p.id]
  p.arsenal = null
  if (a?.pitches?.length) {
    const total = a.pitches.reduce((x, y) => x + y.count, 0)
    if (total >= 200) {
      const share = (set) => a.pitches.filter((q) => set.has(q.code)).reduce((x, y) => x + y.count, 0) / total
      // The primary fastball: the most-thrown of the hard pitches, which is
      // what a scout means by "his fastball" for a sinkerballer as much as for
      // a four-seam pitcher.
      const fb = a.pitches
        .filter((q) => FASTBALLS.has(q.code) && q.velo > 0)
        .sort((x, y) => y.count - x.count)[0]
      p.arsenal = {
        season: a.season,
        totalPitches: total,
        fbVelo: fb?.velo ?? null,
        fbCode: fb?.code ?? null,
        // A pitch counts toward the repertoire at 10% of his pitches — below
        // that it is a show-me pitch, not part of the mix.
        repertoire: a.pitches.filter((q) => q.count / total >= 0.1).length,
        fastballShare: share(FASTBALLS),
        breakingShare: share(BREAKING),
        offspeedShare: share(OFFSPEED),
      }
    }
  }
}

// Velocity, standardized within the rookie season.
const veloBySeason = new Map()
for (const p of pit) {
  if (!p.arsenal?.fbVelo) continue
  const s = p.arsenal.season
  if (!veloBySeason.has(s)) veloBySeason.set(s, [])
  veloBySeason.get(s).push(p.arsenal.fbVelo)
}
const veloNorm = new Map()
for (const [s, v] of veloBySeason) {
  if (v.length < 20) continue
  const m = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
  veloNorm.set(s, { m, sd })
}
for (const p of pit) {
  const n = p.arsenal?.fbVelo ? veloNorm.get(p.arsenal.season) : null
  p.zVelo = n ? (p.arsenal.fbVelo - n.m) / n.sd : null
}

console.log(`pitchers: ${pit.length}`)
console.log(`  with a rookie-season arsenal (>=200 tracked pitches): ${pit.filter((p) => p.arsenal).length}`)
console.log(`  with a standardized fastball velocity: ${pit.filter((p) => p.zVelo != null).length}`)

// ============================================================ 1. HANDEDNESS
console.log('\n=== HANDEDNESS ===')
const hands = { L: pit.filter((p) => p.throws === 'L'), R: pit.filter((p) => p.throws === 'R') }
console.log(`left ${hands.L.length}, right ${hands.R.length} (${((100 * hands.L.length) / pit.length).toFixed(1)}% left-handed)`)

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
  const N = n1 + n2
  const sd = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tieSum / (N * (N - 1))))
  const z = sd > 0 ? (U - (n1 * n2) / 2) / sd : 0
  return { z, p: normalTwoSidedP(z) }
}

const handRows = []
for (const [key, label, get] of [
  ['seasonsToDebut', 'Seasons to debut', (p) => p.seasonsToDebut],
  ['totalIP', 'Total MiLB innings', (p) => p.totalIP],
  ['ageAtDebut', 'Age at debut', (p) => p.ageAtDebut],
  ['startShare', 'Start share, rookie year', (p) => p.startShare],
  ['zVelo', 'Fastball velocity (z)', (p) => p.zVelo],
  ['rookieRate', 'Rookie ERA+', (p) => p.rookieRate],
  ['rookieWar', 'Rookie WAR', (p) => p.rookieWar],
]) {
  const L = hands.L.map(get).filter(Number.isFinite)
  const R = hands.R.map(get).filter(Number.isFinite)
  const sl = summarize(L)
  const sr = summarize(R)
  const mw = mannWhitney(L, R)
  handRows.push({ key, label, L: sl, R: sr, p: mw.p })
  console.log(
    `  ${label.padEnd(26)} L ${fmt(sl.median, 2).padStart(7)} (mean ${fmt(sl.mean, 2)})   R ${fmt(sr.median, 2).padStart(7)} (mean ${fmt(sr.mean, 2)})   p=${mw.p < 0.0001 ? '<1e-4' : mw.p.toFixed(4)}`,
  )
}

// Does the level structure differ? A left-hander who never sees Triple-A is a
// different story from one who moves through it faster.
for (const [label, test] of [
  ['reached AAA', (p) => !!p.byLevel.AAA],
  ['skipped High-A', (p) => !p.byLevel['High-A']],
  ['relievers at debut', (p) => p.startShare != null && p.startShare < 0.5],
]) {
  const l = hands.L.filter(test).length / hands.L.filter((p) => label !== 'relievers at debut' || p.startShare != null).length
  const r = hands.R.filter(test).length / hands.R.filter((p) => label !== 'relievers at debut' || p.startShare != null).length
  console.log(`  ${label.padEnd(26)} L ${(100 * l).toFixed(1)}%   R ${(100 * r).toFixed(1)}%`)
}

// ============================================================ 2. THE MODELS
function model({ set, outcome, terms, dummies = [], label, log = false }) {
  const usable = set.filter(
    (p) =>
      Number.isFinite(p[outcome]) &&
      (!log || p[outcome] > 0) &&
      terms.every((t) => Number.isFinite(t.get(p))) &&
      dummies.every((d) => d.get(p) != null),
  )
  if (usable.length < 80) {
    console.log(`  ${label}: only ${usable.length} rows, skipped`)
    return null
  }
  const norms = terms.map((t) => {
    const v = usable.map((p) => t.get(p))
    const m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
    return { m, sd: t.raw ? 1 : sd }
  })
  const dummyLevels = dummies.map((d) => [...new Set(usable.map((p) => d.get(p)))].sort().slice(1))
  const eras = [...new Set(usable.map((p) => Math.floor(p.debutYear / 5)))].sort().slice(1)
  const tiers = [...new Set(usable.map((p) => p.draftTier))].sort().slice(1)
  const X = usable.map((p) => [
    1,
    ...terms.map((t, i) => (t.raw ? t.get(p) : (t.get(p) - norms[i].m) / norms[i].sd)),
    ...dummies.flatMap((d, i) => dummyLevels[i].map((lv) => (d.get(p) === lv ? 1 : 0))),
    ...tiers.map((t) => (p.draftTier === t ? 1 : 0)),
    ...eras.map((e) => (Math.floor(p.debutYear / 5) === e ? 1 : 0)),
  ])
  const y = usable.map((p) => (log ? Math.log(p[outcome]) : p[outcome]))
  const f = fitOLS(X, y)
  if (!f) {
    console.log(`  ${label}: singular`)
    return null
  }
  const n = X.length
  const k = X[0].length
  const s2 = f.resid.reduce((a, b) => a + b * b, 0) / (n - k)
  const XtXinv = invert(matTMat(X))
  const out = []
  const names = [...terms.map((t) => t.name), ...dummies.flatMap((d, i) => dummyLevels[i].map((lv) => `${d.name}=${lv}`))]
  names.forEach((name, i) => {
    const b = f.beta[i + 1]
    const se = Math.sqrt(s2 * XtXinv[i + 1][i + 1])
    out.push({ name, beta: b, se, p: tTwoSidedP(b / se, n - k) })
  })
  console.log(
    `  ${label.padEnd(40)} n=${String(n).padStart(4)}  ` +
      out.map((o) => `${o.name} ${fmt(o.beta, 3)}±${fmt(o.se, 3)} p=${o.p < 0.0001 ? '<1e-4' : o.p.toFixed(3)}`).join('  '),
  )
  return { n, terms: out }
}

const T = {
  lefty: { name: 'lefty', get: (p) => (p.throws === 'L' ? 1 : 0), raw: true },
  velo: { name: 'zVelo', get: (p) => p.zVelo },
  repertoire: { name: 'repertoire', get: (p) => p.arsenal?.repertoire },
  breaking: { name: 'breakingShare', get: (p) => p.arsenal?.breakingShare },
  offspeed: { name: 'offspeedShare', get: (p) => p.arsenal?.offspeedShare },
  startShare: { name: 'startShare', get: (p) => p.startShare },
}

const results = {}
console.log('\n=== handedness, modelled (positive = MORE time in the minors) ===')
results.handSeasons = model({ set: pit, outcome: 'seasonsToDebut', terms: [T.lefty], label: 'seasons ~ lefty' })
results.handSeasonsRole = model({ set: pit, outcome: 'seasonsToDebut', terms: [T.lefty, T.startShare], label: 'seasons ~ lefty + role' })
results.handIP = model({ set: pit, outcome: 'totalIP', terms: [T.lefty], log: true, label: 'log(MiLB IP) ~ lefty' })
results.handIPRole = model({ set: pit, outcome: 'totalIP', terms: [T.lefty, T.startShare], log: true, label: 'log(MiLB IP) ~ lefty + role' })

console.log('\n=== velocity (measured in the rookie season — see the header) ===')
results.veloSeasons = model({ set: pit, outcome: 'seasonsToDebut', terms: [T.velo], label: 'seasons ~ velocity' })
results.veloSeasonsRole = model({ set: pit, outcome: 'seasonsToDebut', terms: [T.velo, T.startShare], label: 'seasons ~ velocity + role' })
results.veloIP = model({ set: pit, outcome: 'totalIP', terms: [T.velo], log: true, label: 'log(MiLB IP) ~ velocity' })
results.veloAge = model({ set: pit, outcome: 'ageAtDebut', terms: [T.velo], label: 'age at debut ~ velocity' })

console.log('\n=== mix ===')
results.mixSeasons = model({ set: pit, outcome: 'seasonsToDebut', terms: [T.repertoire, T.breaking, T.offspeed], label: 'seasons ~ mix' })
results.mixSeasonsRole = model({
  set: pit, outcome: 'seasonsToDebut', terms: [T.repertoire, T.breaking, T.offspeed, T.startShare], label: 'seasons ~ mix + role',
})
results.allSeasons = model({
  set: pit, outcome: 'seasonsToDebut', terms: [T.lefty, T.velo, T.repertoire, T.breaking, T.offspeed, T.startShare], label: 'seasons ~ everything',
})

// ============================================================ 3. THE BLUNT CUT
console.log('\n=== velocity, in plain buckets ===')
const veloBands = [
  ['bottom 10%', (z) => z <= -1.28],
  ['10-30%', (z) => z > -1.28 && z <= -0.52],
  ['middle 40%', (z) => z > -0.52 && z < 0.52],
  ['70-90%', (z) => z >= 0.52 && z < 1.28],
  ['top 10%', (z) => z >= 1.28],
]
const veloRows = []
for (const [name, test] of veloBands) {
  const g = pit.filter((p) => p.zVelo != null && test(p.zVelo))
  if (g.length < 20) continue
  const row = {
    band: name,
    n: g.length,
    velo: summarize(g.map((p) => p.arsenal.fbVelo)).median,
    seasons: summarize(g.map((p) => p.seasonsToDebut)).mean,
    ip: summarize(g.map((p) => p.totalIP)).median,
    age: summarize(g.map((p) => p.ageAtDebut)).median,
  }
  veloRows.push(row)
  console.log(
    `  ${name.padEnd(12)} n=${String(row.n).padStart(4)}  median FB ${fmt(row.velo, 1)}  mean seasons to debut ${fmt(row.seasons, 2)}  median MiLB IP ${fmt(row.ip, 0)}  median debut age ${fmt(row.age, 1)}`,
  )
}

console.log('\n=== repertoire size, in plain buckets ===')
const repRows = []
for (const r of [1, 2, 3, 4, 5]) {
  const g = pit.filter((p) => p.arsenal?.repertoire === r)
  if (g.length < 25) continue
  const row = {
    repertoire: r,
    n: g.length,
    seasons: summarize(g.map((p) => p.seasonsToDebut)).mean,
    startShare: summarize(g.map((p) => p.startShare).filter(Number.isFinite)).mean,
    war: summarize(g.map((p) => p.rookieWar).filter(Number.isFinite)).median,
  }
  repRows.push(row)
  console.log(
    `  ${r} pitch${r > 1 ? 'es' : ''} at 10%+   n=${String(row.n).padStart(4)}  mean seasons ${fmt(row.seasons, 2)}  mean start share ${fmt(row.startShare, 2)}  median rookie WAR ${fmt(row.war, 1)}`,
  )
}

// ============================================================ 4. THE Q2 TIE-IN
// The weight U-shape from Q2 was a pitcher effect and nobody else's. If it is
// really about stuff — an unusually light or heavy arm being harder to read —
// then controlling for velocity should soften it. If it does not move, the U is
// about something velocity does not capture.
console.log('\n=== does velocity explain the Q2 weight U-shape? ===')
const pw = pit.filter((p) => Number.isFinite(p.weightLb))
const wv = pw.map((p) => p.weightLb)
const wm = wv.reduce((a, b) => a + b, 0) / wv.length
const wsd = Math.sqrt(wv.reduce((a, b) => a + (b - wm) ** 2, 0) / (wv.length - 1))
for (const p of pw) p.zWeightP = (p.weightLb - wm) / wsd
const T2 = { absW: { name: '|zWeight|', get: (p) => Math.abs(p.zWeightP) }, w: { name: 'zWeight', get: (p) => p.zWeightP } }
results.uNoVelo = model({ set: pw, outcome: 'seasonsToDebut', terms: [T2.absW, T2.w], label: 'seasons ~ |weight| (no velocity)' })
results.uVelo = model({ set: pw.filter((p) => p.zVelo != null), outcome: 'seasonsToDebut', terms: [T2.absW, T2.w, T.velo], label: 'seasons ~ |weight| + velocity' })
results.uVeloSame = model({ set: pw.filter((p) => p.zVelo != null), outcome: 'seasonsToDebut', terms: [T2.absW, T2.w], label: 'seasons ~ |weight|, velocity subset only' })

await writeFile(join(here, 'q3-pitchers.json'), JSON.stringify({ handRows, results, veloRows, repRows }, null, 1))
console.log('\nwrote q3-pitchers.json')
