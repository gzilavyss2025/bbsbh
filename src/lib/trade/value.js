// The trade simulator's value model: what a player is worth to the club that
// gets him, in dollars of surplus (value over salary) across the years the
// club controls him. Pure. Built on the front-office review's recipe
// (docs/trade-front-office-review.html):
//
//   projected WAR  a Marcel: the last three seasons weighted 5/4/3 as WAR per
//                  plate appearance, regressed by playing time, then an aging
//                  step per year ahead. Relievers are capped.
//   value          projected WAR x $/WAR, the $/WAR growing a few percent a year.
//   salary         the Cot's figure when there is one; else the minimum for a
//                  pre-arb year, or a share of his value for an arbitration year.
//   surplus        value less salary, summed over the controlled years and
//                  discounted back to next season.
//   prospects      a player with no big-league WAR is valued by his rank, from
//                  bucket averages.
//
// Every constant is a public rule of thumb, not a sourced figure, and the
// page says so next to the number. A contender values this year's wins more
// than this does.

export const VALUE = {
  perWar: 8.5e6,
  growth: 0.04,
  discount: 0.08,
  minSalary: 780e3,
  arbShare: [0.25, 0.4, 0.6],
  relieverCap: 1.5,
  mean: 1,
  meanWeight: 2,
}

const WEIGHTS = [5, 4, 3]

// Marcel's playing-time version (Tango): WAR per plate appearance (batters
// faced for a pitcher), the same 5/4/3 weights applied to both, regressed by a
// fixed 1200 PA of an average regular's rate (2 WAR a full season), so a
// full-time player keeps more of his own record than a part-timer. Next
// season's playing time is half of last year's, a tenth of the year before,
// plus a floor (200 PA; 100 BF for a pitcher).
export const PLAYING_TIME = { regress: 1200, meanRate: 2 / 600, floor: { bat: 200, pit: 100 } }

// The projected WAR for the season after `lastSeason`, or null with no seasons on file.
// With `pa` ({ season: PA or BF }) covering every weighted season, the
// playing-time version; without it, two seasons' weight of a 1-WAR mean.
export function marcel(byYear, lastSeason, pa = null, pitcher = false) {
  let num = 0
  let den = 0
  let time = 0
  let timed = true
  WEIGHTS.forEach((w, i) => {
    const v = byYear?.[lastSeason - i]
    if (Number.isFinite(v)) {
      num += w * v
      den += w
      const t = pa?.[lastSeason - i]
      if (t > 0) time += w * t
      else timed = false
    }
  })
  if (!den) return null
  if (pa && timed) {
    const { regress, meanRate, floor } = PLAYING_TIME
    const rate = (num + regress * meanRate) / (time + regress)
    const next = 0.5 * (pa[lastSeason] ?? 0) + 0.1 * (pa[lastSeason - 1] ?? 0) + floor[pitcher ? 'pit' : 'bat']
    return rate * next
  }
  return (num + VALUE.meanWeight * VALUE.mean) / (den + VALUE.meanWeight)
}

// The change in WAR from one season to the next at a given age: the FanGraphs
// rule of thumb (−0.5 a year from 30), steeper from 35 (docs/war-projection-research.html).
const ageStep = (age) => (age == null ? 0 : age < 27 ? 0.3 : age < 30 ? 0 : age < 35 ? -0.5 : -0.75)

// A prospect's value by rank: MLB's top 100 first, then his club's list.
export function prospectValue(topRank, orgRank) {
  if (topRank) return topRank <= 10 ? 80e6 : topRank <= 25 ? 55e6 : topRank <= 50 ? 40e6 : 25e6
  if (orgRank && orgRank <= 10) return 5e6
  return 1e6
}

// What one controlled year pays him: the contract's figure, else an estimate.
function salaryFor(row, worth) {
  if (Number.isFinite(row.value)) return row.value
  if (row.kind === 'arbitration') {
    const n = Number(String(row.code ?? '').replace(/\D/g, '')) || 1
    return VALUE.arbShare[Math.min(n, 3) - 1] * Math.max(worth, VALUE.minSalary)
  }
  if (row.kind === 'preArb' || row.kind === 'none') return VALUE.minSalary
  // An option year with no figure: assume it is priced at his worth (no surplus).
  return Math.max(worth, VALUE.minSalary)
}

// The years the club holds him from `nextYear` on, each with its kind:
// the contract's own cells, and for a pre-arb or arbitration player the
// years the ledger has not reached, estimated from his service time.
function controlledYears(contract, nextYear, contractYears) {
  return contractYears(contract, nextYear).filter((r) => r.kind !== 'free')
}

/**
 * { projWar, surplusUsd, payEstUsd, years, prospect }
 * `p` carries: age, onForty, warByYear ({season: WAR}), contract (the ledger's
 * cells, service, regime), role ('RP'/'CL' for a reliever), topRank, orgRank,
 * retainedUsd (next season's pay the sending club keeps).
 */
export function playerValue(p, { nextYear, warSeason, contractYears }) {
  const reliever = p.role === 'RP' || p.role === 'CL'
  const base = marcel(p.warByYear, warSeason ?? nextYear - 1, p.paByYear ?? null, p.pitcher ?? false)
  const ranked = p.topRank || p.orgRank
  // No big-league track record: a prospect is his rank; anyone else is a minimum-salary unknown.
  if (base == null) {
    return { projWar: null, surplusUsd: ranked || !p.onForty ? prospectValue(p.topRank, p.orgRank) : 0, payEstUsd: p.onForty ? VALUE.minSalary : null, years: [], prospect: true }
  }
  const rows = p.contract ? controlledYears(p.contract, nextYear, contractYears ?? defaultYears) : []
  let proj = base + ageStep(p.age)
  const years = []
  let surplus = 0
  rows.forEach((row, k) => {
    if (k > 0) proj += ageStep(p.age == null ? null : p.age + k)
    const war = Math.max(0, reliever ? Math.min(proj, VALUE.relieverCap) : proj)
    const worth = war * VALUE.perWar * (1 + VALUE.growth) ** k
    let pay = salaryFor(row, worth)
    if (k === 0 && p.retainedUsd) pay -= p.retainedUsd
    years.push({ year: row.year, war, worth, pay, estimated: !Number.isFinite(row.value) })
    surplus += (worth - pay) / (1 + VALUE.discount) ** k
  })
  const first = reliever ? Math.min(base + ageStep(p.age), VALUE.relieverCap) : base + ageStep(p.age)
  // A ranked prospect with a little big-league time keeps at least his rank's value.
  const surplusUsd = ranked && !p.signed ? Math.max(surplus, prospectValue(p.topRank, p.orgRank)) : surplus
  return { projWar: Math.max(0, first), surplusUsd, payEstUsd: years[0] ? years[0].pay + (p.retainedUsd || 0) : null, years, prospect: false }
}

// Without the contract helper (tests, a caller with no ledger): the contract's own cells only.
const defaultYears = (contract, from) => (contract?.cells ?? [])
  .filter((c) => c.year >= from && c.kind !== 'none')
  .concat(contract?.regime === 'pre_arb' ? preArbYears(contract, from) : [])

// A pre-arb player's controlled years from his service time: pre-arb to three
// years, arbitration through six (the same rule deal.js's contractYears uses).
function preArbYears(contract, from) {
  const service = contract?.service?.years
  if (service == null) return []
  const ledgerSeason = contract.cells?.[0]?.year ?? from - 1
  const out = []
  for (let year = from; year < from + 10; year++) {
    const banked = service + (year - ledgerSeason)
    if (banked >= 6) break
    out.push(banked >= 3 ? { year, kind: 'arbitration', code: `A${banked - 2}` } : { year, kind: 'preArb' })
  }
  return out
}

// The scoreboard's game-style read of a side's surplus value: a letter grade,
// and for the deal one verdict. The bands sit well outside the ±$15M error, so a
// grade never turns on noise.
const GRADES = [[100e6, 'A+'], [50e6, 'A'], [20e6, 'B+'], [-20e6, 'B'], [-50e6, 'C'], [-100e6, 'D']]
export const gradeOf = (usd) => GRADES.find(([floor]) => usd >= floor)?.[1] ?? 'F'

// 'fair' | 'win' | 'big' | 'steal' for the side that comes out ahead.
export function verdictOf(usd) {
  const v = Math.abs(usd)
  return v < 20e6 ? 'fair' : v < 50e6 ? 'win' : v < 100e6 ? 'big' : 'steal'
}

// A Competitive Balance pick's surplus, a rule of thumb like the rest: Round A
// sits after the first round, Round B after the second.
export const PICK_VALUE = { A: 8e6, B: 5e6 }
