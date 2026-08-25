// The October-texture spike: what is actually DIFFERENT about a postseason
// game, measured against the same players' own regular seasons.
//
// This is the first spike in docs/team-success-research.md that does not
// regress a roster trait against the outcome ladder. It asks the fan's
// question instead — October FEELS different, so is it? — and it answers it
// with a paired design: every comparison here holds the men on the field
// fixed and lets only the month change.
//
// THE ONE IDEA THIS WHOLE SCRIPT IS BUILT ON. "October offense is worse than
// regular-season offense" is a true sentence that measures almost nothing,
// because October rosters are not the league. The clubs are better, the arms
// are better, and the innings are handed to the best of those arms. So every
// question below is answered against a SELECTION-FREE EXPECTATION instead:
// take each man who actually appeared in October, take his own regular-season
// rates, weight him by the plate appearances or batters faced he actually got
// in October, and add it up. That is what October "should" have looked like
// if nothing changed but the calendar. The gap between that and what really
// happened is the finding. Everything else is roster construction, which the
// four earlier spikes already covered.
//
// AND THE TRAP INSIDE THAT IDEA, which the first pass of this script fell
// into. Doing it from the HITTERS' side alone answers the wrong question. An
// October hitter is better than the league average hitter, so his own rates
// set a HIGH bar; an October pitcher is better than the league average
// pitcher, so his own rates set a LOW one. Run the same test from the mound
// and it comes back with the opposite sign — pitchers "underperform" too,
// because they are facing better hitters. Both sides cannot be underachieving
// in the same game. The honest expectation has to hold BOTH ends of the
// matchup, which is what combinedExpectation() below does, and the residual
// against it is a great deal smaller than the one-sided version. Anyone
// reusing this file: never quote the one-sided number on its own.
//
// Reads:  october-texture.json (build-october-texture.mjs)
//         outcome-ladder.json  (build-outcome-ladder.mjs)
//         public/data/postseason-history.json (committed; every series + seed)
// Run:    node .scratch/team-success/analyze-october-texture.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..', '..')

const panel = JSON.parse(readFileSync(join(__dirname, 'october-texture.json'), 'utf8'))
const ladder = JSON.parse(readFileSync(join(__dirname, 'outcome-ladder.json'), 'utf8'))
const history = JSON.parse(readFileSync(join(REPO, 'public', 'data', 'postseason-history.json'), 'utf8'))

// 2020 is dropped from every season-level comparison and flagged where it
// matters: a 60-game regular season plus a 16-team bracket makes it a
// different sport for anything measured as a rate against a season baseline.
const SHORT_SEASON = 2020

// ------------------------------------------------------------- statistics
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const sum = (xs) => xs.reduce((a, b) => a + b, 0)

function sd(xs) {
  const m = mean(xs)
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1))
}

// Deterministic RNG so a rerun reproduces the same p-values exactly.
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// Paired sign-flip permutation test: under the null, the sign of each paired
// difference is arbitrary, so flip signs at random and see how often the mean
// difference is at least as extreme. The right test for "same player, two
// months" data — it assumes nothing about the shape of the differences.
function pairedPermutation(diffs, draws = 20000, seed = 7) {
  const observed = mean(diffs)
  const rand = rng(seed)
  let atLeastAsExtreme = 0
  for (let d = 0; d < draws; d++) {
    let acc = 0
    for (const x of diffs) acc += rand() < 0.5 ? x : -x
    if (Math.abs(acc / diffs.length) >= Math.abs(observed)) atLeastAsExtreme++
  }
  return { n: diffs.length, mean: observed, p: (atLeastAsExtreme + 1) / (draws + 1) }
}

function rankOf(xs) {
  const order = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
  const ranks = new Array(xs.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const r = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[order[k][1]] = r
    i = j + 1
  }
  return ranks
}

function spearman(xs, ys) {
  const rx = rankOf(xs)
  const ry = rankOf(ys)
  const mx = mean(rx)
  const my = mean(ry)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my)
    dx += (rx[i] - mx) ** 2
    dy += (ry[i] - my) ** 2
  }
  return num / Math.sqrt(dx * dy)
}

// Shuffle WITHIN season, the house convention for this program: it keeps each
// year's bracket shape and league-wide run environment fixed, so a p-value
// cannot be bought with era drift.
function permutationSpearmanWithinSeason(rows, xKey, yKey, draws = 10000, seed = 11) {
  const xs = rows.map((r) => r[xKey])
  const ys = rows.map((r) => r[yKey])
  const observed = spearman(xs, ys)
  const bySeason = new Map()
  rows.forEach((r, i) => {
    if (!bySeason.has(r.season)) bySeason.set(r.season, [])
    bySeason.get(r.season).push(i)
  })
  const rand = rng(seed)
  let atLeastAsExtreme = 0
  for (let d = 0; d < draws; d++) {
    const shuffled = xs.slice()
    for (const idx of bySeason.values()) {
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[shuffled[idx[i]], shuffled[idx[j]]] = [shuffled[idx[j]], shuffled[idx[i]]]
      }
    }
    if (Math.abs(spearman(shuffled, ys)) >= Math.abs(observed)) atLeastAsExtreme++
  }
  return { n: rows.length, rho: observed, p: (atLeastAsExtreme + 1) / (draws + 1) }
}

// Rank-residualised partial Spearman — the control the framework mandates for
// anything measured over a team's October, because total October volume
// tracks the ladder at rho≈0.91 by construction.
function partialSpearman(rows, xKey, yKey, zKey, draws = 10000, seed = 13) {
  const resid = (key) => {
    const r = rankOf(rows.map((row) => row[key]))
    const z = rankOf(rows.map((row) => row[zKey]))
    const mz = mean(z)
    const mr = mean(r)
    const beta = sum(z.map((v, i) => (v - mz) * (r[i] - mr))) / sum(z.map((v) => (v - mz) ** 2))
    return r.map((v, i) => v - mr - beta * (z[i] - mz))
  }
  const rx = resid(xKey)
  const ry = resid(yKey)
  const withResid = rows.map((row, i) => ({ season: row.season, _x: rx[i], _y: ry[i] }))
  return permutationSpearmanWithinSeason(withResid, '_x', '_y', draws, seed)
}

// Leave-one-season-out: refit the mean with each season dropped in turn. The
// framework calls for this on every finding — one strange October should not
// be able to carry a result.
function looSeason(rows, valueOf) {
  const results = rows.map((r) => {
    const rest = rows.filter((x) => x.season !== r.season)
    return { dropped: r.season, mean: mean(rest.map(valueOf)) }
  })
  return { min: Math.min(...results.map((r) => r.mean)), max: Math.max(...results.map((r) => r.mean)) }
}

const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '—')
const ip = (s) => {
  // statsapi ships innings as "18.1" meaning eighteen and one THIRD.
  if (s == null) return 0
  const [whole, part] = String(s).split('.')
  return Number(whole) + (Number(part || 0) % 10) / 3
}

// ------------------------------------------------------------------ index
const teamRow = new Map() // season|group|gameType|teamId -> stat
for (const r of panel.teamSeason) teamRow.set(`${r.season}|${r.group}|${r.gameType}|${r.teamId}`, r.stat)

const playerRow = new Map() // season|group|gameType|personId -> row
for (const r of panel.playerSeason) playerRow.set(`${r.season}|${r.group}|${r.gameType}|${r.personId}`, r)

const seasons = [...new Set(panel.teamSeason.map((r) => r.season))].sort()
const ladderBySeason = new Map(ladder.seasons.map((s) => [s.year, s]))

const out = { generatedAt: new Date().toISOString() }
const say = (...a) => console.log(...a)

// =========================================================================
say('\n' + '='.repeat(72))
say('Q1 — ARE THE AT-BATS LONGER?')
say('='.repeat(72))

// League pitches per plate appearance, both months, per season. Taken off the
// HITTING side, where numberOfPitches and plateAppearances are both league
// totals for the same set of events.
const ppaRows = []
for (const season of seasons) {
  const acc = { season, R: { p: 0, pa: 0, k: 0, bb: 0 }, P: { p: 0, pa: 0, k: 0, bb: 0 } }
  for (const gt of ['R', 'P']) {
    for (const r of panel.teamSeason) {
      if (r.season !== season || r.group !== 'hitting' || r.gameType !== gt) continue
      acc[gt].p += r.stat.numberOfPitches || 0
      acc[gt].pa += r.stat.plateAppearances || 0
      acc[gt].k += r.stat.strikeOuts || 0
      acc[gt].bb += r.stat.baseOnBalls || 0
    }
  }
  if (!acc.P.pa) continue
  ppaRows.push({
    season,
    regular: acc.R.p / acc.R.pa,
    postseason: acc.P.p / acc.P.pa,
    kRegular: acc.R.k / acc.R.pa,
    kPost: acc.P.k / acc.P.pa,
    bbRegular: acc.R.bb / acc.R.pa,
    bbPost: acc.P.bb / acc.P.pa,
    postPA: acc.P.pa,
  })
}
const ppaClean = ppaRows.filter((r) => r.season !== SHORT_SEASON)
const ppaDiff = ppaClean.map((r) => r.postseason - r.regular)
const ppaTest = pairedPermutation(ppaDiff, 20000, 3)
say(`\nPitches per plate appearance, season by season (2020 dropped):`)
say('  year   regular  October   gap')
for (const r of ppaClean)
  say(`  ${r.season}   ${f(r.regular, 3)}    ${f(r.postseason, 3)}   ${(r.postseason - r.regular >= 0 ? '+' : '') + f(r.postseason - r.regular, 3)}`)
const ppaUp = ppaDiff.filter((d) => d > 0).length
say(`\n  October longer in ${ppaUp} of ${ppaDiff.length} seasons.`)
say(`  mean gap ${f(ppaTest.mean, 4)} pitches per plate appearance, p=${f(ppaTest.p, 4)}`)
say(`  pooled: regular ${f(sum(ppaClean.map((r) => r.regular)) / ppaClean.length, 3)}, October ${f(sum(ppaClean.map((r) => r.postseason)) / ppaClean.length, 3)}`)

const kTest = pairedPermutation(ppaClean.map((r) => r.kPost - r.kRegular), 20000, 4)
const bbTest = pairedPermutation(ppaClean.map((r) => r.bbPost - r.bbRegular), 20000, 5)
say(`\n  strikeout rate per PA: mean gap ${f(kTest.mean * 100, 2)}pp, p=${f(kTest.p, 4)}`)
say(`  walk rate per PA:      mean gap ${f(bbTest.mean * 100, 2)}pp, p=${f(bbTest.p, 4)}`)
out.q1 = { rows: ppaClean, ppaTest, kTest, bbTest, seasonsLonger: ppaUp }

// =========================================================================
say('\n' + '='.repeat(72))
say('Q2 — DO THE HITTERS UNDERPERFORM, ONCE YOU HOLD THE ROSTER FIXED?')
say('='.repeat(72))

// The selection-free expectation. For every hitter who batted in October,
// spend his ACTUAL October plate appearances at his OWN regular-season rates.
function expectedOffense(season) {
  const actual = { pa: 0, ab: 0, h: 0, bb: 0, hbp: 0, tb: 0, k: 0, hr: 0, sf: 0 }
  const expected = { pa: 0, ab: 0, h: 0, bb: 0, hbp: 0, tb: 0, k: 0, hr: 0, sf: 0 }
  let skippedPA = 0
  for (const r of panel.playerSeason) {
    if (r.season !== season || r.group !== 'hitting' || r.gameType !== 'P') continue
    const pa = r.stat.plateAppearances || 0
    if (!pa) continue
    const reg = playerRow.get(`${season}|hitting|R|${r.personId}`)
    const regPA = reg?.stat?.plateAppearances || 0
    // A man with no regular-season plate appearances at all (a September
    // call-up who never batted, a two-way arm) has no baseline to hold him to.
    if (!reg || regPA < 1) {
      skippedPA += pa
      continue
    }
    actual.pa += pa
    actual.ab += r.stat.atBats || 0
    actual.h += r.stat.hits || 0
    actual.bb += r.stat.baseOnBalls || 0
    actual.hbp += r.stat.hitByPitch || 0
    actual.tb += r.stat.totalBases || 0
    actual.k += r.stat.strikeOuts || 0
    actual.hr += r.stat.homeRuns || 0
    actual.sf += r.stat.sacFlies || 0
    const scale = pa / regPA
    expected.pa += pa
    expected.ab += (reg.stat.atBats || 0) * scale
    expected.h += (reg.stat.hits || 0) * scale
    expected.bb += (reg.stat.baseOnBalls || 0) * scale
    expected.hbp += (reg.stat.hitByPitch || 0) * scale
    expected.tb += (reg.stat.totalBases || 0) * scale
    expected.k += (reg.stat.strikeOuts || 0) * scale
    expected.hr += (reg.stat.homeRuns || 0) * scale
    expected.sf += (reg.stat.sacFlies || 0) * scale
  }
  const line = (x) => ({
    avg: x.h / x.ab,
    obp: (x.h + x.bb + x.hbp) / (x.ab + x.bb + x.hbp + x.sf),
    slg: x.tb / x.ab,
    ops: (x.h + x.bb + x.hbp) / (x.ab + x.bb + x.hbp + x.sf) + x.tb / x.ab,
    k: x.k / x.pa,
    hr: x.hr / x.pa,
  })
  return { season, actual: line(actual), expected: line(expected), pa: actual.pa, skippedPA }
}

const offense = seasons.filter((s) => ladderBySeason.get(s)).map(expectedOffense).filter((o) => o.pa > 0)
const offenseClean = offense.filter((o) => o.season !== SHORT_SEASON)
say('\n  Every October hitter, spending his real October plate appearances at his')
say('  own regular-season rates — versus what actually happened.')
say('\n  year   expected OPS  actual OPS   gap     expected K%  actual K%')
for (const o of offenseClean)
  say(
    `  ${o.season}      ${f(o.expected.ops, 3)}        ${f(o.actual.ops, 3)}    ${(o.actual.ops - o.expected.ops >= 0 ? '+' : '') + f(o.actual.ops - o.expected.ops, 3)}     ${pct(o.expected.k)}       ${pct(o.actual.k)}`,
  )
const opsDiff = offenseClean.map((o) => o.actual.ops - o.expected.ops)
const opsTest = pairedPermutation(opsDiff, 20000, 6)
const kOffDiff = offenseClean.map((o) => o.actual.k - o.expected.k)
const kOffTest = pairedPermutation(kOffDiff, 20000, 8)
const hrOffTest = pairedPermutation(offenseClean.map((o) => o.actual.hr - o.expected.hr), 20000, 9)
const avgOffTest = pairedPermutation(offenseClean.map((o) => o.actual.avg - o.expected.avg), 20000, 10)
say(`\n  OPS below own-rate expectation in ${opsDiff.filter((d) => d < 0).length} of ${opsDiff.length} seasons.`)
say(`  mean OPS gap        ${f(opsTest.mean, 4)}  p=${f(opsTest.p, 4)}`)
say(`  mean batting-avg gap ${f(avgOffTest.mean, 4)}  p=${f(avgOffTest.p, 4)}`)
say(`  mean strikeout gap  ${f(kOffTest.mean * 100, 2)}pp  p=${f(kOffTest.p, 4)}`)
say(`  mean home-run gap   ${f(hrOffTest.mean * 100, 3)}pp per PA  p=${f(hrOffTest.p, 4)}`)
say(`  October PA covered: ${sum(offenseClean.map((o) => o.pa))}; PA with no regular-season baseline: ${sum(offenseClean.map((o) => o.skippedPA))}`)
out.q2 = { rows: offenseClean, opsTest, kOffTest, hrOffTest, avgOffTest }

// The same trick from the other side: hold the PITCHERS fixed instead.
function expectedPitching(season, roleFilter = null) {
  const actual = { bf: 0, ab: 0, h: 0, bb: 0, hbp: 0, tb: 0, k: 0, sf: 0 }
  const expected = { bf: 0, ab: 0, h: 0, bb: 0, hbp: 0, tb: 0, k: 0, sf: 0 }
  for (const r of panel.playerSeason) {
    if (r.season !== season || r.group !== 'pitching' || r.gameType !== 'P') continue
    const bf = r.stat.battersFaced || 0
    if (!bf) continue
    if (roleFilter === 'starter' && !(r.stat.gamesStarted > 0)) continue
    if (roleFilter === 'reliever' && r.stat.gamesStarted > 0) continue
    const reg = playerRow.get(`${season}|pitching|R|${r.personId}`)
    const regBF = reg?.stat?.battersFaced || 0
    if (!reg || regBF < 1) continue
    actual.bf += bf
    actual.ab += r.stat.atBats || 0
    actual.h += r.stat.hits || 0
    actual.bb += r.stat.baseOnBalls || 0
    actual.hbp += r.stat.hitByPitch || 0
    actual.tb += r.stat.totalBases || 0
    actual.k += r.stat.strikeOuts || 0
    actual.sf += r.stat.sacFlies || 0
    const scale = bf / regBF
    expected.bf += bf
    expected.ab += (reg.stat.atBats || 0) * scale
    expected.h += (reg.stat.hits || 0) * scale
    expected.bb += (reg.stat.baseOnBalls || 0) * scale
    expected.hbp += (reg.stat.hitByPitch || 0) * scale
    expected.tb += (reg.stat.totalBases || 0) * scale
    expected.k += (reg.stat.strikeOuts || 0) * scale
    expected.sf += (reg.stat.sacFlies || 0) * scale
  }
  const line = (x) => ({
    avg: x.h / x.ab,
    ops: (x.h + x.bb + x.hbp) / (x.ab + x.bb + x.hbp + x.sf) + x.tb / x.ab,
    k: x.k / x.bf,
  })
  return { season, actual: line(actual), expected: line(expected), bf: actual.bf }
}
const arms = seasons.filter((s) => ladderBySeason.get(s)).map((s) => expectedPitching(s)).filter((o) => o.bf > 0)
const armsClean = arms.filter((o) => o.season !== SHORT_SEASON)
const armsOpsTest = pairedPermutation(armsClean.map((o) => o.actual.ops - o.expected.ops), 20000, 12)
const armsKTest = pairedPermutation(armsClean.map((o) => o.actual.k - o.expected.k), 20000, 14)
say('\n  THE SAME TEST FROM THE MOUND — and why the one above is not the answer.')
say(`  mean OPS-against gap ${f(armsOpsTest.mean, 4)}  p=${f(armsOpsTest.p, 4)}`)
say(`  mean strikeout gap   ${f(armsKTest.mean * 100, 2)}pp  p=${f(armsKTest.p, 4)}`)
say('  The sign flips. Hitters "underachieve" their own season and pitchers')
say('  "underachieve" theirs, in the same games. Both cannot be true. What each')
say('  one-sided test really measures is the QUALITY OF THE OPPOSITION, not October.')
out.q2b = { rows: armsClean, armsOpsTest, armsKTest }

// The fix: an expectation that holds BOTH ends of the matchup.
//
// For a rate that behaves like a coin flip (strikeout, walk, hit per plate
// appearance) the standard combination is the odds ratio — a good hitter and a
// good pitcher meet somewhere in between, and the odds multiply. For OPS,
// which is a sum of two ratios rather than a probability, the plain additive
// form is used: a hitter 50 points above league meeting a pitcher who holds
// the league 40 points down should produce 10 points above league.
function log5(hitterRate, pitcherRate, leagueRate) {
  const odds = (p) => p / (1 - p)
  const combined = (odds(hitterRate) * odds(pitcherRate)) / odds(leagueRate)
  return combined / (1 + combined)
}

const leagueRegular = new Map()
for (const season of seasons) {
  let h = 0, ab = 0, bb = 0, hbp = 0, tb = 0, sf = 0, k = 0, pa = 0, hr = 0
  for (const r of panel.teamSeason) {
    if (r.season !== season || r.group !== 'hitting' || r.gameType !== 'R') continue
    h += r.stat.hits || 0; ab += r.stat.atBats || 0; bb += r.stat.baseOnBalls || 0
    hbp += r.stat.hitByPitch || 0; tb += r.stat.totalBases || 0; sf += r.stat.sacFlies || 0
    k += r.stat.strikeOuts || 0; pa += r.stat.plateAppearances || 0; hr += r.stat.homeRuns || 0
  }
  if (!pa) continue
  leagueRegular.set(season, {
    ops: (h + bb + hbp) / (ab + bb + hbp + sf) + tb / ab,
    avg: h / ab,
    k: k / pa,
    hr: hr / pa,
  })
}

const matchup = []
for (const o of offenseClean) {
  const a = armsClean.find((x) => x.season === o.season)
  const L = leagueRegular.get(o.season)
  if (!a || !L) continue
  matchup.push({
    season: o.season,
    league: L,
    hitterSide: o.expected,
    pitcherSide: a.expected,
    actual: o.actual,
    // Additive for OPS and batting average, odds-combined for the two rates
    // that are genuine per-plate-appearance probabilities.
    expOps: o.expected.ops + a.expected.ops - L.ops,
    expAvg: o.expected.avg + a.expected.avg - L.avg,
    expK: log5(o.expected.k, a.expected.k, L.k),
  })
}
const mOps = pairedPermutation(matchup.map((m) => m.actual.ops - m.expOps), 20000, 61)
const mAvg = pairedPermutation(matchup.map((m) => m.actual.avg - m.expAvg), 20000, 62)
const mK = pairedPermutation(matchup.map((m) => m.actual.k - m.expK), 20000, 63)
say('\n  HOLDING BOTH ENDS OF THE MATCHUP — the number this spike actually reports.')
say('  year   league  hitters  pitchers  both-sides  actual   gap')
for (const m of matchup)
  say(
    `  ${m.season}  ${f(m.league.ops, 3)}   ${f(m.hitterSide.ops, 3)}    ${f(m.pitcherSide.ops, 3)}     ${f(m.expOps, 3)}      ${f(m.actual.ops, 3)}  ${(m.actual.ops - m.expOps >= 0 ? '+' : '') + f(m.actual.ops - m.expOps, 3)}`,
  )
say(`\n  mean OPS gap vs. both-sides expectation ${f(mOps.mean, 4)}  p=${f(mOps.p, 4)}   (one-sided version was ${f(opsTest.mean, 4)})`)
say(`  mean batting-avg gap                    ${f(mAvg.mean, 4)}  p=${f(mAvg.p, 4)}`)
say(`  mean strikeout gap                      ${f(mK.mean * 100, 2)}pp  p=${f(mK.p, 4)}`)
say(`  below the both-sides line in ${matchup.filter((m) => m.actual.ops < m.expOps).length} of ${matchup.length} seasons.`)
const looMatch = looSeason(matchup, (m) => m.actual.ops - m.expOps)
say(`  leave-one-season-out range [${f(looMatch.min, 4)}, ${f(looMatch.max, 4)}]`)
const mEarly = matchup.filter((m) => m.season <= 2012)
const mLate = matchup.filter((m) => m.season >= 2013)
say(`  2000-2012 ${f(mean(mEarly.map((m) => m.actual.ops - m.expOps)), 4)}   2013-2025 ${f(mean(mLate.map((m) => m.actual.ops - m.expOps)), 4)}`)
out.q2match = { rows: matchup, mOps, mAvg, mK, looMatch,
  early: mean(mEarly.map((m) => m.actual.ops - m.expOps)), late: mean(mLate.map((m) => m.actual.ops - m.expOps)) }

// Starters vs. relievers, same test from the mound. Both groups face the same
// October lineups, so the comparison BETWEEN them is not touched by the
// opposition problem above even though each number on its own is.
say('\n  Splitting the October arms by role (both face the same lineups):')
for (const role of ['starter', 'reliever']) {
  const rows = seasons
    .filter((s) => ladderBySeason.get(s) && s !== SHORT_SEASON)
    .map((s) => expectedPitching(s, role))
    .filter((o) => o.bf > 0)
  const t = pairedPermutation(rows.map((o) => o.actual.ops - o.expected.ops), 20000, 64)
  say(`    ${role.padEnd(9)} OPS-against vs. own regular season ${(t.mean >= 0 ? '+' : '') + f(t.mean, 4)}  p=${f(t.p, 4)}  n=${t.n} seasons`)
  out[`q2role_${role}`] = t
}

// =========================================================================
say('\n' + '='.repeat(72))
say('Q3 — HOW MUCH OF OCTOBER IS A COIN FLIP?')
say('='.repeat(72))

const teamWins = new Map() // season|teamId -> {w,l}
for (const r of panel.teamSeason) {
  if (r.group !== 'pitching' || r.gameType !== 'R') continue
  teamWins.set(`${r.season}|${r.teamId}`, { w: r.stat.wins || 0, l: r.stat.losses || 0 })
}

const series = []
for (const s of history.seasons) {
  for (const round of s.rounds || []) {
    for (const ser of round.series || []) {
      const a = ser.teamA
      const b = ser.teamB
      if (!a || !b || !ser.winnerTeamId) continue
      const wa = teamWins.get(`${s.year}|${a.teamId}`)
      const wb = teamWins.get(`${s.year}|${b.teamId}`)
      if (!wa || !wb || !(wa.w + wa.l) || !(wb.w + wb.l)) continue
      const pctA = wa.w / (wa.w + wa.l)
      const pctB = wb.w / (wb.w + wb.l)
      if (pctA === pctB) continue // a genuine tie has no "better team" to be right about
      const betterId = pctA > pctB ? a.teamId : b.teamId
      series.push({
        season: s.year,
        round: round.key,
        label: ser.label,
        gap: Math.abs(pctA - pctB),
        gapWins: Math.abs(wa.w - wb.w),
        betterWon: ser.winnerTeamId === betterId,
        bestOf: (a.wins ?? 0) + (b.wins ?? 0) <= 3 ? 3 : Math.max(a.wins, b.wins) === 3 ? 5 : 7,
        higherSeedWon: a.seed != null && b.seed != null ? ser.winnerTeamId === (a.seed < b.seed ? a.teamId : b.teamId) : null,
      })
    }
  }
}
const betterWonRate = mean(series.map((s) => (s.betterWon ? 1 : 0)))
say(`\n  ${series.length} postseason series, 2000-2025, where the two clubs had different records.`)
say(`  The better regular-season record won ${series.filter((s) => s.betterWon).length} of them — ${pct(betterWonRate)}.`)

const seedSeries = series.filter((s) => s.higherSeedWon !== null)
say(`  The higher seed won ${pct(mean(seedSeries.map((s) => (s.higherSeedWon ? 1 : 0))))} of ${seedSeries.length}.`)

// Does a bigger record gap buy you anything?
const buckets = [
  { name: '1-3 games better  ', lo: 1, hi: 3 },
  { name: '4-7 games better  ', lo: 4, hi: 7 },
  { name: '8-12 games better ', lo: 8, hi: 12 },
  { name: '13+ games better  ', lo: 13, hi: 999 },
]
say('\n  Split by how much better the better club actually was:')
for (const b of buckets) {
  const inb = series.filter((s) => s.gapWins >= b.lo && s.gapWins <= b.hi)
  if (!inb.length) continue
  say(`    ${b.name} n=${String(inb.length).padStart(3)}  better club won ${pct(mean(inb.map((s) => (s.betterWon ? 1 : 0))))}`)
}
const gapRho = spearman(series.map((s) => s.gapWins), series.map((s) => (s.betterWon ? 1 : 0)))
const gapTest = permutationSpearmanWithinSeason(
  series.map((s) => ({ season: s.season, gap: s.gapWins, won: s.betterWon ? 1 : 0 })),
  'gap',
  'won',
  20000,
  17,
)
say(`\n  Does the size of the record gap predict the winner? rho=${f(gapRho, 4)}, p=${f(gapTest.p, 4)}`)

// By round: is the Wild Card round more of a lottery than the World Series?
say('\n  By round:')
for (const key of ['wildcard', 'division', 'lcs', 'worldseries']) {
  const inr = series.filter((s) => s.round === key)
  if (!inr.length) continue
  say(`    ${key.padEnd(12)} n=${String(inr.length).padStart(3)}  better club won ${pct(mean(inr.map((s) => (s.betterWon ? 1 : 0))))}`)
}

// The headline a fan can hold: did the league's best record win it all?
let bestRecordChamp = 0
let seasonsChecked = 0
const bestRecordYears = []
for (const s of history.seasons) {
  if (!s.championTeamId) continue
  const all = [...teamWins.entries()].filter(([k]) => k.startsWith(`${s.year}|`))
  if (all.length < 30) continue
  seasonsChecked++
  const best = all.sort((a, b) => b[1].w / (b[1].w + b[1].l) - a[1].w / (a[1].w + a[1].l))[0]
  if (Number(best[0].split('|')[1]) === s.championTeamId) {
    bestRecordChamp++
    bestRecordYears.push(s.year)
  }
}
say(`\n  The club with the league's best record won the World Series ${bestRecordChamp} times in ${seasonsChecked} seasons.`)
say(`  Those seasons: ${bestRecordYears.join(', ')}`)
out.q3 = { nSeries: series.length, betterWonRate, gapRho, gapTest, bestRecordChamp, seasonsChecked, bestRecordYears, series }

// =========================================================================
say('\n' + '='.repeat(72))
say('Q4 — DOES A PITCHER CHANGE WHAT HE THROWS?')
say('='.repeat(72))

const FASTBALLS = new Set(['FF', 'SI', 'FT', 'FC', 'FA'])
function arsenalShape(list) {
  const total = sum(list.map((p) => p.count || 0))
  if (!total) return null
  const shares = list.map((p) => (p.count || 0) / total)
  const top = Math.max(...shares)
  // "Leaning on your best stuff" as one number: the chance two pitches drawn
  // at random from an outing are the same type. 1.0 = one pitch only.
  const lean = sum(shares.map((s) => s * s))
  const meaningful = shares.filter((s) => s >= 0.1).length
  const fb = list.filter((p) => FASTBALLS.has(p.code))
  const fbCount = sum(fb.map((p) => p.count || 0))
  const fbSpeed = fbCount ? sum(fb.map((p) => (p.averageSpeed || 0) * (p.count || 0))) / fbCount : null
  return { total, top, lean, meaningful, fbShare: fbCount / total, fbSpeed }
}

const arsenalPairs = []
for (const a of panel.arsenal) {
  const R = arsenalShape(a.R)
  const P = arsenalShape(a.P)
  if (!R || !P || R.total < 300) continue // a real regular season to compare against
  const reg = playerRow.get(`${a.season}|pitching|R|${a.personId}`)
  const post = playerRow.get(`${a.season}|pitching|P|${a.personId}`)
  arsenalPairs.push({
    season: a.season,
    personId: a.personId,
    name: a.name,
    starter: (post?.stat?.gamesStarted || 0) > 0,
    R,
    P,
    dLean: P.lean - R.lean,
    dTop: P.top - R.top,
    dFbShare: P.fbShare - R.fbShare,
    dFbSpeed: R.fbSpeed != null && P.fbSpeed != null ? P.fbSpeed - R.fbSpeed : null,
    dMeaningful: P.meaningful - R.meaningful,
    regK: reg?.stat?.battersFaced ? (reg.stat.strikeOuts || 0) / reg.stat.battersFaced : null,
  })
}
// THE ARTIFACT THIS SECTION HAS TO RULE OUT FIRST, and it is a real one.
// "Share of his best pitch" is a MAXIMUM, and the maximum of a handful of
// noisy shares is biased upward when the sample is small. An October sample is
// ten times smaller than a regular season. So a pitcher who changed nothing at
// all would still LOOK like he narrowed his mix in October. Same for the
// squared-share measure and the count of pitches used at least a tenth of the
// time. The control: draw the same number of pitches October gave him, at
// random, from his own regular-season mix, and measure THAT the same way.
// Whatever gap survives against a shrunken-but-unchanged regular season is
// the part that is really about October.
function shrinkRegularSeason(list, targetPitches, draws, seed) {
  const total = sum(list.map((p) => p.count || 0))
  if (!total || !targetPitches) return null
  const cuts = []
  let acc = 0
  for (const p of list) {
    acc += (p.count || 0) / total
    cuts.push(acc)
  }
  const rand = rng(seed)
  const shapes = []
  for (let d = 0; d < draws; d++) {
    const counts = new Array(list.length).fill(0)
    for (let i = 0; i < targetPitches; i++) {
      const u = rand()
      let j = 0
      while (j < cuts.length - 1 && u > cuts[j]) j++
      counts[j]++
    }
    const shares = counts.map((c) => c / targetPitches)
    shapes.push({
      top: Math.max(...shares),
      lean: sum(shares.map((s) => s * s)),
      meaningful: shares.filter((s) => s >= 0.1).length,
    })
  }
  return {
    top: mean(shapes.map((s) => s.top)),
    lean: mean(shapes.map((s) => s.lean)),
    meaningful: mean(shapes.map((s) => s.meaningful)),
  }
}

say(`\n  ${arsenalPairs.length} pitcher-seasons with a full arsenal on both sides (2008-2025).`)
const leanTest = pairedPermutation(arsenalPairs.map((p) => p.dLean), 20000, 21)
const topTest = pairedPermutation(arsenalPairs.map((p) => p.dTop), 20000, 22)
const fbShareTest = pairedPermutation(arsenalPairs.map((p) => p.dFbShare), 20000, 23)
const speedPairs = arsenalPairs.filter((p) => p.dFbSpeed != null)
const speedTest = pairedPermutation(speedPairs.map((p) => p.dFbSpeed), 20000, 24)
say(`  leaning on the best pitch   ${f(topTest.mean * 100, 2)}pp  p=${f(topTest.p, 4)}`)
say(`  narrowing the mix overall   ${f(leanTest.mean, 4)}       p=${f(leanTest.p, 4)}`)
say(`  fastball share              ${f(fbShareTest.mean * 100, 2)}pp  p=${f(fbShareTest.p, 4)}`)
say(`  fastball velocity           ${f(speedTest.mean, 2)} mph  p=${f(speedTest.p, 4)}  n=${speedTest.n}`)
const narrowed = arsenalPairs.filter((p) => p.dLean > 0).length
say(`  ${narrowed} of ${arsenalPairs.length} pitchers narrowed their mix in October (${pct(narrowed / arsenalPairs.length)}).`)

// Now the same three numbers against a shrunken-but-unchanged regular season.
for (const p of arsenalPairs) {
  const shrunk = shrinkRegularSeason(p.R === null ? [] : panel.arsenal.find((a) => a.personId === p.personId && a.season === p.season).R, p.P.total, 60, p.personId + p.season)
  p.shrunk = shrunk
}
const withShrunk = arsenalPairs.filter((p) => p.shrunk)
const topFair = pairedPermutation(withShrunk.map((p) => p.P.top - p.shrunk.top), 20000, 27)
const leanFair = pairedPermutation(withShrunk.map((p) => p.P.lean - p.shrunk.lean), 20000, 28)
const meanFair = pairedPermutation(withShrunk.map((p) => p.P.meaningful - p.shrunk.meaningful), 20000, 29)
say('\n  Against a regular season shrunk to the same number of pitches — the fair test:')
say(`    best-pitch share ${f(topFair.mean * 100, 2)}pp  p=${f(topFair.p, 4)}   (naive version said ${f(topTest.mean * 100, 2)}pp)`)
say(`    narrowing overall ${f(leanFair.mean, 4)}      p=${f(leanFair.p, 4)}   (naive ${f(leanTest.mean, 4)})`)
say(`    pitches used at least a tenth of the time ${f(meanFair.mean, 3)}  p=${f(meanFair.p, 4)}`)
const naiveShareOfEffect = 1 - Math.abs(topFair.mean) / Math.abs(topTest.mean)
say(`    ${pct(naiveShareOfEffect, 0)} of the naive "narrowing" was the small sample, not the pitcher.`)
out.q4fair = { topFair, leanFair, meanFair, n: withShrunk.length }

for (const [label, subset] of [
  ['starters ', arsenalPairs.filter((p) => p.starter)],
  ['relievers', arsenalPairs.filter((p) => !p.starter)],
]) {
  const t = pairedPermutation(subset.map((p) => p.dTop), 20000, 25)
  const s = pairedPermutation(subset.filter((p) => p.dFbSpeed != null).map((p) => p.dFbSpeed), 20000, 26)
  say(`    ${label} n=${String(subset.length).padStart(4)}  best-pitch share ${f(t.mean * 100, 2)}pp (p=${f(t.p, 3)})  velocity ${f(s.mean, 2)} mph (p=${f(s.p, 3)})`)
}
out.q4 = { n: arsenalPairs.length, leanTest, topTest, fbShareTest, speedTest, narrowed }

// The biggest single-season mix changes, for names an entry can use. Ranked
// against the SHRUNKEN baseline, not the raw one, so the list is not just the
// pitchers with the fewest October pitches.
const biggest = withShrunk
  .filter((p) => p.P.total >= 200)
  .sort((a, b) => b.P.top - b.shrunk.top - (a.P.top - a.shrunk.top))
  .slice(0, 8)
say('\n  Biggest real October leans (200+ October pitches, measured fairly):')
for (const p of biggest)
  say(
    `    ${String(p.season)} ${p.name.padEnd(22)} best pitch ${pct(p.R.top, 0)} in the season -> ${pct(p.P.top, 0)} in October (a same-size slice of his season would have read ${pct(p.shrunk.top, 0)})`,
  )
out.q4big = biggest.map((p) => ({ season: p.season, name: p.name, regTop: p.R.top, postTop: p.P.top, fairTop: p.shrunk.top, postPitches: p.P.total }))

// =========================================================================
say('\n' + '='.repeat(72))
say('Q5 — THE QUICK HOOK')
say('='.repeat(72))

// League-level: how many pitchers a club uses per game, and how many batters
// each one faces, both months.
const hookRows = []
for (const season of seasons) {
  const l = ladderBySeason.get(season)
  if (!l) continue
  const acc = { R: { app: 0, bf: 0, games: 0, outs: 0 }, P: { app: 0, bf: 0, games: 0, outs: 0 } }
  for (const r of panel.playerSeason) {
    if (r.season !== season || r.group !== 'pitching') continue
    const gt = r.gameType
    if (!acc[gt]) continue
    acc[gt].app += r.stat.gamesPitched || 0
    acc[gt].bf += r.stat.battersFaced || 0
    acc[gt].outs += r.stat.outs || 0
  }
  for (const r of panel.teamSeason) {
    if (r.season !== season || r.group !== 'pitching') continue
    acc[r.gameType].games += r.stat.gamesPlayed || 0
  }
  if (!acc.P.games) continue
  hookRows.push({
    season,
    appPerGameR: acc.R.app / acc.R.games,
    appPerGameP: acc.P.app / acc.P.games,
    bfPerAppR: acc.R.bf / acc.R.app,
    bfPerAppP: acc.P.bf / acc.P.app,
  })
}
const hookClean = hookRows.filter((r) => r.season !== SHORT_SEASON)
say('\n  Pitchers used per club per game:')
say('  year   regular  October   gap')
for (const r of hookClean)
  say(`  ${r.season}   ${f(r.appPerGameR, 2)}     ${f(r.appPerGameP, 2)}     ${(r.appPerGameP - r.appPerGameR >= 0 ? '+' : '') + f(r.appPerGameP - r.appPerGameR, 2)}`)
const appTest = pairedPermutation(hookClean.map((r) => r.appPerGameP - r.appPerGameR), 20000, 31)
const bfAppTest = pairedPermutation(hookClean.map((r) => r.bfPerAppP - r.bfPerAppR), 20000, 32)
say(`\n  mean extra pitchers per game in October: ${f(appTest.mean, 3)}  p=${f(appTest.p, 4)}`)
say(`  mean change in batters faced per appearance: ${f(bfAppTest.mean, 3)}  p=${f(bfAppTest.p, 4)}`)
say(`  October used more pitchers in ${hookClean.filter((r) => r.appPerGameP > r.appPerGameR).length} of ${hookClean.length} seasons.`)

// Has the October hook moved over the window? Split the era in half.
const early = hookClean.filter((r) => r.season <= 2012)
const late = hookClean.filter((r) => r.season >= 2013)
say(`\n  2000-2012: ${f(mean(early.map((r) => r.appPerGameR)), 2)} regular -> ${f(mean(early.map((r) => r.appPerGameP)), 2)} October (gap ${f(mean(early.map((r) => r.appPerGameP - r.appPerGameR)), 2)})`)
say(`  2013-2025: ${f(mean(late.map((r) => r.appPerGameR)), 2)} regular -> ${f(mean(late.map((r) => r.appPerGameP)), 2)} October (gap ${f(mean(late.map((r) => r.appPerGameP - r.appPerGameR)), 2)})`)
out.q5 = { rows: hookClean, appTest, bfAppTest, early: mean(early.map((r) => r.appPerGameP - r.appPerGameR)), late: mean(late.map((r) => r.appPerGameP - r.appPerGameR)) }

// Same pitcher, same year: how long is his October start vs. his own?
const starterPairs = []
for (const r of panel.playerSeason) {
  if (r.group !== 'pitching' || r.gameType !== 'P') continue
  const gs = r.stat.gamesStarted || 0
  const g = r.stat.gamesPitched || 0
  if (!gs || gs !== g) continue // October pure starters only — no swingmen
  const reg = playerRow.get(`${r.season}|pitching|R|${r.personId}`)
  if (!reg) continue
  const rgs = reg.stat.gamesStarted || 0
  const rg = reg.stat.gamesPitched || 0
  if (rgs < 10 || rgs / rg < 0.8) continue // a real regular-season starter
  starterPairs.push({
    season: r.season,
    name: r.name,
    personId: r.personId,
    regOutsPerStart: (reg.stat.outs || 0) / rgs,
    postOutsPerStart: (r.stat.outs || 0) / gs,
    regPitchesPerStart: (reg.stat.numberOfPitches || 0) / rgs,
    postPitchesPerStart: (r.stat.numberOfPitches || 0) / gs,
    regBFPerStart: (reg.stat.battersFaced || 0) / rgs,
    postBFPerStart: (r.stat.battersFaced || 0) / gs,
    starts: gs,
  })
}
const outsTest = pairedPermutation(starterPairs.map((p) => p.postOutsPerStart - p.regOutsPerStart), 20000, 33)
const pitchTest = pairedPermutation(starterPairs.map((p) => p.postPitchesPerStart - p.regPitchesPerStart), 20000, 34)
const bfTest = pairedPermutation(starterPairs.map((p) => p.postBFPerStart - p.regBFPerStart), 20000, 35)
say(`\n  ${starterPairs.length} pitcher-seasons who started in October and started all year.`)
say(`  outs per start:     ${f(outsTest.mean, 2)}  (${f(outsTest.mean / 3, 2)} innings)  p=${f(outsTest.p, 4)}`)
say(`  pitches per start:  ${f(pitchTest.mean, 2)}  p=${f(pitchTest.p, 4)}`)
say(`  batters per start:  ${f(bfTest.mean, 2)}  p=${f(bfTest.p, 4)}`)
say(`  mean regular-season start: ${f(mean(starterPairs.map((p) => p.regOutsPerStart)) / 3, 2)} innings, ${f(mean(starterPairs.map((p) => p.regPitchesPerStart)), 1)} pitches`)
say(`  mean October start:        ${f(mean(starterPairs.map((p) => p.postOutsPerStart)) / 3, 2)} innings, ${f(mean(starterPairs.map((p) => p.postPitchesPerStart)), 1)} pitches`)

// The tell: pitches per BATTER is up (longer at-bats) while batters per start
// is down (quicker hook). Those pull in opposite directions on pitch count.
const perBatterR = mean(starterPairs.map((p) => p.regPitchesPerStart / p.regBFPerStart))
const perBatterP = mean(starterPairs.map((p) => p.postPitchesPerStart / p.postBFPerStart))
say(`  pitches per batter faced: ${f(perBatterR, 2)} regular -> ${f(perBatterP, 2)} October`)

const earlyStart = starterPairs.filter((p) => p.season <= 2012)
const lateStart = starterPairs.filter((p) => p.season >= 2013)
say(`\n  2000-2012 starters: ${f(mean(earlyStart.map((p) => p.postOutsPerStart - p.regOutsPerStart)) / 3, 2)} innings vs. their own regular season (n=${earlyStart.length})`)
say(`  2013-2025 starters: ${f(mean(lateStart.map((p) => p.postOutsPerStart - p.regOutsPerStart)) / 3, 2)} innings vs. their own regular season (n=${lateStart.length})`)
out.q5b = { n: starterPairs.length, outsTest, pitchTest, bfTest, perBatterR, perBatterP,
  earlyGap: mean(earlyStart.map((p) => p.postOutsPerStart - p.regOutsPerStart)) / 3,
  lateGap: mean(lateStart.map((p) => p.postOutsPerStart - p.regOutsPerStart)) / 3 }

// Does the quick hook actually WIN anything?
const teamHook = []
for (const s of ladder.seasons) {
  if (s.year === SHORT_SEASON) continue
  for (const [teamId, t] of Object.entries(s.teams)) {
    if (!t.madePostseason) continue
    let starterOuts = 0, starts = 0, teamOuts = 0, app = 0
    for (const r of panel.playerSeason) {
      if (r.season !== s.year || r.group !== 'pitching' || r.gameType !== 'P') continue
      if (String(r.teamId) !== teamId) continue
      teamOuts += r.stat.outs || 0
      app += r.stat.gamesPitched || 0
      const gs = r.stat.gamesStarted || 0
      if (gs && gs === (r.stat.gamesPitched || 0)) {
        starterOuts += r.stat.outs || 0
        starts += gs
      }
    }
    const games = teamRow.get(`${s.year}|pitching|P|${teamId}`)?.gamesPlayed || 0
    if (!starts || !games) continue
    teamHook.push({
      season: s.year,
      teamId: Number(teamId),
      ladder: t.ladder,
      outsPerStart: starterOuts / starts,
      appPerGame: app / games,
      totalOuts: teamOuts,
    })
  }
}
const hookRho = permutationSpearmanWithinSeason(teamHook, 'outsPerStart', 'ladder', 20000, 41)
const hookPartial = partialSpearman(teamHook, 'outsPerStart', 'ladder', 'totalOuts', 20000, 42)
const appRho = permutationSpearmanWithinSeason(teamHook, 'appPerGame', 'ladder', 20000, 43)
const appPartial = partialSpearman(teamHook, 'appPerGame', 'ladder', 'totalOuts', 20000, 44)
say(`\n  Among the ${teamHook.length} clubs that reached October, does a quicker hook go further?`)
say(`    starter length vs. ladder    raw rho=${f(hookRho.rho, 4)} p=${f(hookRho.p, 4)}  |  holding October volume fixed rho=${f(hookPartial.rho, 4)} p=${f(hookPartial.p, 4)}`)
say(`    pitchers per game vs. ladder raw rho=${f(appRho.rho, 4)} p=${f(appRho.p, 4)}  |  holding October volume fixed rho=${f(appPartial.rho, 4)} p=${f(appPartial.p, 4)}`)
out.q5c = { n: teamHook.length, hookRho, hookPartial, appRho, appPartial }

// Does the quick hook EXPLAIN the offence gap? If the reason bats go quiet in
// October is that a hitter keeps meeting a fresh arm, then the seasons with
// the biggest hook gap should be the seasons with the biggest offence gap.
const mech = []
for (const m of matchup) {
  const h = hookClean.find((x) => x.season === m.season)
  if (h) mech.push({ season: m.season, hookGap: h.appPerGameP - h.appPerGameR, opsGap: m.actual.ops - m.expOps })
}
const mechRho = spearman(mech.map((r) => r.hookGap), mech.map((r) => r.opsGap))
say(`\n  Do the seasons with the quickest hooks have the quietest bats? rho=${f(mechRho, 4)} over ${mech.length} seasons.`)
say('  (n=25 seasons is thin — this is a direction to check, not a result.)')
out.q5mech = { n: mech.length, rho: mechRho, rows: mech }

// ---------------------------------------------------------------- robustness
say('\n' + '='.repeat(72))
say('ROBUSTNESS — leave one season out')
say('='.repeat(72))
const looPPA = looSeason(ppaClean, (r) => r.postseason - r.regular)
const looOPS = looSeason(offenseClean, (o) => o.actual.ops - o.expected.ops)
const looApp = looSeason(hookClean, (r) => r.appPerGameP - r.appPerGameR)
say(`  pitches per PA gap      full ${f(ppaTest.mean, 4)}  range without any one season [${f(looPPA.min, 4)}, ${f(looPPA.max, 4)}]`)
say(`  OPS vs. expectation     full ${f(opsTest.mean, 4)}  range [${f(looOPS.min, 4)}, ${f(looOPS.max, 4)}]`)
say(`  extra pitchers per game full ${f(appTest.mean, 3)}  range [${f(looApp.min, 3)}, ${f(looApp.max, 3)}]`)
out.robustness = { looPPA, looOPS, looApp }

// 2020 kept out everywhere above — show what including it would have done.
say('\n  2020 (60-game season, 16-team bracket) was excluded throughout. With it in:')
const with2020 = pairedPermutation(ppaRows.map((r) => r.postseason - r.regular), 20000, 51)
say(`    pitches per PA gap ${f(with2020.mean, 4)} (vs. ${f(ppaTest.mean, 4)} without), p=${f(with2020.p, 4)}`)
out.with2020 = with2020

writeFileSync(join(__dirname, 'october-texture-findings.json'), JSON.stringify(out, null, 2))
say('\nWrote october-texture-findings.json')
