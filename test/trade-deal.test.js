// The trade card's arithmetic (src/lib/trade/deal.js), on ledger rows shaped
// like public/data/team-contracts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextYearPay, controlYears, tradePlayer, dealSummary, money, sortPlayers, contractYears, combineLines, applyRetain, lineIsSmall, optionKind, optionStatus, wireSentence } from '../src/lib/trade/deal.js'

const cells = (...kinds) => kinds.map(([kind, extra], i) => ({ year: 2026 + i, kind, ...extra }))
const signed = { regime: 'signed', cells: cells(['salary', { value: 24e6 }], ['guaranteed', { value: 23.9e6 }], ['guaranteed', { value: 23.8e6 }], ['none']) }
const arb = { regime: 'arbitration', cells: cells(['salary', { value: 7.6e6 }], ['arbitration', { code: 'A3' }], ['free', { code: 'FA' }]) }
const preArbBlank = { regime: 'pre_arb', service: { years: 0 }, cells: cells(['salary', { value: 0.78e6 }], ['none'], ['none']) }

test('next year pay is a number only when it is guaranteed', () => {
  assert.deepEqual(nextYearPay(signed.cells, 2027), { usd: 23.9e6, label: null })
  assert.deepEqual(nextYearPay(arb.cells, 2027), { usd: null, label: 'Arb 3' })
  assert.deepEqual(nextYearPay(preArbBlank.cells, 2027, 'pre_arb'), { usd: null, label: 'Pre-arb' })
  // A blank year on a signed or arbitration player is not pre-arb: it says nothing.
  assert.deepEqual(nextYearPay(preArbBlank.cells, 2027, 'signed'), { usd: null, label: null })
})

test('control counts ledger years, and falls back to service time for a blank pre-arb', () => {
  assert.deepEqual(controlYears(signed, 2027), { years: 2, thru: 2028, rough: false })
  assert.deepEqual(controlYears(arb, 2027), { years: 1, thru: 2027, rough: false })
  assert.deepEqual(controlYears(preArbBlank, 2027), { years: 5, thru: 2031, rough: true })
  assert.deepEqual(controlYears(null, 2027), { years: null, thru: null, rough: false })
})

test('a deal moves payroll, WAR, control and 40-man spots both ways', () => {
  const opts = { nextYear: 2027 }
  const star = tradePlayer({ id: 1, name: 'Star', position: 'SP' }, { ...opts, ledger: signed, war: 3.4 })
  const kid = tradePlayer({ id: 2, name: 'Kid', position: 'SS', onForty: false }, { ...opts, ledger: preArbBlank, war: null })
  const bat = tradePlayer({ id: 3, name: 'Bat', position: '1B' }, { ...opts, ledger: arb, war: 1.2 })
  const d = dealSummary(
    { name: 'Brewers', fortyCount: 40, sends: [star, kid], cashUsd: 0 },
    { name: 'Red Sox', fortyCount: 40, sends: [bat], cashUsd: 2e6 },
  )
  // Brewers shed 23.9M, take in an unpriced arb year, and get 2M in cash.
  assert.equal(d.payroll.a, -23.9e6 - 2e6)
  assert.equal(d.payroll.b, 23.9e6 + 2e6)
  assert.equal(Math.round(d.war.a * 10) / 10, -2.2)
  // Star's 2 signed years plus Kid's 5 projected (2026 counts as served).
  assert.deepEqual(d.control, { aIn: 1, aOut: 7 })
  // The kid is off the 40-man, so only one spot moves each way.
  assert.deepEqual(d.fortyAfter, { a: 40, b: 40 })
  // Bat's arb year and Kid's pre-arb year (he has a contract on file) have no set pay.
  assert.deepEqual(d.unpriced, { a: 2, b: 2 })
  // A minor leaguer off the 40-man with no contract on file draws no MLB salary: not a TBD.
  const farmhand = tradePlayer({ id: 4, name: 'Farmhand', position: 'SS', onForty: false }, { nextYear: 2027 })
  const d2 = dealSummary({ name: 'Brewers', fortyCount: 40, sends: [farmhand], cashUsd: 0 }, { name: 'Red Sox', fortyCount: 40, sends: [], cashUsd: 0 })
  assert.deepEqual(d2.unpriced, { a: 0, b: 0 })
  assert.ok(!d2.notes.some((n) => n.includes('no set salary')))
  assert.ok(d.notes.some((n) => n.startsWith('Kid is not on the 40-man')))
  assert.ok(d.notes.some((n) => n.includes('Red Sox send $2M')))
  assert.ok(d.notes.some((n) => n.includes('2 players have no set salary')))
})

test('a side over 40 is told to clear a spot', () => {
  const p = tradePlayer({ id: 9, name: 'Arm', position: 'RP' }, { nextYear: 2027, ledger: arb })
  const d = dealSummary({ name: 'Cubs', fortyCount: 40, sends: [], cashUsd: 0 }, { name: 'Mets', fortyCount: 39, sends: [p], cashUsd: 0 })
  assert.equal(d.fortyAfter.a, 41)
  assert.ok(d.notes.includes('The Cubs go to 41 on the 40-man and must clear a spot.'))
})

test('money reads like the rest of the site', () => {
  assert.equal(money(23.9e6), '$23.9M')
  assert.equal(money(2e6), '$2M')
  assert.equal(money(2.5e6), '$2.5M')
})

test('the roster sort puts the better end first and blanks last', () => {
  const rows = [
    { id: 1, war: 1.2, line: { era: '3.10' }, topRank: null, orgRank: 5 },
    { id: 2, war: null, line: { era: '2.05' }, topRank: 40, orgRank: 1 },
    { id: 3, war: 3.4, line: null, topRank: null, orgRank: null },
  ]
  assert.deepEqual(sortPlayers(rows, 'war').map((r) => r.id), [3, 1, 2])
  assert.deepEqual(sortPlayers(rows, 'era').map((r) => r.id), [2, 1, 3])
  // A Top-100 rank outranks any org-only rank.
  assert.deepEqual(sortPlayers(rows, 'prospect').map((r) => r.id), [2, 1, 3])
})

test('a pre-arb ledger that stops early projects pre-arb, arbitration, then free agency', () => {
  // Logan Henderson's 2026 ledger row: 0.075 going INTO 2026, nothing after it.
  // A full 2026 puts him at 1 year banked before 2027.
  const henderson = { regime: 'pre_arb', service: { years: 0, days: 75 }, cells: cells(['salary', { value: 0.66e6 }], ['none'], ['none'], ['none'], ['none']) }
  const rows = contractYears(henderson, 2027)
  assert.deepEqual(rows.map((r) => `${r.year}:${r.code ?? r.kind}`), [
    '2027:preArb', '2028:preArb', '2029:A1', '2030:A2', '2031:A3', '2032:FA',
  ])
  assert.ok(rows.every((r) => r.rough))
  // A ledger that already reaches free agency is left as it is.
  assert.deepEqual(contractYears(arb, 2027).map((r) => r.code), ['A3', 'FA'])
})

test('a blank year before arbitration is pre-arb, and the count carries past the ledger', () => {
  // Abner Uribe's 2026 ledger row: 2027 blank, then A1-A3, and no free-agent year.
  const uribe = { regime: 'pre_arb', service: { years: 1, days: 121 }, cells: cells(['salary', { value: 0.8e6 }], ['none'], ['arbitration', { code: 'A1' }], ['arbitration', { code: 'A2' }], ['arbitration', { code: 'A3' }]) }
  assert.deepEqual(contractYears(uribe, 2027).map((r) => `${r.year}:${r.code ?? r.kind}${r.rough ? '~' : ''}`), [
    '2027:preArb~', '2028:A1', '2029:A2', '2030:A3', '2031:FA~',
  ])
  // The row says the same thing the panel does.
  assert.deepEqual(controlYears(uribe, 2027), { years: 4, thru: 2030, rough: true })
})

test('a minor-league line across two levels rebuilds its rates from the summed counts', () => {
  const aPlus = { atBats: 100, hits: 30, baseOnBalls: 10, hitByPitch: 0, sacFlies: 0, totalBases: 50, homeRuns: 4, plateAppearances: 110 }
  const aa = { atBats: 300, hits: 75, baseOnBalls: 30, hitByPitch: 0, sacFlies: 0, totalBases: 120, homeRuns: 10, plateAppearances: 330 }
  // OBP (105+40)/440 = .3295, SLG 170/400 = .425 -> .755; averaging the two OPS would give .787.
  assert.deepEqual(combineLines([aPlus, aa], false), { ops: '.755', hr: 14, pa: 440 })
  // 10.1 IP is 31 outs; 20.2 IP is 62. 93 outs, 9 ER -> 27*9/93 = 2.61.
  const p = combineLines([{ inningsPitched: '10.1', earnedRuns: 3, strikeOuts: 12 }, { inningsPitched: '20.2', earnedRuns: 6, strikeOuts: 20 }], true)
  assert.deepEqual(p, { era: '2.61', ip: '31.0', so: 32 })
})

test('retained salary stays with the sending club', () => {
  const crochet = { id: 7, name: 'Crochet', payUsd: 28.7e6, war: 0.3, control: 4, onForty: true }
  const vaughn = { id: 3, name: 'Vaughn', payUsd: null, payLabel: 'Arb 3', war: 1.3, control: 1, onForty: true }
  // Half of Crochet, by percent; then $10M by dollars; then a side-wide 25%.
  assert.equal(applyRetain([crochet], { retain: { 7: { pct: 0.5 } } })[0].payUsd, 14.35e6)
  assert.equal(applyRetain([crochet], { retain: { 7: { usd: 10e6 } } })[0].retainedUsd, 10e6)
  assert.equal(applyRetain([crochet, vaughn], { sidePct: 0.25 })[1].retainedUsd, undefined)
  const sends = applyRetain([crochet], { retain: { 7: { pct: 0.5 } } })
  const d = dealSummary({ name: 'Brewers', fortyCount: 40, sends: [], cashUsd: 0 }, { name: 'Red Sox', fortyCount: 40, sends, cashUsd: 0 })
  // Milwaukee takes on only half; Boston sheds only half.
  assert.equal(d.payroll.a, 14.35e6)
  assert.ok(d.notes.includes("The Red Sox keep $14.3M of Crochet's salary."))
})

test('a big-league line under 50 PA or 20 IP is a small sample', () => {
  assert.equal(lineIsSmall({ ops: '.500', pa: 14 }), true)
  assert.equal(lineIsSmall({ ops: '.834', pa: 500 }), false)
  assert.equal(lineIsSmall({ era: '5.30', ip: '18.2' }), true)
  assert.equal(lineIsSmall(null), false)
})

test('option type reads from the terms, and option status from service and options', () => {
  assert.equal(optionKind('1 y/$9.4M (26)+27 cl opt'), 'Club option')
  assert.equal(optionKind('9 y/$215M (20-28)+29 m opt*'), 'Mutual option')
  assert.equal(optionKind('3 y/$30M (25-27)+28 pl opt'), 'Player option')
  assert.equal(optionKind('1 y/$4.15M (26)'), null)
  assert.match(optionStatus({ years: 12 }, { remaining: 3 }), /consent/)
  assert.match(optionStatus({ years: 3 }, { remaining: 0 }), /Out of options/)
  assert.equal(optionStatus({ years: 2 }, { remaining: 1 }), '1 option year left')
})

test('the deal reads like the transaction wire', () => {
  const vaughn = { name: 'Andrew Vaughn', pos: '1B' }
  const civale = { name: 'Aaron Civale', pos: 'P', throws: 'R' }
  const ashby = { name: 'Aaron Ashby', pos: 'P', throws: 'L' }
  // MLB's own wording for 2025-06-13, rebuilt from the pieces.
  assert.equal(
    wireSentence({ club: 'Chicago White Sox', sends: [vaughn], cashUsd: 0 }, { club: 'Milwaukee Brewers', sends: [civale], cashUsd: 1e6 }),
    'Chicago White Sox traded 1B Andrew Vaughn to Milwaukee Brewers for RHP Aaron Civale and cash.',
  )
  assert.equal(
    wireSentence({ club: 'Milwaukee Brewers', sends: [vaughn, civale, ashby], cashUsd: 0 }, { club: 'Boston Red Sox', sends: [], cashUsd: 0 }),
    'Milwaukee Brewers traded 1B Andrew Vaughn, RHP Aaron Civale and LHP Aaron Ashby to Boston Red Sox for future considerations.',
  )
})
