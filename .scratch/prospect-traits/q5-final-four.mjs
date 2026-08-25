// Q5: what do the clubs that reach a Championship Series have in common, in
// what their farm systems were doing?
//
// WHY THIS IS THE SHARPER VERSION OF A QUESTION ALREADY ANSWERED. The
// homegrown-dependence pass asked whether building from within wins GAMES and
// answered no — 600 club-seasons, an interval running from about two thirds of
// a win worse to about two wins better per standard deviation. The final four
// is a different bar. A club reaches a Championship Series roughly one season
// in eight; October is where a front office's plan is actually judged, and it
// is at least possible that a farm shows up there and not in the standings.
//
// It is also a much smaller sample, and that has to be said in the same breath:
// four clubs a year, twenty seasons, eighty slots. A finding on eighty
// club-seasons wants a lot of checking before anybody believes it.
//
// FIVE THINGS ARE MEASURED PER CLUB-SEASON, and each is a different theory of
// what a farm system is for:
//   homegrownShare   how much of the big-league roster the club raised itself
//   graduates        how many of its own men reached the majors and stuck
//   rookieWar        what those men were worth in their rookie seasons
//   promotionSpeed   whether its prospects moved faster than comparable men
//   pipelineWar      total rookie-season WAR its recent graduates produced
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCohort, here, fmt, summarize } from './lib.mjs'
import { buildOutcomes } from './outcomes.mjs'
import { normalTwoSidedP, fitOLS, invert, matTMat, tTwoSidedP, pearson } from '../level-benchmarks/homegrown-stats.mjs'

const repo = join(here, '..', '..')
const players = await buildCohort()
const rows = await buildOutcomes(players)
const post = JSON.parse(await readFile(join(repo, 'public', 'data', 'postseason-history.json'), 'utf8'))
const panel = JSON.parse(await readFile(join(here, '..', 'level-benchmarks', 'homegrown-panel.json'), 'utf8'))
const standings = JSON.parse(await readFile(join(here, '..', 'level-benchmarks', 'standings-cache.json'), 'utf8'))

// --- who got where -----------------------------------------------------------
const reached = new Map() // `${orgId}:${season}` -> deepest round
const ROUND_RANK = { wildcard: 1, division: 2, lcs: 3, worldseries: 4 }
const seasonsWithPost = new Set()
for (const s of post.seasons) {
  seasonsWithPost.add(s.year)
  for (const r of s.rounds) {
    for (const ser of r.series) {
      for (const t of [ser.teamA?.teamId, ser.teamB?.teamId]) {
        if (!t) continue
        const key = `${t}:${s.year}`
        const rank = ROUND_RANK[r.key] ?? 0
        if ((reached.get(key) ?? 0) < rank) reached.set(key, rank)
      }
    }
  }
}
// A club "made the final four" if it PLAYED in a Championship Series.
const finalFour = new Set([...reached.entries()].filter(([, v]) => v >= 3).map(([k]) => k))
const madePlayoffs = new Set([...reached.keys()])

// --- per-club-season farm measures --------------------------------------------
// Graduates are attributed to the DEVELOPING org — the club a man spent his
// first professional season with — not to whoever he debuted for. That is the
// homegrown rule, and it is the only one that credits a club for the player it
// actually raised.
const gradsByOrgSeason = new Map()
for (const p of rows) {
  if (!p.entryOrgId) continue
  const key = `${p.entryOrgId}:${p.debutYear}`
  if (!gradsByOrgSeason.has(key)) gradsByOrgSeason.set(key, [])
  gradsByOrgSeason.get(key).push(p)
}

// Promotion speed, as a residual: how much faster or slower a man moved than
// comparable men. Comparable = same entry level, same draft tier, same debut
// era, same stat group. Negative is faster.
const speedGroups = new Map()
for (const p of rows) {
  if (p.seasonsToDebut == null || p.seasonsToDebut < 0) continue
  const key = `${p.group}:${p.entryLevel}:${p.draftTier}:${Math.floor(p.debutYear / 5)}`
  if (!speedGroups.has(key)) speedGroups.set(key, [])
  speedGroups.get(key).push(p.seasonsToDebut)
}
const speedNorm = new Map()
for (const [k, v] of speedGroups) {
  if (v.length < 15) continue
  const m = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
  speedNorm.set(k, { m, sd: sd || 1 })
}
for (const p of rows) {
  const key = `${p.group}:${p.entryLevel}:${p.draftTier}:${Math.floor(p.debutYear / 5)}`
  const n = speedNorm.get(key)
  p.speedResid = n && p.seasonsToDebut != null ? (p.seasonsToDebut - n.m) / n.sd : null
}

// The panel is 2004-2023. Postseason coverage starts in 2000, so the overlap
// is 2004-2023 and that is the study window.
const study = []
for (const row of panel.panel) {
  if (!seasonsWithPost.has(row.season)) continue
  const key = `${row.orgId}:${row.season}`
  const grads = gradsByOrgSeason.get(key) ?? []
  // A pipeline is not one season's worth. This counts the men the club raised
  // who debuted in the FIVE seasons up to and including this one — the window
  // a roster is actually built out of.
  let pipelineGrads = 0
  let pipelineWar = 0
  const speeds = []
  for (let y = row.season - 4; y <= row.season; y++) {
    for (const p of gradsByOrgSeason.get(`${row.orgId}:${y}`) ?? []) {
      pipelineGrads++
      if (p.rookieWar != null) pipelineWar += p.rookieWar
      if (p.speedResid != null) speeds.push(p.speedResid)
    }
  }
  study.push({
    orgId: row.orgId,
    season: row.season,
    homegrownShare: row.homegrownShare,
    winPct: row.winPct ?? standings[key]?.winPct ?? null,
    graduates: grads.length,
    pipelineGrads,
    pipelineWar,
    promotionSpeed: speeds.length >= 3 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
    finalFour: finalFour.has(key) ? 1 : 0,
    playoffs: madePlayoffs.has(key) ? 1 : 0,
  })
}
console.log(`study window: ${study.length} club-seasons, ${Math.min(...study.map((r) => r.season))}-${Math.max(...study.map((r) => r.season))}`)
console.log(`  reached a Championship Series: ${study.filter((r) => r.finalFour).length}`)
console.log(`  reached the postseason at all:  ${study.filter((r) => r.playoffs).length}`)

// --- the plain comparison ------------------------------------------------------
// Compared WITHIN SEASON, by turning each measure into its rank among the
// thirty clubs that year. Otherwise a league-wide drift in any of these gets
// read as a difference between the clubs that advanced and the clubs that did
// not — and every one of these measures drifts.
const bySeason = new Map()
for (const r of study) {
  if (!bySeason.has(r.season)) bySeason.set(r.season, [])
  bySeason.get(r.season).push(r)
}
const MEASURES = [
  ['homegrownShare', 'Homegrown share of the roster'],
  ['graduates', 'Own graduates debuting that year'],
  ['pipelineGrads', 'Own graduates, trailing 5 years'],
  ['pipelineWar', 'Their rookie WAR, trailing 5 years'],
  ['promotionSpeed', 'Promotion speed (− = faster)'],
  ['winPct', 'Winning percentage'],
]
for (const [key] of MEASURES) {
  for (const [, group] of bySeason) {
    const withVal = group.filter((r) => Number.isFinite(r[key])).sort((a, b) => a[key] - b[key])
    withVal.forEach((r, i) => {
      r[`${key}_pct`] = withVal.length > 1 ? i / (withVal.length - 1) : 0.5
    })
  }
}

console.log('\n=== the final four against everybody else ===')
console.log('(within-season percentile, 0 = lowest of the thirty, 1 = highest. 0.50 is what chance looks like.)')
const ff = study.filter((r) => r.finalFour)
const rest = study.filter((r) => !r.finalFour)
const compRows = []
for (const [key, label] of MEASURES) {
  const A = ff.map((r) => r[`${key}_pct`]).filter(Number.isFinite)
  const B = rest.map((r) => r[`${key}_pct`]).filter(Number.isFinite)
  if (A.length < 20) continue
  const ma = A.reduce((a, b) => a + b, 0) / A.length
  const mb = B.reduce((a, b) => a + b, 0) / B.length
  // A percentile is uniform under the null, so its variance is known; a plain
  // two-sample z on the means is honest here.
  const va = A.reduce((a, b) => a + (b - ma) ** 2, 0) / (A.length - 1)
  const vb = B.reduce((a, b) => a + (b - mb) ** 2, 0) / (B.length - 1)
  const se = Math.sqrt(va / A.length + vb / B.length)
  const z = (ma - mb) / se
  const p = normalTwoSidedP(z)
  compRows.push({ key, label, nFF: A.length, ffPct: ma, restPct: mb, z, p })
  console.log(
    `  ${label.padEnd(36)} final four ${ma.toFixed(3)}   everyone else ${mb.toFixed(3)}   p=${p < 0.0001 ? '<0.0001' : p.toFixed(4)}`,
  )
}

// --- and in the units a reader can hold ---------------------------------------
console.log('\n=== the same, in raw units ===')
for (const [key, label] of MEASURES) {
  const A = summarize(ff.map((r) => r[key]).filter(Number.isFinite))
  const B = summarize(rest.map((r) => r[key]).filter(Number.isFinite))
  if (!A.n) continue
  console.log(`  ${label.padEnd(36)} final four ${fmt(A.median, 3).padStart(8)}   everyone else ${fmt(B.median, 3).padStart(8)}`)
}

// --- does anything predict it once winning is held constant? -------------------
// A club that reaches a Championship Series won a lot of games first. Any farm
// measure correlated with winning will look like it predicts October unless
// winning is in the model. This is the test that matters.
function logistic(X, y, iters = 60) {
  const k = X[0].length
  let beta = new Array(k).fill(0)
  for (let it = 0; it < iters; it++) {
    const eta = X.map((r) => r.reduce((a, v, i) => a + v * beta[i], 0))
    const mu = eta.map((e) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, e)))))
    const W = mu.map((m) => Math.max(1e-6, m * (1 - m)))
    const XtWX = Array.from({ length: k }, () => new Array(k).fill(0))
    const XtWz = new Array(k).fill(0)
    for (let i = 0; i < X.length; i++) {
      const z = eta[i] + (y[i] - mu[i]) / W[i]
      for (let a = 0; a < k; a++) {
        XtWz[a] += X[i][a] * W[i] * z
        for (let b = 0; b < k; b++) XtWX[a][b] += X[i][a] * W[i] * X[i][b]
      }
    }
    const inv = invert(XtWX)
    if (!inv) return null
    const next = inv.map((r) => r.reduce((a, v, i) => a + v * XtWz[i], 0))
    const delta = Math.max(...next.map((v, i) => Math.abs(v - beta[i])))
    beta = next
    if (delta < 1e-9) break
  }
  const eta = X.map((r) => r.reduce((a, v, i) => a + v * beta[i], 0))
  const mu = eta.map((e) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, e)))))
  const W = mu.map((m) => Math.max(1e-6, m * (1 - m)))
  const XtWX = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let i = 0; i < X.length; i++)
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) XtWX[a][b] += X[i][a] * W[i] * X[i][b]
  const cov = invert(XtWX)
  return { beta, se: beta.map((_, i) => Math.sqrt(cov[i][i])) }
}

function tryModel(terms, label, { withWinPct }) {
  const usable = study.filter(
    (r) => terms.every((t) => Number.isFinite(r[t])) && (!withWinPct || Number.isFinite(r.winPct)),
  )
  if (usable.length < 200) {
    console.log(`  ${label}: only ${usable.length} rows`)
    return null
  }
  const norms = {}
  for (const t of [...terms, ...(withWinPct ? ['winPct'] : [])]) {
    const v = usable.map((r) => r[t])
    const m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
    norms[t] = { m, sd }
  }
  const seasons = [...new Set(usable.map((r) => r.season))].sort().slice(1)
  const X = usable.map((r) => [
    1,
    ...terms.map((t) => (r[t] - norms[t].m) / norms[t].sd),
    ...(withWinPct ? [(r.winPct - norms.winPct.m) / norms.winPct.sd] : []),
    ...seasons.map((s) => (r.season === s ? 1 : 0)),
  ])
  const y = usable.map((r) => r.finalFour)
  const f = logistic(X, y)
  if (!f) {
    console.log(`  ${label}: did not converge`)
    return null
  }
  const names = [...terms, ...(withWinPct ? ['winPct'] : [])]
  const out = names.map((name, i) => {
    const b = f.beta[i + 1]
    const se = f.se[i + 1]
    return { name, beta: b, se, oddsRatio: Math.exp(b), p: normalTwoSidedP(b / se) }
  })
  console.log(
    `  ${label.padEnd(46)} n=${usable.length}  ` +
      out.map((o) => `${o.name} OR ${fmt(o.oddsRatio, 2)} p=${o.p < 0.0001 ? '<1e-4' : o.p.toFixed(3)}`).join('  '),
  )
  return { n: usable.length, terms: out }
}

console.log('\n=== reaching a Championship Series, modelled (odds ratio per SD, season fixed effects) ===')
const models = {}
models.hgAlone = tryModel(['homegrownShare'], 'final four ~ homegrown share', { withWinPct: false })
models.hgWin = tryModel(['homegrownShare'], 'final four ~ homegrown share + winning', { withWinPct: true })
models.pipeAlone = tryModel(['pipelineGrads', 'pipelineWar'], 'final four ~ pipeline', { withWinPct: false })
models.pipeWin = tryModel(['pipelineGrads', 'pipelineWar'], 'final four ~ pipeline + winning', { withWinPct: true })
models.speedAlone = tryModel(['promotionSpeed'], 'final four ~ promotion speed', { withWinPct: false })
models.speedWin = tryModel(['promotionSpeed'], 'final four ~ promotion speed + winning', { withWinPct: true })
models.allWin = tryModel(['homegrownShare', 'pipelineGrads', 'pipelineWar'], 'final four ~ everything + winning', { withWinPct: true })

// --- how the farm measures relate to winning at all ---------------------------
console.log('\n=== how each farm measure relates to winning percentage ===')
for (const [key, label] of MEASURES) {
  if (key === 'winPct') continue
  const pairs = study.filter((r) => Number.isFinite(r[key]) && Number.isFinite(r.winPct))
  const r = pearson(pairs.map((x) => x[key]), pairs.map((x) => x.winPct))
  console.log(`  ${label.padEnd(36)} r=${fmt(r.r, 3).padStart(7)}  p=${r.p < 0.0001 ? '<1e-4' : r.p.toFixed(4)}  (n=${pairs.length})`)
}

// --- the roll call -------------------------------------------------------------
// Which clubs actually made the final four most often in the window, and what
// their farms looked like. A table, not a test.
console.log('\n=== clubs by final-four appearances in the window ===')
const byOrg = new Map()
for (const r of study) {
  if (!byOrg.has(r.orgId)) byOrg.set(r.orgId, { ff: 0, n: 0, hg: [], pipe: [], war: [] })
  const o = byOrg.get(r.orgId)
  o.n++
  o.ff += r.finalFour
  o.hg.push(r.homegrownShare)
  o.pipe.push(r.pipelineGrads)
  o.war.push(r.pipelineWar)
}
const teams = JSON.parse(await readFile(join(repo, 'public', 'data', 'teams.json'), 'utf8'))
const teamName = {}
for (const list of Object.values(teams.bySportId ?? {})) {
  for (const t of list ?? []) if (t?.id) teamName[t.id] = t.abbreviation ?? t.teamName ?? t.name ?? t.id
}
const orgRows = [...byOrg.entries()]
  .map(([orgId, o]) => ({
    orgId,
    name: teamName[orgId] ?? orgId,
    ff: o.ff,
    n: o.n,
    hg: o.hg.reduce((a, b) => a + b, 0) / o.hg.length,
    pipe: o.pipe.reduce((a, b) => a + b, 0) / o.pipe.length,
    war: o.war.reduce((a, b) => a + b, 0) / o.war.length,
  }))
  .sort((a, b) => b.ff - a.ff)
for (const o of orgRows) {
  console.log(
    `  ${String(o.name).padEnd(5)} final four ${String(o.ff).padStart(2)}/${o.n}   homegrown ${(100 * o.hg).toFixed(1)}%   graduates/5yr ${fmt(o.pipe, 1).padStart(5)}   their rookie WAR ${fmt(o.war, 1).padStart(5)}`,
  )
}
const ffCorr = pearson(orgRows.map((o) => o.ff), orgRows.map((o) => o.hg))
const ffPipe = pearson(orgRows.map((o) => o.ff), orgRows.map((o) => o.pipe))
const ffWar = pearson(orgRows.map((o) => o.ff), orgRows.map((o) => o.war))
console.log(
  `\n  across the 30 clubs: final-four count vs homegrown share r=${fmt(ffCorr.r, 3)} (p=${ffCorr.p.toFixed(3)}), ` +
    `vs graduates r=${fmt(ffPipe.r, 3)} (p=${ffPipe.p.toFixed(3)}), vs their rookie WAR r=${fmt(ffWar.r, 3)} (p=${ffWar.p.toFixed(3)})`,
)

// --- the collinearity check the pipeline model demands -------------------------
// pipelineGrads and pipelineWar move together by construction — more graduates
// is more chances to accumulate WAR. When the pair enters one model and the
// coefficients come out with OPPOSITE signs, the first thing to establish is
// whether they are simply splitting one shared effect between them.
const pairSet = study.filter((r) => Number.isFinite(r.pipelineGrads) && Number.isFinite(r.pipelineWar))
const collin = pearson(pairSet.map((r) => r.pipelineGrads), pairSet.map((r) => r.pipelineWar))
console.log(`\n=== collinearity: graduates vs their rookie WAR, r=${fmt(collin.r, 3)} (n=${pairSet.length}) ===`)
console.log('  each entered ALONE, with winning controlled:')
const soloGrads = tryModel(['pipelineGrads'], 'final four ~ graduates + winning', { withWinPct: true })
const soloWar = tryModel(['pipelineWar'], 'final four ~ their rookie WAR + winning', { withWinPct: true })

// WAR PER GRADUATE separates the two questions cleanly: given that a club
// produced N men, were they any good? This is the form that cannot split a
// shared effect, because there is only one term.
for (const r of study) r.warPerGrad = r.pipelineGrads >= 5 ? r.pipelineWar / r.pipelineGrads : null
const perGrad = tryModel(['warPerGrad'], 'final four ~ WAR per graduate + winning', { withWinPct: true })

// WITHOUT winning in the model, the WAR term is neutral (OR 1.16, p=0.51) and
// only turns negative once winning is conditioned on. That is the signature of
// a COLLIDER, not a discovery: winning is caused by both the rookies and
// everybody else, so holding the record fixed forces the two to trade off. The
// negative coefficient is an artifact of the control and is reported as one.
const perGradNoWin = tryModel(['warPerGrad'], 'final four ~ WAR per graduate, NO winning control', { withWinPct: false })

// --- the falsification test ----------------------------------------------------
// A Championship Series appearance is a playoff berth plus two rounds of a
// coin flip. If graduate count really helps a club build an October team, it
// should show up in the berth — the part a club controls — at least as
// strongly. If it predicts ONLY the deep run, the more likely explanation is
// that eighty club-seasons found a pattern in noise.
console.log('\n=== falsification: does the same measure predict merely REACHING the postseason? ===')
function tryOutcome(outcomeKey, terms, label, withWinPct) {
  const usable = study.filter((r) => terms.every((t) => Number.isFinite(r[t])) && (!withWinPct || Number.isFinite(r.winPct)))
  const norm = (key) => {
    const v = usable.map((r) => r[key])
    const m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
    return (x) => (x - m) / sd
  }
  const ns = Object.fromEntries([...terms, ...(withWinPct ? ['winPct'] : [])].map((t) => [t, norm(t)]))
  const seasons = [...new Set(usable.map((r) => r.season))].sort().slice(1)
  const X = usable.map((r) => [
    1,
    ...terms.map((t) => ns[t](r[t])),
    ...(withWinPct ? [ns.winPct(r.winPct)] : []),
    ...seasons.map((sn) => (r.season === sn ? 1 : 0)),
  ])
  const f = logistic(X, usable.map((r) => r[outcomeKey]))
  if (!f) return null
  const names = [...terms, ...(withWinPct ? ['winPct'] : [])]
  const out = names.map((name, i) => ({ name, oddsRatio: Math.exp(f.beta[i + 1]), p: normalTwoSidedP(f.beta[i + 1] / f.se[i + 1]) }))
  console.log(`  ${label.padEnd(52)} n=${usable.length}  ` + out.map((o) => `${o.name} OR ${fmt(o.oddsRatio, 2)} p=${o.p < 0.0001 ? '<1e-4' : o.p.toFixed(3)}`).join('  '))
  return { n: usable.length, terms: out }
}
const falsify = {
  berthNoWin: tryOutcome('playoffs', ['pipelineGrads'], 'made the postseason ~ graduates', false),
  berthWin: tryOutcome('playoffs', ['pipelineGrads'], 'made the postseason ~ graduates + winning', true),
  ffNoWin: tryOutcome('finalFour', ['pipelineGrads'], 'final four ~ graduates', false),
  ffWin: tryOutcome('finalFour', ['pipelineGrads'], 'final four ~ graduates + winning', true),
}

// --- leave one club out --------------------------------------------------------
console.log('\n=== leave one club out (the graduates term, winning controlled) ===')
const looRows = []
const full = study.slice()
for (const orgId of [...new Set(study.map((r) => r.orgId))]) {
  const kept = full.filter((r) => r.orgId !== orgId)
  const usable = kept.filter((r) => Number.isFinite(r.pipelineGrads) && Number.isFinite(r.winPct))
  const norm = (key) => {
    const v = usable.map((r) => r[key])
    const m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
    return (x) => (x - m) / sd
  }
  const ng = norm('pipelineGrads')
  const nw = norm('winPct')
  const seasons = [...new Set(usable.map((r) => r.season))].sort().slice(1)
  const X = usable.map((r) => [1, ng(r.pipelineGrads), nw(r.winPct), ...seasons.map((s) => (r.season === s ? 1 : 0))])
  const f = logistic(X, usable.map((r) => r.finalFour))
  if (!f) continue
  looRows.push({ dropped: teamName[orgId] ?? orgId, or: Math.exp(f.beta[1]), p: normalTwoSidedP(f.beta[1] / f.se[1]) })
}
looRows.sort((a, b) => a.or - b.or)
console.log(`  odds ratio range across the 30 refits: ${fmt(looRows[0].or, 2)} to ${fmt(looRows[looRows.length - 1].or, 2)}`)
console.log(`  significant at p<0.05 in ${looRows.filter((r) => r.p < 0.05).length} of ${looRows.length}`)
console.log(`  weakest: ${looRows.slice(0, 3).map((r) => `drop ${r.dropped} → OR ${fmt(r.or, 2)}, p=${r.p.toFixed(3)}`).join('; ')}`)

await writeFile(
  join(here, 'q5-final-four.json'),
  JSON.stringify({ n: study.length, compRows, models, collin: collin.r, soloGrads, soloWar, perGrad, perGradNoWin, falsify, looRows, orgRows, ffCorr, ffPipe, ffWar }, null, 1),
)
console.log('\nwrote q5-final-four.json')
