import { contractView } from '../../../../../api/person/contract/view.js'
import { contractRowView, shortMoney } from '../../../../../api/person/contract/history.js'

// The Contract card's board (#1929), pure: a contract record and the salary rows in, the
// card's parts out. The record's regime, runway segments and pay rank are decided in
// api/person/contract/view.js; the salary rows in api/person/contract/history.js. This
// file only arranges them in the board's order. Money is history.js's form ($11.75M).

// The strip's kinds: contractView's names mapped to the board's five, plus a neutral one.
const KIND = { preArb: 'preArb', arb: 'arb', guaranteed: 'deal', option: 'option', freeAgency: 'fa' }
const LABEL = {
  preArb: 'Club sets pay', arb: 'Arbitration', deal: 'Signed deal', option: 'Option years',
  fa: 'Free agency', other: 'Other',
}
const PILL = { preArb: 'Club sets pay', arbYear: 'Arbitration', signed: 'Signed' }
// The sheet's own regime, for a record contractView calls plain (a last arbitration year).
const PLAIN_PILL = { arbitration: 'Arbitration', free_agency: 'Free agency', pre_arb: 'Club sets pay', signed: 'Signed' }

// 2020 rows hold the contracted salary; the 60-game season paid about 37% of it
// (docs/contracts-data-caveats.md). The bar is drawn, flagged, and left out of the total.
const LEFT_OUT = 2020

const tick = (year) => `’${String(year).slice(-2)}`

function column(seg, record) {
  const kind = KIND[seg.kind] ?? 'other'
  const merged = seg.endYear !== seg.startYear
  const cash = record.outYears?.find((y) => y.year === seg.startYear)?.cash
  const arbN = /^A(\d+)/i.exec(record.terms ?? '')?.[1]
  const status = {
    preArb: 'Club sets pay',
    fa: 'FA eligible',
    arb: seg.current ? (arbN ? `Arb ${arbN}` : 'Arbitration') : seg.detail,
    deal: seg.current ? 'Signed' : merged ? seg.detail : '',
  }[kind] ?? seg.detail ?? ''
  const money = seg.current ? record.salaryUsd : kind === 'deal' && !merged ? cash : null
  return {
    year: seg.label, kind, status, money: shortMoney(money) ?? '', now: Boolean(seg.current),
  }
}

function strip(view, record) {
  if (view.segments.length < 2) return null
  const cols = view.segments.map((seg) => column(seg, record))
  return {
    cols,
    legend: [...new Set(cols.map((c) => c.kind))].map((kind) => ({ kind, label: LABEL[kind] })),
    aria: `Contract by season: ${cols.map((c) => [c.year, c.status, c.money].filter(Boolean).join(' ')).join(', ')}`,
  }
}

function rank(payRank) {
  if (![payRank?.rank, payRank?.of, payRank?.fractionBelow].every(Number.isFinite)) return null
  const frac = payRank.fractionBelow
  return {
    text: `${payRank.tied ? 'Tied ' : ''}${payRank.rank} of ${payRank.of} · ${payRank.pos}`,
    frac,
    tagLeft: Math.min(84, Math.max(16, frac * 100)),
    aria: `Pay rank ${payRank.rank} of ${payRank.of} among ${payRank.pos}`,
  }
}

// One bar per year from his first salary row to his last; a year with a row but no figure
// is a gap, drawn flat and dashed.
function past(rows, beforeYear) {
  const byYear = new Map()
  for (const row of rows) {
    const r = contractRowView(row)
    if (r.kind !== 'salary' || r.season == null || r.season >= beforeYear) continue
    if (byYear.get(r.season) == null) byYear.set(r.season, r.amount)
  }
  const years = [...byYear.keys()]
  // Nothing counts when every figure is missing or only 2020's.
  if (![...byYear].some(([y, v]) => v != null && y !== LEFT_OUT)) return null
  const y0 = Math.min(...years)
  const y1 = Math.max(...years)
  const peak = Math.max(...[...byYear.values()].filter((v) => v != null))
  const span = y1 - y0 + 1
  const step = span > 12 ? 4 : span > 6 ? 2 : 1
  const bars = []
  for (let y = y0; y <= y1; y++) {
    const amount = byYear.get(y) ?? null
    bars.push({
      year: y,
      amount,
      kind: amount == null ? 'gap' : y === LEFT_OUT ? 'left' : 'paid',
      pct: amount == null ? 0 : Math.max(3, Math.round((amount / peak) * 100)),
      tick: (y - y0) % step === 0 ? tick(y) : '',
      money: span <= 6 && amount != null ? shortMoney(amount) : '',
    })
  }
  const counted = bars.filter((b) => b.kind === 'paid')
  const first = counted[0]?.year
  const last = counted.at(-1)?.year
  const range = first === last ? first : `${first}–${last}`
  return {
    bars,
    total: shortMoney(counted.reduce((sum, b) => sum + b.amount, 0)),
    seasons: counted.length,
    left: bars.some((b) => b.kind === 'left'),
    gap: bars.some((b) => b.kind === 'gap'),
    unconfirmed: rows.some((row) => row.confidence === 'fuzzy'),
    label: beforeYear === Infinity ? `Known salaries, ${range}` : `Paid before ${beforeYear}`,
    aria: `Salary by season ${y0} to ${y1}: ${bars.map((b) => `${b.year} ${b.amount == null ? 'no figure' : shortMoney(b.amount)}`).join(', ')}`,
  }
}

export function contractBoard(record, rows = []) {
  const hist = past(rows, record?.season ?? Infinity)
  if (!record) {
    return hist && {
      pill: `${hist.seasons} ${hist.seasons === 1 ? 'season' : 'seasons'}`,
      salary: null, rank: null, tiles: [], strip: null, past: hist,
    }
  }
  const view = contractView(record)
  const signed = view.regime === 'signed' || view.regime === 'plain'
  return {
    pill: PILL[view.regime] ?? PLAIN_PILL[record.regime] ?? 'Contract',
    season: record.season,
    salary: shortMoney(record.salaryUsd),
    rank: rank(view.payRank),
    tiles: signed
      ? [['Guaranteed', shortMoney(record.contractTotalUsd)], ['AAV', shortMoney(record.aavUsd)]].filter((t) => t[1])
      : [],
    strip: strip(view, record),
    past: hist,
  }
}
