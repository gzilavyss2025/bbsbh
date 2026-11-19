// The trade card's arithmetic (/trade). Pure: no fetch, no React.
//
// A player row is built from three sources the page already ships: the club's
// live 40-man roster (statsapi), its Cot's ledger (public/data/team-contracts,
// one cell per season), and war.json. A deal is two sides, each sending players
// and cash. The card states what moves; it never grades who wins.

// Next season's pay. A guaranteed figure is a number; an arbitration year, a
// club option or a pre-arbitration year has no fixed figure yet, so it
// carries a label instead and stays out of the payroll sum.
export function nextYearPay(cells, year, regime = null) {
  const cell = cells?.find((c) => c.year === year)
  if (!cell) return { usd: null, label: null }
  if (cell.kind === 'salary' || cell.kind === 'guaranteed') return { usd: cell.value ?? null, label: null }
  if (cell.kind === 'arbitration') return { usd: null, label: `Arb ${cell.code?.replace('A', '') ?? ''}`.trim() }
  if (cell.kind === 'option') return { usd: null, label: 'Option' }
  if (cell.kind === 'free') return { usd: null, label: 'Free agent' }
  // A blank year is pre-arb only for a pre-arb player; on anyone else it says nothing.
  return { usd: null, label: regime === 'pre_arb' ? 'Pre-arb' : null }
}

// Seasons the club holds him from `fromYear` on, and the last of them. Read
// off contractYears, so the row and the tap-open panel never disagree.
export function controlYears(ledger, fromYear) {
  if (!ledger?.cells) return { years: null, thru: null, rough: false }
  const held = contractYears(ledger, fromYear).filter((r) => r.kind !== 'free')
  return { years: held.length, thru: held.at(-1)?.year ?? null, rough: held.some((r) => r.rough) }
}

// One row on the card.
export function tradePlayer({ id, name, position, onForty = true }, { ledger = null, war = null, orgRank = null, topRank = null, line = null, nextYear }) {
  const pay = nextYearPay(ledger?.cells, nextYear, ledger?.regime)
  const control = controlYears(ledger, nextYear)
  return {
    id,
    name,
    pos: position || ledger?.pos || '',
    age: ledger?.age ?? null,
    payUsd: pay.usd,
    // The salary he was last paid (the ledger's season), shown on the roster row
    // where next season's figure is not set yet.
    lastSalaryUsd: ledger?.salary ?? null,
    lastSeason: ledger?.cells?.[0]?.year ?? null,
    payLabel: pay.label,
    control: control.years,
    controlRough: control.rough,
    // The last season the club holds him, and whether that is a signed deal
    // ("signed thru") or arbitration/pre-arb control ("control thru").
    thru: control.thru,
    signed: ledger?.regime === 'signed',
    war: Number.isFinite(war) ? war : null,
    serviceYears: ledger?.service?.years ?? null,
    optionsLeft: ledger?.options?.remaining ?? null,
    orgRank,
    topRank,
    // This season's line: { ops, pa } for a hitter, { era, ip } for a pitcher.
    line,
    onForty,
    // The ledger's own words and year cells, for the tap-open contract detail.
    contract: ledger ? { regime: ledger.regime ?? null, terms: ledger.terms ?? null, cells: ledger.cells ?? [], service: ledger.service ?? null, options: ledger.options ?? null } : null,
  }
}

const sum = (rows, pick) => rows.reduce((t, r) => t + (pick(r) ?? 0), 0)
const forty = (rows) => rows.filter((r) => r.onForty).length

// Both sides' totals and the plain-language notes. `a` and `b` are
// { name, fortyCount, sends: [player rows], cashUsd }.
// A big-league salary not set yet (arbitration, option, pre-arb). A minor
// leaguer off the 40-man draws no MLB salary at all, so he is not one.
export const unsetSalary = (r) => r.payUsd == null && (r.onForty || r.contract != null)

export function dealSummary(a, b) {
  const payOut = (side) => sum(side.sends, (r) => r.payUsd)
  // A club's payroll moves by the salaries it takes in, less those it sends,
  // plus the cash it sends and less the cash it gets.
  // Retained salary already left the moving pay (applyRetain); the sending club keeps paying it.
  const payrollA = payOut(b) - payOut(a) + (a.cashUsd || 0) - (b.cashUsd || 0)
  const warA = sum(b.sends, (r) => r.war) - sum(a.sends, (r) => r.war)
  const controlIn = (side) => sum(side.sends, (r) => r.control)
  const fortyAfterA = a.fortyCount - forty(a.sends) + forty(b.sends)
  const fortyAfterB = b.fortyCount - forty(b.sends) + forty(a.sends)

  const notes = []
  for (const r of [...a.sends, ...b.sends]) {
    if (!r.onForty) notes.push(`${r.name} is not on the 40-man roster, so he moves without taking a spot.`)
    if ((r.serviceYears ?? 0) >= 10) notes.push(`${r.name} has 10+ years of service. If he has spent the last 5 with one club, he can block the trade (10-and-5 rights).`)
  }
  for (const side of [a, b]) {
    if (side.cashUsd) notes.push(`The ${side.name} send ${money(side.cashUsd)} in cash.`)
    for (const r of side.sends) {
      if (r.retainedUsd) notes.push(`The ${side.name} keep ${money(r.retainedUsd)} of ${r.name}'s salary.`)
    }
  }
  if (fortyAfterA > 40) notes.push(`The ${a.name} go to ${fortyAfterA} on the 40-man and must clear a spot.`)
  if (fortyAfterB > 40) notes.push(`The ${b.name} go to ${fortyAfterB} on the 40-man and must clear a spot.`)
  const unpriced = [...a.sends, ...b.sends].filter(unsetSalary).length
  if (unpriced) notes.push(`${unpriced} ${unpriced === 1 ? 'player has' : 'players have'} no set salary yet (arbitration, option or pre-arb), so the payroll line leaves them out.`)

  return {
    payroll: { a: payrollA, b: -payrollA },
    // Players in the deal whose next-season pay is not set yet (arbitration,
    // option, pre-arb). Both clubs' payroll figures leave them out: one sheds
    // that salary and the other takes it on, so the flag goes on both.
    unpriced: { a: unpriced, b: unpriced },
    war: { a: warA, b: -warA },
    control: { aIn: controlIn(b), aOut: controlIn(a) },
    fortyAfter: { a: fortyAfterA, b: fortyAfterB },
    notes,
  }
}

export function money(usd) {
  const m = Math.abs(usd) / 1e6
  return `$${m >= 10 ? m.toFixed(1) : String(Number(m.toFixed(2)))}M`
}

// The roster sort. Each key names the better end first (most WAR, best prospect
// rank, lowest ERA); a player with no value for the key sorts last either way.
const SORTS = {
  war: { get: (p) => p.war, desc: true },
  pay: { get: (p) => p.payUsd, desc: true },
  control: { get: (p) => p.control, desc: true },
  age: { get: (p) => p.age, desc: false },
  prospect: { get: (p) => p.topRank ?? (p.orgRank != null ? 100 + p.orgRank : null), desc: false },
  ops: { get: (p) => (p.line?.ops != null ? Number(p.line.ops) : null), desc: true },
  era: { get: (p) => (p.line?.era != null ? Number(p.line.era) : null), desc: false },
}

export function sortPlayers(players, key) {
  const s = SORTS[key]
  if (!s) return players
  return [...players].sort((a, b) => {
    const x = s.get(a), y = s.get(b)
    if (x == null || Number.isNaN(x)) return y == null || Number.isNaN(y) ? 0 : 1
    if (y == null || Number.isNaN(y)) return -1
    return s.desc ? y - x : x - y
  })
}

// The contract panel's rows from `from` on: the ledger's own years, with the
// gaps a pre-arbitration player's ledger leaves filled in and marked `rough`.
// A blank year before his first arbitration cell is a pre-arb year. Past the
// ledger, his arbitration count carries on (A1, A2, A3, then free agency); a
// ledger with no arbitration years at all is projected from service time
// (arbitration at 3 full years, free agency at 6, every season from the
// ledger's on counted as a full one; Super Two is not modelled).
export function contractYears(contract, from) {
  const cells = contract?.cells ?? []
  const known = new Map(cells.filter((c) => c.year >= from && c.kind !== 'none').map((c) => [c.year, { ...c, rough: false }]))
  const ledgerRows = [...known.values()]
  const service = contract?.service?.years
  const isPreArb = contract?.regime === 'pre_arb' || (contract?.regime == null && service != null && service < 3)
  if (ledgerRows.some((r) => r.kind === 'free') && !isPreArb) return ledgerRows
  if (!isPreArb || service == null) return ledgerRows

  const ledgerSeason = cells[0]?.year ?? from - 1
  const lastKnown = Math.max(0, ...known.keys())
  const rows = []
  let arb = 0
  for (let year = from; year < from + 15; year++) {
    const k = known.get(year)
    if (k) {
      rows.push(k)
      if (k.kind === 'free') break
      if (k.kind === 'arbitration') arb = Number(k.code?.slice(1)) || arb + 1
      continue
    }
    if (year < lastKnown) { rows.push({ year, kind: 'preArb', rough: true }); continue }
    if (arb > 0) {
      arb += 1
      if (arb > 3) { rows.push({ year, kind: 'free', code: 'FA', rough: true }); break }
      rows.push({ year, kind: 'arbitration', code: `A${arb}`, rough: true })
      continue
    }
    // Full seasons banked before `year`. The ledger's service is as of OPENING DAY
    // of its season (Yelich's 12.069 in the 2026 file is 2013's partial year plus
    // 2014-2025), so the ledger season itself counts, as a full year, like every
    // season after it.
    const banked = service + (year - ledgerSeason)
    if (banked >= 6) { rows.push({ year, kind: 'free', code: 'FA', rough: true }); break }
    if (banked >= 3) { arb = banked - 2; rows.push({ year, kind: 'arbitration', code: `A${arb}`, rough: true }) }
    else rows.push({ year, kind: 'preArb', rough: true })
  }
  return rows
}

// One season line across every minor-league level a player reached. Rates are
// rebuilt from the summed counts, never averaged: OPS = (H+BB+HBP)/(AB+BB+HBP+SF)
// + TB/AB, ERA = 27*ER/outs. `parts` are statsapi stat objects, one per level.
const outsOf = (ip) => {
  if (ip == null) return 0
  const [whole, frac = '0'] = String(ip).split('.')
  return Number(whole) * 3 + Number(frac)
}
const rate = (v, digits) => (Number.isFinite(v) ? v.toFixed(digits) : null)

export function combineLines(parts, isPitcher) {
  const sum = (k) => parts.reduce((t, p) => t + (Number(p?.[k]) || 0), 0)
  if (isPitcher) {
    const outs = parts.reduce((t, p) => t + outsOf(p?.inningsPitched), 0)
    if (!outs) return { era: null, ip: null, so: sum('strikeOuts') || null }
    return { era: rate((27 * sum('earnedRuns')) / outs, 2), ip: `${Math.floor(outs / 3)}.${outs % 3}`, so: sum('strikeOuts') }
  }
  const ab = sum('atBats'), onBaseDen = ab + sum('baseOnBalls') + sum('hitByPitch') + sum('sacFlies')
  const obp = onBaseDen ? (sum('hits') + sum('baseOnBalls') + sum('hitByPitch')) / onBaseDen : NaN
  const slg = ab ? sum('totalBases') / ab : NaN
  const ops = rate(obp + slg, 3)
  return { ops: ops?.replace(/^0/, '') ?? null, hr: sum('homeRuns'), pa: sum('plateAppearances') }
}

// Salary the sending club keeps. `retain` maps a player id to { pct } (0-1)
// or { usd }; a side-wide share comes in as `sidePct`. The player then moves
// carrying only the rest of next season's pay, and `retainedUsd` records what
// stayed behind, which dealSummary charges back to the sending club.
export function applyRetain(sends, { retain = {}, sidePct = 0 } = {}) {
  return sends.map((p) => {
    if (p.payUsd == null) return p
    const r = retain[p.id]
    const kept = r?.usd != null ? Math.min(r.usd, p.payUsd) : p.payUsd * (r?.pct ?? sidePct)
    return kept ? { ...p, payUsd: p.payUsd - kept, retainedUsd: kept } : p
  })
}

// The OPS / ERA sort's floor: a big-league line counts as one only with this
// many plate appearances or innings; below it the player sorts as a small sample.
export const LINE_MIN = { pa: 50, ip: 20 }
export function lineIsSmall(line) {
  if (!line) return false
  if (line.pa != null) return Number(line.pa) < LINE_MIN.pa
  if (line.ip != null) return parseFloat(line.ip) < LINE_MIN.ip
  return false
}

// Whose option a contract year is, from Cot's terms ("+27 cl opt", "+28 pl
// opt", "+29 m opt"): club, player or mutual. Null when the terms don't say.
export function optionKind(terms) {
  const t = String(terms ?? '').toLowerCase()
  if (/\bm(ut(ual)?)? opt/.test(t)) return 'Mutual option'
  if (/\bpl(ayer)? opt/.test(t)) return 'Player option'
  if (/\bcl(ub)? opt|\bc opt/.test(t)) return 'Club option'
  return null
}

// Whether a club can send him to the minors. Five years of service gives a
// player the right to refuse; with none of his three option years left he
// must clear waivers first.
export function optionStatus(service, options) {
  if ((service?.years ?? 0) >= 5) return "Can't be sent down without his consent (5+ years of service)"
  if (options?.remaining == null) return null
  if (options.remaining === 0) return 'Out of options: must clear waivers to be sent down'
  return `${options.remaining} option ${options.remaining === 1 ? 'year' : 'years'} left`
}

// The deal as the transaction wire would print it (MLB's own sentence shape,
// e.g. "Chicago White Sox traded 1B Andrew Vaughn to Milwaukee Brewers for RHP
// Aaron Civale and cash."). A pitcher is RHP or LHP by his throwing hand.
const wirePos = (p) => (p.pos === 'P' || p.pos === 'TWP' ? (p.throws === 'L' ? 'LHP' : 'RHP') : p.pos || '')
const listOf = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const sideText = (side) => listOf([...side.sends.map((p) => `${wirePos(p)} ${p.name}`.trim()), ...(side.cashUsd ? ['cash'] : [])])

export function wireSentence(a, b) {
  const gives = sideText(a) || 'future considerations'
  const gets = sideText(b) || 'future considerations'
  return `${a.club} traded ${gives} to ${b.club} for ${gets}.`
}
