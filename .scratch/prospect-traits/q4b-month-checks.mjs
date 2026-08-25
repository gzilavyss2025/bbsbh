// Q4, second pass. The first pass says decorated prospects debut LATER in the
// season than undecorated ones — the men with no minor-league honors take the
// April roster spot, the Futures Game names turn up in August and September.
// Before that is written down as a fact about how clubs handle prospects, it
// has to survive the one objection that could kill it outright.
//
// THE OBJECTION. Half of these honors are won DURING a season, at a date. A
// Futures Game selection is played in mid-July. A man selected for it in 2019
// was, by definition, still a minor leaguer in mid-July 2019 — so he CANNOT
// appear in the April 2019 column. The award mechanically forbids the very
// month the finding says he avoids. If the whole effect is that artifact, it is
// not a finding at all.
//
// THE FIX is blunt and complete: throw away every honor won in the same season
// as the debut, and re-tier every player on what he had won in EARLIER seasons
// only. Now a tier-B man had his honor in the books before the season started,
// and nothing about the award constrains which month he comes up in.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCohort, here, fmt } from './lib.mjs'
import { chiSquareUpperTailP, normalTwoSidedP } from '../level-benchmarks/homegrown-stats.mjs'

const players = await buildCohort()
const awards = JSON.parse(await readFile(join(here, 'awards.json'), 'utf8'))

const TIER_A = new Set([
  'BAPOY', 'BAPITCH', 'TOPSPINK', 'USAMLPOY', 'MiLBASHOY', 'MiLBASPOY',
  'MiLBASPROSPECTS1', 'MiLBASPROSPECTS2', 'MiLBASBRKP', 'PIPELINEHOY', 'PIPELINEPOY',
  'BAMMIBH', 'BAMMIOP', 'BAMMISP', 'BAMMIRP', 'BAMMIBP', 'BAMMILBOFF', 'BAMMILBRP',
  'BAMMILBSP', 'MILBHR', 'MILBRT', 'MILBGG', 'FUTMVP',
])
const TIER_B = new Set([
  'FUTURES', 'BAMILAS', 'BAAAAAS', 'BAAAXAS', 'BAHAXXAS', 'BALAXXAS', 'BASSAS', 'BAROAS',
  'TOPAAAAS', 'TOPAAXAS', 'AFLPSAS', 'AFLRS', 'MILBHRAAA', 'MILBHRAAX', 'MILBHRAFX',
  'MILBHRASX', 'MILBHRROK', 'MILBRTAAA', 'MILBRTAAX', 'MILBRTAXX', 'MILBRTSS',
])
const TIER_B_PATTERN = /^(BAMAAA|BAMAAX|BAMADV|BAMAXX|BAMSS|MILBMSP|TOPAXXAS|TOPROAS|BADSLAS)/
const TIER_B_LEAGUE_TOP = /(MVP|PLOY|PIOY|PROY|POY|MOP|MOMLP|ROY)$/
const TIER_C_PATTERN = /(MSAS|PSAS|LGAS|TOPS)$/
const IGNORE_PATTERN = /(POW|POWH|POWP|POM|POMH|POMP)$/
const NOT_MILB = /^(CS|DWL|PRWL|PR_DR|ALPB|WBC|MEX)/
const TIER_RANK = { A: 4, B: 3, C: 2, D: 1 }

function tierOf(id) {
  if (NOT_MILB.test(id)) return null
  if (TIER_A.has(id)) return 'A'
  if (TIER_B.has(id) || TIER_B_PATTERN.test(id) || TIER_B_LEAGUE_TOP.test(id)) return 'B'
  if (TIER_C_PATTERN.test(id)) return 'C'
  if (id === 'MILBORGAS') return 'D'
  return null
}

// Two shelves per player: everything before the debut DATE (the first pass's
// rule), and everything from a STRICTLY EARLIER SEASON (this pass's rule).
for (const p of players) {
  const list = (awards[p.id] ?? []).filter((a) => a.date && !IGNORE_PATTERN.test(a.id) && tierOf(a.id))
  const byDate = list.filter((a) => a.date < p.debutDate)
  const byPriorSeason = list.filter((a) => a.season != null && a.season < p.debutYear)
  const top = (rowsIn) =>
    rowsIn.length ? rowsIn.reduce((best, a) => (TIER_RANK[tierOf(a.id)] > TIER_RANK[best] ? tierOf(a.id) : best), 'D') : 'none'
  p.tierByDate = top(byDate)
  p.tierPrior = top(byPriorSeason)
  p.futuresPrior = byPriorSeason.some((a) => a.id === 'FUTURES')
}

const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
const MONTH_NUM = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7 }
const table = (set) => {
  const c = new Array(8).fill(0)
  for (const p of set) {
    const i = MONTH_NUM[p.debutMonth]
    if (i != null) c[i]++
  }
  return c
}
function show(label, set) {
  const c = table(set)
  const n = c.reduce((a, b) => a + b, 0)
  console.log(
    `  ${label.padEnd(28)} n=${String(n).padStart(4)}  ` +
      c.map((v, i) => `${MONTHS[i]} ${((100 * v) / n).toFixed(1).padStart(4)}%`).join('  '),
  )
  return c
}

console.log('=== the finding, on the ORIGINAL rule (any honor before the debut date) ===')
for (const t of ['A', 'B', 'C', 'D', 'none']) {
  const s = players.filter((p) => p.tierByDate === t)
  if (s.length >= 40) show(`tier ${t}`, s)
}

console.log('\n=== the same, on PRIOR SEASONS ONLY (the artifact cannot reach this) ===')
const priorTables = {}
for (const t of ['A', 'B', 'C', 'D', 'none']) {
  const s = players.filter((p) => p.tierPrior === t)
  if (s.length >= 40) priorTables[t] = show(`tier ${t}`, s)
}

function chi(tables) {
  const keys = Object.keys(tables)
  const fold = (c) => [c[0] + c[1], c[2], c[3], c[4], c[5], c[6] + c[7]]
  const obs = keys.map((k) => fold(tables[k]))
  const rowSum = obs.map((r) => r.reduce((a, b) => a + b, 0))
  const colSum = obs[0].map((_, jj) => obs.reduce((a, r) => a + r[jj], 0))
  const total = rowSum.reduce((a, b) => a + b, 0)
  let x = 0
  for (let i = 0; i < obs.length; i++)
    for (let jj = 0; jj < obs[i].length; jj++) {
      const e = (rowSum[i] * colSum[jj]) / total
      if (e > 0) x += (obs[i][jj] - e) ** 2 / e
    }
  const df = (obs.length - 1) * (obs[0].length - 1)
  return { chi: x, df, p: chiSquareUpperTailP(x, df) }
}
const csPrior = chi(priorTables)
console.log(`\n  chi-square, prior-season tiers: X²=${csPrior.chi.toFixed(1)}, df=${csPrior.df}, p=${csPrior.p < 0.0001 ? '<0.0001' : csPrior.p.toFixed(4)}`)

// The single sharpest contrast, tested on its own: a decorated prospect vs a
// man with nothing at all, April against the last two months.
function twoProp(a, b) {
  const p1 = a.hits / a.n
  const p2 = b.hits / b.n
  const pp = (a.hits + b.hits) / (a.n + b.n)
  const se = Math.sqrt(pp * (1 - pp) * (1 / a.n + 1 / b.n))
  const z = (p1 - p2) / se
  return { p1, p2, z, p: normalTwoSidedP(z) }
}
const decorated = players.filter((p) => p.tierPrior === 'A' || p.tierPrior === 'B')
const undecorated = players.filter((p) => p.tierPrior === 'none')
console.log(`\n=== decorated (tier A/B on prior seasons, n=${decorated.length}) vs undecorated (n=${undecorated.length}) ===`)
const cuts = [
  ['debuts in Mar/Apr', (p) => p.debutMonth <= 4],
  ['debuts in Aug/Sep/Oct', (p) => p.debutMonth >= 8],
  ['debuts in the first half (Mar-Jun)', (p) => p.debutMonth <= 6],
]
const cutRows = []
for (const [label, test] of cuts) {
  const r = twoProp(
    { hits: decorated.filter(test).length, n: decorated.length },
    { hits: undecorated.filter(test).length, n: undecorated.length },
  )
  cutRows.push({ label, ...r })
  console.log(
    `  ${label.padEnd(36)} decorated ${(100 * r.p1).toFixed(1)}%   undecorated ${(100 * r.p2).toFixed(1)}%   p=${r.p < 0.0001 ? '<0.0001' : r.p.toFixed(4)}`,
  )
}

// Futures Game men, on prior seasons only.
const futPrior = players.filter((p) => p.futuresPrior)
console.log(`\n=== Futures Game in an EARLIER season (n=${futPrior.length}) ===`)
show('  ', futPrior)

// --- the day-level look ------------------------------------------------------
// Service-time management, if it were visible at all, would show as a lump in
// the back half of April — the club holding a man past the date that costs it a
// seventh year of control. This is the resolution that could see it.
console.log('\n=== April, week by week ===')
const aprilRows = []
for (const [label, lo, hi] of [['Apr 1-7', 1, 7], ['Apr 8-14', 8, 14], ['Apr 15-21', 15, 21], ['Apr 22-30', 22, 31]]) {
  const all = players.filter((p) => p.debutMonth === 4 && Number(p.debutDate.slice(8, 10)) >= lo && Number(p.debutDate.slice(8, 10)) <= hi)
  const dec = decorated.filter((p) => p.debutMonth === 4 && Number(p.debutDate.slice(8, 10)) >= lo && Number(p.debutDate.slice(8, 10)) <= hi)
  aprilRows.push({ label, all: all.length, decorated: dec.length })
  console.log(`  ${label.padEnd(10)} all ${String(all.length).padStart(4)}   of them decorated ${String(dec.length).padStart(3)} (${((100 * dec.length) / (all.length || 1)).toFixed(0)}%)`)
}

console.log('\n=== September, week by week ===')
for (const [label, lo, hi] of [['Sep 1-7', 1, 7], ['Sep 8-14', 8, 14], ['Sep 15-21', 15, 21], ['Sep 22-30', 22, 31]]) {
  const all = players.filter((p) => p.debutMonth === 9 && Number(p.debutDate.slice(8, 10)) >= lo && Number(p.debutDate.slice(8, 10)) <= hi)
  console.log(`  ${label.padEnd(10)} ${String(all.length).padStart(4)}`)
}

// --- has it changed over time? ------------------------------------------------
// Roster expansion shrank from 40 men to 28 in 2020. If September is a rule
// rather than a preference, that change should be visible.
console.log('\n=== September share of all debuts, by year ===')
const yearRows = []
for (let y = 2005; y <= 2023; y++) {
  const s = players.filter((p) => p.debutYear === y)
  if (s.length < 40) continue
  const sep = s.filter((p) => p.debutMonth >= 9).length
  const apr = s.filter((p) => p.debutMonth <= 4).length
  yearRows.push({ year: y, n: s.length, sepShare: sep / s.length, aprShare: apr / s.length })
  console.log(`  ${y}  n=${String(s.length).padStart(4)}  Sep ${((100 * sep) / s.length).toFixed(1).padStart(5)}%   Mar/Apr ${((100 * apr) / s.length).toFixed(1).padStart(5)}%`)
}
const pre = yearRows.filter((r) => r.year <= 2019)
const post = yearRows.filter((r) => r.year >= 2021)
const share = (rows) => rows.reduce((a, r) => a + r.sepShare * r.n, 0) / rows.reduce((a, r) => a + r.n, 0)
console.log(`\n  September share, 2005-2019: ${(100 * share(pre)).toFixed(1)}%   2021-2023: ${(100 * share(post)).toFixed(1)}%`)

await writeFile(
  join(here, 'q4b-month-checks.json'),
  JSON.stringify({ priorTables, csPrior, cutRows, aprilRows, yearRows, futuresPrior: futPrior.length }, null, 1),
)
console.log('\nwrote q4b-month-checks.json')
