// Q4: what month do top prospects debut in, and is there a pattern?
//
// "TOP PROSPECT" IS DEFINED BACKWARDS FROM THE AWARD SHELF, as asked. There is
// no historical top-100 list in this repo — the app only began keeping its own
// prospect snapshot on 2026-07-07, which is no use for a man drafted in 2013.
// What DOES reach back is the award record: statsapi carries every minor-league
// honor a player ever won, dated, from the organization all-star team up to
// Baseball America's Minor League Player of the Year.
//
// So pedigree here is the honors a man collected BEFORE he debuted, sorted into
// four tiers by how hard they are to win. The tier lists are printed at the top
// of the run so they can be argued with rather than taken on faith.
//
// WHAT COULD GO WRONG WITH THIS DEFINITION, said before the results:
//   - An award is a reward for performance in the minors, and performance in
//     the minors is what gets a man promoted. So a tier is partly a restatement
//     of "he was good", not an independent read on pedigree.
//   - Award coverage is denser in recent years. Any tier comparison that
//     ignores the debut year will read that density as pedigree.
//   - Relievers win almost nothing. A tier is therefore also partly a role.
// All three are handled by cutting within debut era and within role where the
// sample allows, and reported where they cannot be.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildCohort, here, fmt, summarize } from './lib.mjs'
import { chiSquareUpperTailP } from '../level-benchmarks/homegrown-stats.mjs'

const players = await buildCohort()
const awards = JSON.parse(await readFile(join(here, 'awards.json'), 'utf8'))
const catalog = JSON.parse(await readFile(join(here, 'award-catalog.json'), 'utf8'))
const awardName = Object.fromEntries(catalog.map((a) => [a.id, a.name]))

// --- the tiers ----------------------------------------------------------------
// Explicit id lists where the award is a named national honor; patterns where a
// family repeats per level or per league and listing all of them would be
// noise. Anything matching nothing is TIER 0 and is reported, so a family that
// should have been tiered cannot hide.
const TIER_A = new Set([
  'BAPOY', 'BAPITCH', 'TOPSPINK', 'USAMLPOY',
  'MiLBASHOY', 'MiLBASPOY', 'MiLBASPROSPECTS1', 'MiLBASPROSPECTS2', 'MiLBASBRKP',
  'PIPELINEHOY', 'PIPELINEPOY',
  'BAMMIBH', 'BAMMIOP', 'BAMMISP', 'BAMMIRP', 'BAMMIBP', 'BAMMILBOFF', 'BAMMILBRP', 'BAMMILBSP',
  'MILBHR', 'MILBRT', 'MILBGG', 'FUTMVP',
])
const TIER_B = new Set([
  'FUTURES', 'BAMILAS',
  'BAAAAAS', 'BAAAXAS', 'BAHAXXAS', 'BALAXXAS', 'BASSAS', 'BAROAS',
  'TOPAAAAS', 'TOPAAXAS',
  'AFLPSAS', 'AFLRS',
  'MILBHRAAA', 'MILBHRAAX', 'MILBHRAFX', 'MILBHRASX', 'MILBHRROK',
  'MILBRTAAA', 'MILBRTAAX', 'MILBRTAXX', 'MILBRTSS',
])
// Every level-specific MiLB.com honor: BAMAAA*, BAMAAX*, BAMADV*, BAMAXX*, BAMSS*,
// plus Topps' remaining level all-star teams and Baseball America's DSL team.
const TIER_B_PATTERN = /^(BAMAAA|BAMAAX|BAMADV|BAMAXX|BAMSS|MILBMSP|TOPAXXAS|TOPROAS|BADSLAS)/
// A LEAGUE'S OWN top honor — its MVP, its Pitcher of the Year, its Rookie of
// the Year, its top-prospect pick. One or two men a league a season, which puts
// it well above that league's twenty-odd all-stars and below a national award.
// The prefix is the league code (SAL, MWL, TL, EL, CAL, PCL, IL, FSL, PIO, AFL…),
// so this is matched on the SUFFIX rather than by listing thirty leagues.
const TIER_B_LEAGUE_TOP = /(MVP|PLOY|PIOY|PROY|POY|MOP|MOMLP|ROY)$/
// League all-star teams, mid- and post-season, across every affiliated league,
// plus the Pioneer League's own spelling of the same thing.
const TIER_C_PATTERN = /(MSAS|PSAS|LGAS|TOPS)$/
const TIER_D = new Set(['MILBORGAS'])
// MLB-scope honors and week-by-week trinkets, deliberately unranked. Weekly
// awards are excluded on purpose: a player of the week is a hot fortnight, and
// there are 26 of them a season per league.
const IGNORE_PATTERN = /(POW|POWH|POWP|POM|POMH|POMP)$/

// Winter ball, independent ball and the international tournaments are NOT
// minor-league pedigree and are left out rather than tiered: the Caribbean
// Series, the Dominican and Puerto Rican winter leagues, the Atlantic League,
// and the World Baseball Classic.
const NOT_MILB = /^(CS|DWL|PRWL|PR_DR|ALPB|WBC|MEX)/

function tierOf(id) {
  if (NOT_MILB.test(id)) return null
  if (TIER_A.has(id)) return 'A'
  if (TIER_B.has(id) || TIER_B_PATTERN.test(id) || TIER_B_LEAGUE_TOP.test(id)) return 'B'
  if (TIER_C_PATTERN.test(id)) return 'C'
  if (TIER_D.has(id)) return 'D'
  return null
}

// --- assemble each player's pre-debut shelf ----------------------------------
const TIER_RANK = { A: 4, B: 3, C: 2, D: 1 }
const seenByTier = { A: new Map(), B: new Map(), C: new Map(), D: new Map() }
let ignored = 0
let untiered = new Map()

for (const p of players) {
  const list = awards[p.id] ?? []
  p.shelf = []
  for (const a of list) {
    if (!a.date || a.date >= p.debutDate) continue // pre-debut only
    if (IGNORE_PATTERN.test(a.id)) {
      ignored++
      continue
    }
    const t = tierOf(a.id)
    if (!t) {
      untiered.set(a.id, (untiered.get(a.id) ?? 0) + 1)
      continue
    }
    seenByTier[t].set(a.id, (seenByTier[t].get(a.id) ?? 0) + 1)
    p.shelf.push({ ...a, tier: t })
  }
  p.topTier = p.shelf.length ? p.shelf.reduce((best, a) => (TIER_RANK[a.tier] > TIER_RANK[best] ? a.tier : best), 'D') : 'none'
  // The last honor before the call — the "work backwards" hook.
  p.lastAward = p.shelf.length ? p.shelf.reduce((m, a) => (a.date > m.date ? a : m)) : null
  p.futures = p.shelf.some((a) => a.id === 'FUTURES')
}

console.log('=== how the award shelf was tiered ===')
for (const t of ['A', 'B', 'C', 'D']) {
  const ids = [...seenByTier[t].entries()].sort((a, b) => b[1] - a[1])
  console.log(`  tier ${t}: ${ids.length} award types, ${ids.reduce((a, b) => a + b[1], 0)} pre-debut wins`)
  console.log(`    ${ids.slice(0, 8).map(([id, c]) => `${id}(${c})`).join(' ')}${ids.length > 8 ? ' …' : ''}`)
}
console.log(`  ignored (weekly awards): ${ignored}`)
const un = [...untiered.entries()].sort((a, b) => b[1] - a[1])
console.log(`  UNTIERED: ${un.length} types, ${un.reduce((a, b) => a + b[1], 0)} wins — ${un.slice(0, 12).map(([id, c]) => `${id}(${c})`).join(' ')}`)

const tierCounts = {}
for (const p of players) tierCounts[p.topTier] = (tierCounts[p.topTier] ?? 0) + 1
console.log('\ntop tier reached before the debut:', JSON.stringify(tierCounts))

// --- the debut-month distribution ---------------------------------------------
const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']
const MONTH_NUM = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7 }

function monthTable(set) {
  const c = new Array(8).fill(0)
  for (const p of set) {
    const i = MONTH_NUM[p.debutMonth]
    if (i != null) c[i]++
  }
  return c
}

function printMonths(label, set) {
  const c = monthTable(set)
  const n = c.reduce((a, b) => a + b, 0)
  console.log(
    `  ${label.padEnd(24)} n=${String(n).padStart(4)}  ` +
      c.map((v, i) => `${MONTHS[i]} ${((100 * v) / n).toFixed(1).padStart(4)}%`).join('  '),
  )
  return c
}

console.log('\n=== when everybody debuts ===')
const allMonths = printMonths('the whole cohort', players)

console.log('\n=== by award tier ===')
const tierMonths = {}
for (const t of ['A', 'B', 'C', 'D', 'none']) {
  const set = players.filter((p) => p.topTier === t)
  if (set.length < 40) continue
  tierMonths[t] = printMonths(`tier ${t} (${t === 'A' ? 'national POY' : t === 'B' ? 'national honor' : t === 'C' ? 'league all-star' : t === 'D' ? 'org all-star' : 'no honors'})`, set)
}

// Chi-square across tiers. Months with thin cells (March, October) are folded
// into their neighbours so the test is not driven by a cell of three.
function chiSquareTiers(tables) {
  const keys = Object.keys(tables)
  const fold = (c) => [c[0] + c[1], c[2], c[3], c[4], c[5], c[6] + c[7]] // Mar+Apr, May, Jun, Jul, Aug, Sep+Oct
  const obs = keys.map((k) => fold(tables[k]))
  const rowSum = obs.map((r) => r.reduce((a, b) => a + b, 0))
  const colSum = obs[0].map((_, j) => obs.reduce((a, r) => a + r[j], 0))
  const total = rowSum.reduce((a, b) => a + b, 0)
  let chi = 0
  for (let i = 0; i < obs.length; i++) {
    for (let jj = 0; jj < obs[i].length; jj++) {
      const e = (rowSum[i] * colSum[jj]) / total
      if (e > 0) chi += (obs[i][jj] - e) ** 2 / e
    }
  }
  const df = (obs.length - 1) * (obs[0].length - 1)
  return { chi, df, p: chiSquareUpperTailP(chi, df), keys }
}
const cs = chiSquareTiers(tierMonths)
console.log(`\n  chi-square across tiers: X²=${cs.chi.toFixed(1)}, df=${cs.df}, p=${cs.p < 0.0001 ? '<0.0001' : cs.p.toFixed(4)}`)

// --- the two months the sport argues about ------------------------------------
// April and September are the two the calendar creates rather than the player:
// an Opening Day roster spot, and a roster expansion that has changed size
// twice inside this cohort's span.
console.log('\n=== April vs September, by tier ===')
const aprSepRows = []
for (const t of ['A', 'B', 'C', 'D', 'none']) {
  const set = players.filter((p) => p.topTier === t)
  if (set.length < 40) continue
  const apr = set.filter((p) => p.debutMonth === 3 || p.debutMonth === 4).length
  const sep = set.filter((p) => p.debutMonth === 9 || p.debutMonth === 10).length
  aprSepRows.push({ tier: t, n: set.length, aprShare: apr / set.length, sepShare: sep / set.length })
  console.log(`  tier ${t.padEnd(5)} n=${String(set.length).padStart(4)}   Mar/Apr ${((100 * apr) / set.length).toFixed(1)}%   Sep/Oct ${((100 * sep) / set.length).toFixed(1)}%   ratio ${fmt(apr / sep, 2)}`)
}

// --- the same cut, inside a single era and inside a single role ---------------
console.log('\n=== the same table, 2015-2023 debuts only (award coverage is denser late) ===')
for (const t of ['A', 'B', 'C', 'D', 'none']) {
  const set = players.filter((p) => p.topTier === t && p.debutYear >= 2015)
  if (set.length < 40) continue
  printMonths(`tier ${t}`, set)
}

console.log('\n=== the same cut, hitters only (relievers win almost nothing) ===')
for (const t of ['A', 'B', 'C', 'D', 'none']) {
  const set = players.filter((p) => p.topTier === t && p.group === 'hitting')
  if (set.length < 40) continue
  printMonths(`tier ${t}`, set)
}

// --- working backwards: award date to debut date ------------------------------
console.log('\n=== from the last minor-league honor to the call ===')
const lagRows = []
for (const t of ['A', 'B', 'C', 'D']) {
  const set = players.filter((p) => p.topTier === t && p.lastAward)
  if (set.length < 40) continue
  const lagDays = set.map((p) => (new Date(p.debutDate) - new Date(p.lastAward.date)) / 86400000)
  const s = summarize(lagDays)
  // Same-season calls: the honor and the debut inside one calendar year.
  const sameSeason = set.filter((p) => p.lastAward.season === p.debutYear).length
  lagRows.push({ tier: t, n: set.length, medianLagDays: s.median, sameSeasonShare: sameSeason / set.length })
  console.log(
    `  tier ${t}  n=${String(set.length).padStart(4)}  median gap ${fmt(s.median, 0).padStart(4)} days (${fmt(s.median / 30.4, 1)} months)   honor and debut in the same season: ${((100 * sameSeason) / set.length).toFixed(0)}%`,
  )
}

// The Futures Game is the single sharpest marker in the shelf — one game, in
// July, for the best prospect in each organization. What happens next?
const fut = players.filter((p) => p.futures)
console.log(`\n=== Futures Game selections (${fut.length} of the cohort) ===`)
const futLast = fut.map((p) => {
  const sel = p.shelf.filter((a) => a.id === 'FUTURES').sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  return { p, sel, days: (new Date(p.debutDate) - new Date(sel.date)) / 86400000 }
})
const futSummary = summarize(futLast.map((f) => f.days))
console.log(`  median gap from a man's LAST Futures Game to his debut: ${fmt(futSummary.median, 0)} days (${fmt(futSummary.median / 30.4, 1)} months)`)
const within = {
  'same season, within 90 days': futLast.filter((f) => f.days <= 90).length,
  'next season': futLast.filter((f) => f.p.debutYear === f.sel.season + 1).length,
  'two or more seasons later': futLast.filter((f) => f.p.debutYear >= f.sel.season + 2).length,
}
for (const [k, v] of Object.entries(within)) console.log(`    ${k.padEnd(30)} ${v} (${((100 * v) / futLast.length).toFixed(0)}%)`)
console.log('  debut month of a Futures Game player:')
printMonths('    ', fut.map((p) => p))

// --- and the pattern nobody asks about: the day of the month -------------------
// If clubs were managing service time you would expect a lump in the back half
// of April and another around the middle of June, not a flat month.
console.log('\n=== within April and June, which half of the month? ===')
for (const [name, m] of [['April', 4], ['May', 5], ['June', 6], ['July', 7], ['September', 9]]) {
  const set = players.filter((p) => p.debutMonth === m)
  const first = set.filter((p) => Number(p.debutDate.slice(8, 10)) <= 15).length
  console.log(`  ${name.padEnd(10)} n=${String(set.length).padStart(4)}  1st-15th ${((100 * first) / set.length).toFixed(1)}%   16th-end ${(100 - (100 * first) / set.length).toFixed(1)}%`)
}

await writeFile(
  join(here, 'q4-debut-month.json'),
  JSON.stringify(
    {
      tierCounts,
      untiered: un.slice(0, 40),
      allMonths,
      tierMonths,
      chiSquare: cs,
      aprSepRows,
      lagRows,
      futures: { n: fut.length, medianLagDays: futSummary.median, within },
    },
    null,
    1,
  ),
)
console.log('\nwrote q4-debut-month.json')
