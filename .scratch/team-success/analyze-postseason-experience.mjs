// Spike #4: does prior postseason experience predict how far a team goes?
//
// Joins .scratch/team-success/postseason-experience.json (built by
// build-postseason-experience.mjs) to outcome-ladder.json, and asks the four
// questions the spike was commissioned with:
//   1. Do teams that REACH the World Series / Championship Series carry more
//      previously-experienced players than teams that merely got in?
//   2. Is experience a differentiator for ADVANCING, separately from a
//      differentiator for QUALIFYING?
//   3. Is the effect bigger on the pitching or the batting side?
//   4. Does any of it survive the obvious confound — a club that went deep
//      LAST year has experienced players BECAUSE it went deep, so the measure
//      may be nothing but roster continuity wearing a disguise.
//
// Question 4 is the whole spike. Every headline number below is reported
// twice: raw, and controlled for the club's OWN ladder rung in the previous
// season (plus roster age and era). If the effect dies under that control,
// the honest finding is "we measured continuity," and this script is written
// to report that outcome as readily as a positive one.
//
// The stats library (mean/sd/rank/pearson/spearman/leaveOneSeasonOut/
// permutationTest/permutationTestMeanDiff) is lifted verbatim from
// analyze-star-diversity.mjs so all four spikes in this program compute their
// numbers the same way. `partialSpearman` and `ols` are new here.
//
// Run: node .scratch/team-success/analyze-postseason-experience.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const read = (dir, name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))

const ladderData = read(__dirname, 'outcome-ladder.json')
const expData = read(__dirname, 'postseason-experience.json')
const rosterAge = read(__dirname, 'roster-age.json')
const usageData = read(__dirname, 'postseason-usage.json')

const ladderBySeason = new Map(ladderData.seasons.map((s) => [s.year, s]))
const expBySeason = new Map(expData.seasons.map((s) => [s.year, s]))
const ageBySeason = new Map(rosterAge.seasons.map((s) => [s.year, s]))
const usageBySeason = new Map(usageData.seasons.map((s) => [s.year, s]))

// ------------------------------------------------------------ stats library
function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}
function rank(xs) {
  const idx = xs.map((v, i) => i).sort((a, b) => xs[a] - xs[b])
  const ranks = new Array(xs.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[idx[k]] = avgRank
    i = j + 1
  }
  return ranks
}
function pearson(xs, ys) {
  const mx = mean(xs)
  const my = mean(ys)
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const den = Math.sqrt(
    xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0),
  )
  return den === 0 ? 0 : num / den
}
function spearman(xs, ys) {
  return pearson(rank(xs), rank(ys))
}
function leaveOneSeasonOut(rows, valueKey, outcomeKey) {
  const years = [...new Set(rows.map((r) => r.year))]
  return years.map((year) => {
    const subset = rows.filter((r) => r.year !== year)
    return spearman(
      subset.map((row) => row[valueKey]),
      subset.map((row) => row[outcomeKey]),
    )
  })
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function permutationTest(rows, valueKey, outcomeKey, groupKey, observed, iterations = 5000) {
  const byGroup = new Map()
  for (const row of rows) {
    if (!byGroup.has(row[groupKey])) byGroup.set(row[groupKey], [])
    byGroup.get(row[groupKey]).push(row)
  }
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const xs = []
    const ys = []
    for (const groupRows of byGroup.values()) {
      const outcomes = shuffle(groupRows.map((r) => r[outcomeKey]))
      groupRows.forEach((r, i) => {
        xs.push(r[valueKey])
        ys.push(outcomes[i])
      })
    }
    if (Math.abs(spearman(xs, ys)) >= Math.abs(observed)) extreme++
  }
  return extreme / iterations
}
function meanDiff(rows, valueKey, groupKey) {
  const inGroup = rows.filter((r) => r[groupKey]).map((r) => r[valueKey])
  const outGroup = rows.filter((r) => !r[groupKey]).map((r) => r[valueKey])
  return { inGroup: mean(inGroup), outGroup: mean(outGroup), n: [inGroup.length, outGroup.length] }
}
function permutationTestMeanDiff(rows, valueKey, groupKey, observedDiff, iterations = 5000) {
  const byGroup = new Map()
  for (const row of rows) {
    if (!byGroup.has(row.year)) byGroup.set(row.year, [])
    byGroup.get(row.year).push(row)
  }
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const permuted = []
    for (const groupRows of byGroup.values()) {
      const flags = shuffle(groupRows.map((r) => r[groupKey]))
      groupRows.forEach((r, i) => permuted.push({ ...r, __p: flags[i] }))
    }
    const d = meanDiff(permuted, valueKey, '__p')
    if (Math.abs(d.inGroup - d.outGroup) >= Math.abs(observedDiff)) extreme++
  }
  return extreme / iterations
}

// --------------------------------------------------- new: partial correlation
// Ordinary least squares by Gaussian elimination on the normal equations.
// Used only to residualise, so a plain solver is enough.
function ols(X, y) {
  const n = X.length
  const k = X[0].length
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0))
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      let s = 0
      for (let i = 0; i < n; i++) s += X[i][a] * X[i][b]
      A[a][b] = s
    }
    let s = 0
    for (let i = 0; i < n; i++) s += X[i][a] * y[i]
    A[a][k] = s
  }
  for (let col = 0; col < k; col++) {
    let piv = col
    for (let r = col + 1; r < k; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    ;[A[col], A[piv]] = [A[piv], A[col]]
    if (Math.abs(A[col][col]) < 1e-12) continue
    for (let r = 0; r < k; r++) {
      if (r === col) continue
      const f = A[r][col] / A[col][col]
      for (let c = col; c <= k; c++) A[r][c] -= f * A[col][c]
    }
  }
  // Gauss-Jordan left the matrix diagonal, so each coefficient is just its
  // own row's constant divided by its own pivot.
  return A.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[k] / row[i]))
}
function residualise(values, controlCols) {
  const n = values.length
  const X = Array.from({ length: n }, (_, i) => [1, ...controlCols.map((c) => c[i])])
  const beta = ols(X, values)
  return values.map((v, i) => v - X[i].reduce((s, x, j) => s + x * beta[j], 0))
}
// Spearman partial correlation: rank everything, then residualise both
// variables against the (ranked/dummy) controls and correlate what is left.
function partialSpearman(rows, valueKey, outcomeKey, controlKeys) {
  const xs = rank(rows.map((r) => r[valueKey]))
  const ys = rank(rows.map((r) => r[outcomeKey]))
  const cols = controlKeys.map((k) => {
    const raw = rows.map((r) => r[k])
    // Booleans stay 0/1 dummies; anything continuous gets ranked.
    return typeof raw[0] === 'boolean' ? raw.map((v) => (v ? 1 : 0)) : rank(raw)
  })
  if (!cols.length) return pearson(xs, ys)
  return pearson(residualise(xs, cols), residualise(ys, cols))
}
function permutationTestPartial(rows, valueKey, outcomeKey, controlKeys, observed, iterations = 2000) {
  const byYear = new Map()
  for (const row of rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, [])
    byYear.get(row.year).push(row)
  }
  let extreme = 0
  for (let iter = 0; iter < iterations; iter++) {
    const permuted = []
    for (const yearRows of byYear.values()) {
      const outcomes = shuffle(yearRows.map((r) => r[outcomeKey]))
      yearRows.forEach((r, i) => permuted.push({ ...r, [outcomeKey]: outcomes[i] }))
    }
    if (Math.abs(partialSpearman(permuted, valueKey, outcomeKey, controlKeys)) >= Math.abs(observed))
      extreme++
  }
  return extreme / iterations
}


// Seed comes straight off the ladder file (1-6, division winners are 1-3).
function seedFor(year, teamId) {
  const t = ladderBySeason.get(year)?.teams?.[teamId]
  return Number.isFinite(t?.seed) ? t.seed : NaN
}

// ------------------------------------------------------------- row assembly
const FIELDS = ['expShareRelative', 'deepShareRelative', 'wsShareRelative', 'expYearsRelative', 'expDepthRelative']

function buildRows(group, { includeShortSeason = false } = {}) {
  const rows = []
  for (const season of expData.seasons) {
    if (!includeShortSeason && season.year === 2020) continue
    const ladderSeason = ladderBySeason.get(season.year)
    const prevLadder = ladderBySeason.get(season.year - 1)
    const ageSeason = ageBySeason.get(season.year)
    if (!ladderSeason) continue
    for (const [teamId, groups] of Object.entries(season.teams)) {
      const g = groups[group]
      if (!g) continue
      // bbsbh-3b is renaming this key across the program; read both.
      const lad = ladderSeason.teams[teamId]
      if (!lad) continue
      const madePostseason = lad.madePostseason ?? lad.madePlayoffs ?? lad.ladder > 0
      const prev = prevLadder?.teams?.[teamId]
      const ageRel =
        group === 'hitting'
          ? ageSeason?.teams?.[teamId]?.battingAgeRelative
          : ageSeason?.teams?.[teamId]?.pitchingAgeRelative
      // Total postseason volume, for the playing-time control the framework
      // requires of any share-of-October measure.
      const psTeam = usageBySeason.get(season.year)?.teams?.[teamId]
      const psVolume = psTeam
        ? group === 'hitting'
          ? psTeam.hitting.reduce((s, p) => s + p.pa, 0)
          : psTeam.pitching.reduce((s, p) => s + p.ip, 0)
        : 0
      const row = {
        year: season.year,
        teamId,
        era: ladderSeason.era,
        ladder: lad.ladder,
        madePostseason,
        wonDivision: !!lad.wonDivision,
        reachedLcs: lad.ladder >= 3,
        reachedWs: lad.ladder >= 4,
        wonWs: lad.ladder >= 5,
        priorRung: prev ? prev.ladder : 0,
        priorRungKnown: !!prev,
        ageRelative: Number.isFinite(ageRel) ? ageRel : 0,
        psVolume,
        nPlayers: g.nPlayers,
        expShareRaw: g.expShare,
        deepShareRaw: g.deepShare,
      }
      for (const f of FIELDS) row[f] = g[f]
      rows.push(row)
    }
  }
  return rows
}

// ------------------------------------------------------------------ reporting
function hr(title) {
  console.log(`\n${'='.repeat(74)}\n${title}\n${'='.repeat(74)}`)
}

function describeByRung(rows, label) {
  console.log(`\n-- ${label}: raw share of playing time given to previously-experienced players`)
  const names = [
    '0 missed the postseason',
    '1 lost first series',
    '2 won a round, no LCS',
    '3 lost the LCS',
    '4 lost the World Series',
    '5 won the World Series',
  ]
  for (let r = 0; r <= 5; r++) {
    const sub = rows.filter((x) => x.ladder === r)
    if (!sub.length) {
      console.log(`   rung ${r} ${names[r].padEnd(26)} n=0`)
      continue
    }
    console.log(
      `   rung ${r} ${names[r].padEnd(26)} n=${String(sub.length).padStart(3)}  ` +
        `raw=${(mean(sub.map((x) => x.expShareRaw)) * 100).toFixed(1)}%  ` +
        `vs league=${(mean(sub.map((x) => x.expShareRelative)) * 100 >= 0 ? '+' : '')}` +
        `${(mean(sub.map((x) => x.expShareRelative)) * 100).toFixed(1)}pp  ` +
        `deep=${(mean(sub.map((x) => x.deepShareRaw)) * 100).toFixed(1)}%`,
    )
  }
}

function correlate(rows, label, outcomeKey = 'ladder') {
  console.log(`\n-- ${label} (n=${rows.length}) vs ${outcomeKey}`)
  for (const f of FIELDS) {
    const rho = spearman(
      rows.map((r) => r[f]),
      rows.map((r) => r[outcomeKey]),
    )
    const p = permutationTest(rows, f, outcomeKey, 'year', rho)
    const loso = leaveOneSeasonOut(rows, f, outcomeKey)
    const sameSign = loso.filter((v) => Math.sign(v) === Math.sign(rho)).length
    console.log(
      `   ${f.padEnd(20)} rho=${rho >= 0 ? '+' : ''}${rho.toFixed(4)}  perm p=${p.toFixed(4)}  ` +
        `leave-one-season-out kept sign ${sameSign}/${loso.length}  ` +
        `[${Math.min(...loso).toFixed(3)}, ${Math.max(...loso).toFixed(3)}]`,
    )
  }
}

function bandTest(rows, flagKey, label) {
  console.log(`\n-- band split: ${label}`)
  for (const f of ['expShareRelative', 'deepShareRelative']) {
    const d = meanDiff(rows, f, flagKey)
    const diff = d.inGroup - d.outGroup
    const p = permutationTestMeanDiff(rows, f, flagKey, diff)
    console.log(
      `   ${f.padEnd(20)} in=${(d.inGroup * 100).toFixed(2)}pp (n=${d.n[0]})  ` +
        `out=${(d.outGroup * 100).toFixed(2)}pp (n=${d.n[1]})  ` +
        `diff=${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(2)}pp  perm p=${p.toFixed(4)}`,
    )
  }
}

function confoundCheck(rows, label, outcomeKey = 'ladder') {
  console.log(`\n-- CONFOUND CHECK: ${label} (n=${rows.length}) vs ${outcomeKey}`)
  const specs = [
    { keys: [], name: 'raw' },
    { keys: ['priorRung'], name: '+ prior-year rung' },
    { keys: ['ageRelative'], name: '+ roster age' },
    { keys: ['priorRung', 'ageRelative'], name: '+ prior rung & age' },
  ]
  for (const f of ['expShareRelative', 'deepShareRelative']) {
    for (const spec of specs) {
      const rho = partialSpearman(rows, f, outcomeKey, spec.keys)
      const p = permutationTestPartial(rows, f, outcomeKey, spec.keys, rho)
      console.log(
        `   ${f.padEnd(20)} ${spec.name.padEnd(20)} rho=${rho >= 0 ? '+' : ''}${rho.toFixed(4)}  perm p=${p.toFixed(4)}`,
      )
    }
  }
}

// ---------------------------------------------------------------------- main
for (const group of ['hitting', 'pitching']) {
  const all = buildRows(group)
  const postseason = all.filter((r) => r.madePostseason)

  hr(`${group.toUpperCase()} — prior postseason experience`)
  console.log(
    `sample: ${all.length} team-seasons (2020 dropped as a 60-game season with a 16-team bracket), ` +
      `${postseason.length} of them made the postseason`,
  )

  describeByRung(all, group)

  // Q: does it separate QUALIFYING?
  correlate(all, `${group}, all team-seasons`, 'ladder')
  bandTest(all, 'madePostseason', 'made the postseason vs did not (all 30 clubs)')

  // Q: does it separate ADVANCING? (the commissioned question)
  correlate(postseason, `${group}, postseason teams only`, 'ladder')
  bandTest(postseason, 'reachedLcs', 'reached the LCS or better vs postseason teams that did not')
  bandTest(postseason, 'reachedWs', 'reached the World Series vs postseason teams that did not')
  bandTest(postseason, 'wonDivision', 'division winners vs wild cards (postseason teams only)')

  // Q: is it just roster continuity?
  confoundCheck(all, `${group}, all team-seasons`, 'ladder')
  confoundCheck(postseason, `${group}, postseason teams only`, 'ladder')
}

// ------------------------------------------- head-to-head: which side is it?
hr('HEAD TO HEAD — is the effect bigger on the pitching or the batting side?')
for (const outcome of ['ladder']) {
  for (const scope of ['all', 'postseason']) {
    for (const f of ['expShareRelative', 'deepShareRelative']) {
      const line = ['hitting', 'pitching'].map((group) => {
        let rows = buildRows(group)
        if (scope === 'postseason') rows = rows.filter((r) => r.madePostseason)
        const raw = spearman(
          rows.map((r) => r[f]),
          rows.map((r) => r[outcome]),
        )
        const ctl = partialSpearman(rows, f, outcome, ['priorRung', 'ageRelative'])
        return `${group}: raw ${raw >= 0 ? '+' : ''}${raw.toFixed(3)} / controlled ${ctl >= 0 ? '+' : ''}${ctl.toFixed(3)}`
      })
      console.log(`   ${scope.padEnd(11)} ${f.padEnd(20)} ${line.join('   |   ')}`)
    }
  }
}

// ------------------------------------------------------- named counterexamples
hr('NAMED CASES — the extremes, for the write-up')
{
  const rows = buildRows('hitting').filter((r) => r.ladder >= 4)
  rows.sort((a, b) => a.expShareRaw - b.expShareRaw)
  console.log('\nLeast experienced lineups ever to reach a World Series:')
  for (const r of rows.slice(0, 6))
    console.log(
      `   ${r.year} team ${r.teamId} — ${(r.expShareRaw * 100).toFixed(0)}% of PA experienced, ladder ${r.ladder}`,
    )
  console.log('\nMost experienced lineups to reach a World Series:')
  for (const r of rows.slice(-6).reverse())
    console.log(
      `   ${r.year} team ${r.teamId} — ${(r.expShareRaw * 100).toFixed(0)}% of PA experienced, ladder ${r.ladder}`,
    )

  const miss = buildRows('hitting').filter((r) => r.ladder === 0)
  miss.sort((a, b) => b.expShareRaw - a.expShareRaw)
  console.log('\nMost experienced lineups that missed the postseason entirely:')
  for (const r of miss.slice(0, 6))
    console.log(`   ${r.year} team ${r.teamId} — ${(r.expShareRaw * 100).toFixed(0)}% of PA experienced`)
}

// ------------------------------------------------- beyond team quality
// The strongest form of the commissioned question. Among clubs that already
// made the postseason, SEED is a compact stand-in for how good the club was
// over 162 games (1-3 are division winners, best record first). If experience
// only looks predictive because good clubs happen to be experienced, holding
// seed fixed should flatten it.
hr('BEYOND REGULAR-SEASON QUALITY — experience vs seed, postseason clubs only')
for (const group of ['hitting', 'pitching']) {
  const rows = buildRows(group)
    .filter((r) => r.madePostseason)
    .map((r) => ({ ...r, seed: seedFor(r.year, r.teamId) }))
    .filter((r) => Number.isFinite(r.seed))
  console.log(`\n${group} (n=${rows.length})`)
  const seedRho = spearman(rows.map((r) => r.seed), rows.map((r) => r.ladder))
  console.log(`   seed itself vs ladder: rho=${seedRho.toFixed(4)} (negative = better seed goes further)`)
  for (const f of ['expShareRelative', 'deepShareRelative']) {
    const raw = spearman(rows.map((r) => r[f]), rows.map((r) => r.ladder))
    const ctl = partialSpearman(rows, f, 'ladder', ['seed'])
    const pCtl = permutationTestPartial(rows, f, 'ladder', ['seed'], ctl)
    const ctl2 = partialSpearman(rows, f, 'ladder', ['seed', 'priorRung', 'ageRelative'])
    const pCtl2 = permutationTestPartial(rows, f, 'ladder', ['seed', 'priorRung', 'ageRelative'], ctl2)
    console.log(
      `   ${f.padEnd(20)} raw=${raw >= 0 ? '+' : ''}${raw.toFixed(4)}  ` +
        `| +seed=${ctl >= 0 ? '+' : ''}${ctl.toFixed(4)} p=${pCtl.toFixed(4)}  ` +
        `| +seed&rung&age=${ctl2 >= 0 ? '+' : ''}${ctl2.toFixed(4)} p=${pCtl2.toFixed(4)}`,
    )
  }
  // Does experience predict SEED itself? That is the qualifying channel.
  for (const f of ['expShareRelative']) {
    const rhoSeed = spearman(rows.map((r) => r[f]), rows.map((r) => r.seed))
    console.log(`   ${f} vs seed: rho=${rhoSeed.toFixed(4)} (negative = experienced clubs seed better)`)
  }
}

// --------------------------------------------------------- within-club test
// Removes club quality entirely: compare each club against ITS OWN 26-year
// average experience level. Does a club go further in the years when it is
// more experienced than it usually is?
hr('WITHIN-CLUB — each club against its own average, club quality differenced out')
for (const group of ['hitting', 'pitching']) {
  const all = buildRows(group)
  const byTeam = new Map()
  for (const r of all) {
    if (!byTeam.has(r.teamId)) byTeam.set(r.teamId, [])
    byTeam.get(r.teamId).push(r)
  }
  const demeaned = []
  for (const teamRows of byTeam.values()) {
    const mExp = mean(teamRows.map((r) => r.expShareRelative))
    const mDeep = mean(teamRows.map((r) => r.deepShareRelative))
    const mLad = mean(teamRows.map((r) => r.ladder))
    for (const r of teamRows) {
      demeaned.push({
        ...r,
        expShareRelative: r.expShareRelative - mExp,
        deepShareRelative: r.deepShareRelative - mDeep,
        ladderDemeaned: r.ladder - mLad,
      })
    }
  }
  console.log(`\n${group} (n=${demeaned.length}, all clubs)`)
  for (const f of ['expShareRelative', 'deepShareRelative']) {
    const rho = spearman(demeaned.map((r) => r[f]), demeaned.map((r) => r.ladderDemeaned))
    const p = permutationTest(demeaned, f, 'ladderDemeaned', 'year', rho)
    console.log(`   ${f.padEnd(20)} within-club rho=${rho >= 0 ? '+' : ''}${rho.toFixed(4)}  perm p=${p.toFixed(4)}`)
  }
  const ps = demeaned.filter((r) => r.madePostseason)
  console.log(`   -- postseason clubs only (n=${ps.length})`)
  for (const f of ['expShareRelative', 'deepShareRelative']) {
    const rho = spearman(ps.map((r) => r[f]), ps.map((r) => r.ladderDemeaned))
    const p = permutationTest(ps, f, 'ladderDemeaned', 'year', rho)
    console.log(`   ${f.padEnd(20)} within-club rho=${rho >= 0 ? '+' : ''}${rho.toFixed(4)}  perm p=${p.toFixed(4)}`)
  }
}
