import assert from 'node:assert/strict'
import test from 'node:test'
import { contractView } from '../src/api/person/contract/view.js'

// The three anchors are REAL records, copied from the nightly shards
// (public/data/player-contracts/{17,88,92}.json) so the view is asserted
// against the shapes Cot's actually publishes, not a tidied idea of them.
// The rest are synthetic, each pinned on one rule the card must not break.

// pre-arb: 17.json — arbitration years and a free-agency year ahead of him.
const PRE_ARB = {
  playerId: 686217,
  name: 'Sal Frelick',
  season: 2026,
  club: 'Milwaukee Brewers',
  clubAbbrev: 'MIL',
  salaryUsd: 800600,
  cbtUsd: 800600,
  contractTotalUsd: 800600,
  aavUsd: 800600,
  estimated: true,
  terms: '1 y/$800,600 (26)',
  outYears: [
    { year: 2027, cash: 'A1', cbt: null },
    { year: 2028, cash: 'A2', cbt: null },
    { year: 2029, cash: 'A3', cbt: null },
    { year: 2030, cash: 'FA', cbt: null },
  ],
  service: { years: 2, days: 72, approximate: false },
  regime: 'pre_arb',
  regimeFlag: null,
  options: { remaining: 3, total: 3 },
  agent: null,
  payRank: { pos: 'OF', rank: 85, of: 216, tied: false, onMinimum: false, fractionBelow: 0.6093 },
}

// one year plus a club option: 88.json — the record whose regime reads
// "unknown" and whose out-years stop at the option and the free-agency year.
const ARB_OPTION = {
  playerId: 661388,
  name: 'William Contreras',
  season: 2026,
  club: 'Milwaukee Brewers',
  clubAbbrev: 'MIL',
  salaryUsd: 9400000,
  cbtUsd: 9400000,
  contractTotalUsd: 9400000,
  aavUsd: 9400000,
  estimated: false,
  terms: '1 y/$9.4M (26)+27 cl opt',
  outYears: [
    { year: 2027, cash: 'OPT', cbt: 'OPT' },
    { year: 2028, cash: 'FA', cbt: null },
  ],
  service: { years: 4, days: 112, approximate: false },
  regime: 'unknown',
  regimeFlag: null,
  options: { remaining: 2, total: 3 },
  agent: 'Octagon',
  payRank: { pos: 'C', rank: 5, of: 93, tied: false, onMinimum: false, fractionBelow: 0.9565 },
}

// signed: 92.json — eight guaranteed years, four of them still out, and two
// option years that live only in the free text.
const SIGNED = {
  playerId: 694192,
  name: 'Jackson Chourio',
  season: 2026,
  club: 'Milwaukee Brewers',
  clubAbbrev: 'MIL',
  salaryUsd: 7250000,
  cbtUsd: 10250000,
  contractTotalUsd: 82000000,
  aavUsd: 10250000,
  estimated: false,
  terms: '8 y/$82M (24-31)+32-33 opts',
  outYears: [
    { year: 2027, cash: 8250000, cbt: 10250000 },
    { year: 2028, cash: 9250000, cbt: 10250000 },
    { year: 2029, cash: 15250000, cbt: 10250000 },
    { year: 2030, cash: 16250000, cbt: 10250000 },
  ],
  service: { years: 2, days: 0, approximate: false },
  regime: 'signed',
  regimeFlag: null,
  options: { remaining: 3, total: 3 },
  agent: 'Beverly Hills SC (Cesar Suarez)',
  payRank: { pos: 'OF', rank: 28, of: 216, tied: false, onMinimum: false, fractionBelow: 0.8744 },
}

// Super Two: arbitration starts a year early and runs FOUR times. Nothing in
// the view may key on "three years of service" or "six" — the codes say it.
const SUPER_TWO = {
  playerId: 111111,
  name: 'Super Two',
  season: 2026,
  club: 'Milwaukee Brewers',
  salaryUsd: 780000,
  contractTotalUsd: 780000,
  estimated: true,
  terms: '1 y/$780,000 (26)',
  outYears: [
    { year: 2027, cash: 'A1', cbt: null },
    { year: 2028, cash: 'A2', cbt: null },
    { year: 2029, cash: 'A3', cbt: null },
    { year: 2030, cash: 'A4', cbt: null },
    { year: 2031, cash: 'FA', cbt: null },
  ],
  service: { years: 2, days: 130, approximate: false },
  regime: 'pre_arb',
  options: { remaining: 2, total: 3 },
  payRank: { pos: '2B', rank: 40, of: 60, tied: true, onMinimum: true, fractionBelow: 0 },
}

function record(overrides) {
  return { ...ARB_OPTION, ...overrides }
}

// ---------------------------------------------------------------------------
// Regime classification
// ---------------------------------------------------------------------------

test('the decision table routes each record to its own card', () => {
  assert.equal(contractView(PRE_ARB).regime, 'preArb')
  assert.equal(contractView(SUPER_TWO).regime, 'preArb')
  assert.equal(contractView(ARB_OPTION).regime, 'arbYear')
  assert.equal(contractView(SIGNED).regime, 'signed')
  // A one-year deal for an arbitration player: A-codes ahead, so the runway
  // leads even though the sheet calls the regime "arbitration".
  assert.equal(
    contractView(record({
      regime: 'arbitration',
      terms: '1 y/$5M (26)',
      outYears: [{ year: 2027, cash: 'A3', cbt: null }, { year: 2028, cash: 'FA', cbt: null }],
    })).regime,
    'arbYear',
  )
  // Anything the table cannot place keeps today's rendering.
  assert.equal(
    contractView(record({ regime: 'free_agency', terms: '1 y/$5M (26)', outYears: [] })).regime,
    'plain',
  )
  // A signed record whose terms are one year is not a multi-year deal.
  assert.equal(
    contractView(record({ regime: 'signed', terms: '1 y/$5M (26)', outYears: [] })).regime,
    'plain',
  )
  assert.equal(contractView(null), null)
  assert.equal(contractView(undefined), null)
})

// ---------------------------------------------------------------------------
// The arbitration and free-agency years come from the CODES, never from 3 and 6
// ---------------------------------------------------------------------------

test('the first arbitration year and the free-agency year read off the out-year codes', () => {
  const view = contractView(PRE_ARB)
  assert.equal(view.firstArbYear, 2027)
  assert.equal(view.faYear, 2030)
  assert.equal(view.controlThrough, 2029)
})

test('a Super Two runway is four arbitration years, derived not assumed', () => {
  const view = contractView(SUPER_TWO)
  // 2.130 of service: a service-time constant would put arbitration in 2028
  // and free agency after 2031. The codes say 2027 and 2030.
  assert.equal(view.firstArbYear, 2027)
  assert.equal(view.faYear, 2031)
  assert.equal(view.controlThrough, 2030)
  assert.equal(view.segments.filter((s) => s.kind === 'arb').length, 4)
  assert.match(view.sentence, /From 2027 arbitration raises it each winter/)
  assert.match(view.sentence, /free agency after the 2030 season/)
})

test('a record with no out-years claims no arbitration year and no free agency', () => {
  const view = contractView(record({ regime: 'pre_arb', terms: '1 y/$780,000 (26)', outYears: [] }))
  assert.equal(view.regime, 'preArb')
  assert.equal(view.firstArbYear, null)
  assert.equal(view.faYear, null)
  assert.equal(view.controlThrough, null)
  assert.equal(view.sentence, 'The Milwaukee Brewers set his salary for now.')
  assert.doesNotMatch(view.sentence, /arbitration|free agency/)
  // The current season still has a segment; nothing else can be drawn.
  assert.deepEqual(view.segments.map((s) => s.startYear), [2026])
})

// ---------------------------------------------------------------------------
// Option labels — the OPT code does not say who holds the option
// ---------------------------------------------------------------------------

test('terms reading "cl opt" label the year a club option', () => {
  const view = contractView(ARB_OPTION)
  const option = view.segments.find((s) => s.kind === 'option')
  assert.equal(option.startYear, 2027)
  assert.equal(option.detail, 'Club option')
  assert.match(view.sentence, /hold a club option for 2027/)
})

test('terms reading "pl opt" label the year a player option', () => {
  const view = contractView(record({ terms: '1 y/$9.4M (26)+27 pl opt' }))
  assert.equal(view.segments.find((s) => s.kind === 'option').detail, 'Player option')
  assert.match(view.sentence, /hold a player option for 2027/)
})

test('an OPT code the terms do not explain says only that it is an option year', () => {
  const view = contractView(record({ terms: '1 y/$9.4M (26)' }))
  assert.equal(view.segments.find((s) => s.kind === 'option').detail, 'Option year')
  assert.doesNotMatch(view.sentence, /club option|player option/)
  assert.match(view.sentence, /hold an option for 2027/)
})

// ---------------------------------------------------------------------------
// The CBA rule the card must never break
// ---------------------------------------------------------------------------

test('a declined option under six years of service leads to arbitration', () => {
  const view = contractView(ARB_OPTION)
  assert.match(view.sentence, /arbitration/)
  assert.match(view.sentence, /his 2027 pay is set by arbitration instead/)
  // He carries an FA code, so free agency may be named — and only as the year
  // the code gives, never as what a declined option leads to.
  assert.match(view.sentence, /free agency after the 2027 season/)
  assert.doesNotMatch(view.sentence, /declined[^.]*free agency/)
})

test('an option with no FA code never claims free agency', () => {
  const view = contractView(record({ outYears: [{ year: 2027, cash: 'OPT', cbt: 'OPT' }] }))
  assert.equal(view.faYear, null)
  assert.doesNotMatch(view.sentence, /free agency|free agent/)
  assert.match(view.sentence, /arbitration/)
})

test('a veteran past six years is not told his declined option becomes arbitration', () => {
  const view = contractView(record({
    service: { years: 8, days: 12, approximate: false },
    terms: '1 y/$9.4M (26)+27 cl opt',
    outYears: [{ year: 2027, cash: 'OPT', cbt: 'OPT' }],
  }))
  assert.doesNotMatch(view.sentence, /arbitration/)
  assert.doesNotMatch(view.sentence, /free agency|free agent/)
  assert.match(view.sentence, /not under contract for 2027/)
})

test('an out-year arbitration code outranks the service reading', () => {
  // Cot's own out-years say arbitration for 2028, so the fallback holds even
  // though the service line reads past six years.
  const view = contractView(record({
    service: { years: 6, days: 100, approximate: false },
    outYears: [
      { year: 2027, cash: 'OPT', cbt: 'OPT' },
      { year: 2028, cash: 'A3', cbt: null },
      { year: 2029, cash: 'FA', cbt: null },
    ],
  }))
  assert.match(view.sentence, /his 2027 pay is set by arbitration instead/)
})

// ---------------------------------------------------------------------------
// The runway
// ---------------------------------------------------------------------------

test('consecutive pre-arbitration years compress into one segment', () => {
  const view = contractView(record({
    regime: 'pre_arb',
    terms: '1 y/$780,000 (26)',
    outYears: [
      { year: 2029, cash: 'A1', cbt: null },
      { year: 2030, cash: 'A2', cbt: null },
      { year: 2031, cash: 'A3', cbt: null },
      { year: 2032, cash: 'FA', cbt: null },
    ],
  }))
  const compressed = view.segments.filter((s) => s.kind === 'preArb' && !s.current)
  assert.equal(compressed.length, 1)
  assert.equal(compressed[0].startYear, 2027)
  assert.equal(compressed[0].endYear, 2028)
  assert.equal(compressed[0].label, "’27–’28")
})

test('the runway never grows past what the column can hold', () => {
  const view = contractView(record({
    regime: 'pre_arb',
    outYears: [
      { year: 2027, cash: 'A1', cbt: null },
      { year: 2028, cash: 'A2', cbt: null },
      { year: 2029, cash: 'A3', cbt: null },
      { year: 2030, cash: 'A4', cbt: null },
      { year: 2031, cash: 'OPT', cbt: 'OPT' },
      { year: 2032, cash: 'OPT', cbt: 'OPT' },
      { year: 2033, cash: 'FA', cbt: null },
    ],
  }))
  assert.ok(view.segments.length <= 6, `${view.segments.length} segments is too many`)
  // The last year still reaches the end of the strip.
  assert.equal(view.segments.at(-1).endYear, 2033)
})

// ---------------------------------------------------------------------------
// Pay rank
// ---------------------------------------------------------------------------

test('a pre-arbitration pay rank is suppressed and the arb and signed ones are not', () => {
  assert.equal(contractView(PRE_ARB).payRank, null)
  assert.equal(contractView(SUPER_TWO).payRank, null)
  assert.equal(contractView(ARB_OPTION).payRank.rank, 5)
  assert.equal(contractView(SIGNED).payRank.rank, 28)
})

test('the league-minimum foot line only says what the pay rank supports', () => {
  assert.match(contractView(SUPER_TWO).footnote, /league minimum/)
  assert.match(contractView(PRE_ARB).footnote, /Above the league minimum/)
  assert.equal(contractView(record({ regime: 'pre_arb', payRank: null })).footnote, null)
})

// ---------------------------------------------------------------------------
// The signed deal's schedule
// ---------------------------------------------------------------------------

test('a signed deal leads with the guaranteed money', () => {
  const view = contractView(SIGNED)
  assert.equal(view.guaranteed.years, 8)
  assert.equal(view.guaranteed.throughYear, 2031)
  assert.equal(view.sentence, 'Signed through 2031 — 8 years, $82M. It also carries options for 2032 and 2033.')
})

test('the salary schedule draws a bar only for a year the shard prices in cash', () => {
  const view = contractView(SIGNED)
  assert.deepEqual(view.schedule.bars.map((b) => b.year), [2026, 2027, 2028, 2029, 2030])
  assert.deepEqual(view.schedule.bars.map((b) => b.salaryUsd), [7250000, 8250000, 9250000, 15250000, 16250000])
  // The option years live in the free text only, and carry no cash figure.
  assert.deepEqual(view.schedule.openYears, [2032, 2033])
})

test('an option year inside the out-years is an open zone, never a bar', () => {
  const view = contractView(record({
    regime: 'signed',
    terms: '3 y/$60M (25-27)+28 cl opt',
    contractTotalUsd: 60000000,
    outYears: [
      { year: 2027, cash: 20000000, cbt: 20000000 },
      { year: 2028, cash: 'OPT', cbt: 'OPT' },
    ],
  }))
  assert.equal(view.regime, 'signed')
  assert.deepEqual(view.schedule.bars.map((b) => b.year), [2026, 2027])
  assert.deepEqual(view.schedule.openYears, [2028])
  assert.ok(view.schedule.bars.every((b) => Number.isFinite(b.salaryUsd)))
  assert.match(view.sentence, /It also carries a club option for 2028\./)
})

// ---------------------------------------------------------------------------
// The ticker
// ---------------------------------------------------------------------------

test('a pre-arbitration ticker carries this year, service and options', () => {
  const view = contractView(PRE_ARB)
  assert.deepEqual(view.facts.map((f) => f.label), ['This year', 'MLB service', 'Minor-lg options'])
  const [salary, service, options] = view.facts
  assert.equal(salary.kind, 'money')
  assert.equal(salary.value, 800600)
  assert.equal(salary.tag, 'Est.')
  assert.equal(service.value, '2 yr 72 d')
  assert.equal(service.caption, 'entering 2026')
  assert.equal(options.value, '3 of 3')
})

test('an arbitration ticker adds the agent and the terms', () => {
  const labels = contractView(ARB_OPTION).facts.map((f) => f.label)
  assert.ok(labels.includes('Agent'))
  assert.ok(labels.includes('Terms'))
})

test('a fact with no data is left out rather than dashed', () => {
  const view = contractView(record({ regime: 'pre_arb', options: null, service: {} }))
  assert.deepEqual(view.facts.map((f) => f.label), ['This year'])
})
