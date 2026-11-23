// The trade simulator's value model (src/lib/trade/value.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { salaryText, money } from '../src/lib/trade/deal.js'
import { marcel, playerValue, prospectValue, gradeOf, verdictOf, VALUE } from '../src/lib/trade/value.js'

test('the projection weights recent seasons 5/4/3 and regresses toward the mean', () => {
  // (5*6 + 4*4 + 3*2 + 2*1) / (5+4+3+2) = 54/14
  assert.equal(marcel({ 2026: 6, 2025: 4, 2024: 2 }, 2026).toFixed(3), (54 / 14).toFixed(3))
  // One season counts less, so it lands nearer the mean: (5*6 + 2*1) / 7.
  assert.equal(marcel({ 2026: 6 }, 2026).toFixed(3), (32 / 7).toFixed(3))
  assert.equal(marcel({}, 2026), null)
})

test('with playing time, the projection is a regressed rate times next season\'s playing time', () => {
  // A 2026 breakout after two part-time years (the Jake Bauers line).
  const war = { 2026: 3.6, 2025: 0.8, 2024: 0.1 }
  const pa = { 2026: 578, 2025: 218, 2024: 346 }
  const rate = (5 * 3.6 + 4 * 0.8 + 3 * 0.1 + 1200 * (2 / 600)) / (5 * 578 + 4 * 218 + 3 * 346 + 1200)
  const next = 0.5 * 578 + 0.1 * 218 + 200
  assert.equal(marcel(war, 2026, pa).toFixed(3), (rate * next).toFixed(3))
  // He keeps more of the breakout than the flat-mean version gave him.
  assert.ok(marcel(war, 2026, pa) > marcel(war, 2026))
  // A reliever's floor is 100 batters faced, not 200.
  assert.ok(marcel(war, 2026, pa, 'rp') < marcel(war, 2026, pa))
})

test('a starter\'s playing-time floor is 250 batters faced, a reliever\'s 100', () => {
  // Payton Tolle: 4.1 WAR in 603 BF (2026) after -0.2 in 74 (2025).
  const war = { 2026: 4.1, 2025: -0.2 }
  const bf = { 2026: 603, 2025: 74 }
  const rate = (5 * 4.1 + 4 * -0.2 + 1200 * (2 / 600)) / (5 * 603 + 4 * 74 + 1200)
  assert.equal(marcel(war, 2026, bf, 'sp').toFixed(3), (rate * (0.5 * 603 + 0.1 * 74 + 250)).toFixed(3))
  assert.equal(marcel(war, 2026, bf, 'rp').toFixed(3), (rate * (0.5 * 603 + 0.1 * 74 + 100)).toFixed(3))
})

test('a season with no playing time on file falls back to the flat-mean version', () => {
  const war = { 2026: 3, 2025: 2 }
  assert.equal(marcel(war, 2026, { 2026: 600 }), marcel(war, 2026))
})

test('aging steepens from 35: -0.5 a year at 30-34, -0.75 from 35', () => {
  const flat = { 2026: 3, 2025: 3, 2024: 3 }
  const at = (age) => playerValue(star({ age, warByYear: flat }), { nextYear: 2027, warSeason: 2026 }).projWar
  const base = (5 * 3 + 4 * 3 + 3 * 3 + 2) / 14
  assert.equal(at(34).toFixed(3), (base - 0.5).toFixed(3))
  assert.equal(at(35).toFixed(3), (base - 0.75).toFixed(3))
})

const star = (over = {}) => ({
  age: 26,
  onForty: true,
  warByYear: { 2026: 5, 2025: 5, 2024: 5 },
  contract: { regime: 'signed', service: { years: 4 }, cells: [{ year: 2026, kind: 'salary', value: 10e6 }, { year: 2027, kind: 'salary', value: 10e6 }, { year: 2028, kind: 'free' }] },
  ...over,
})

test('surplus is projected value less salary over the years of control', () => {
  const v = playerValue(star(), { nextYear: 2027, warSeason: 2026 })
  // One controlled year: (25+20+15+2)/14 = 4.43 WAR, plus 0.3 for a 26-year-old.
  assert.equal(v.years.length, 1)
  assert.equal(v.projWar.toFixed(2), (62 / 14 + 0.3).toFixed(2))
  assert.equal(Math.round(v.surplusUsd / 1e6), Math.round((v.projWar * VALUE.perWar - 10e6) / 1e6))
})

test('a pre-arb year is paid the minimum and counts toward next season pay', () => {
  const v = playerValue(star({ contract: { regime: 'pre_arb', service: { years: 1 }, cells: [{ year: 2026, kind: 'none' }] } }), { nextYear: 2027, warSeason: 2026 })
  assert.equal(v.payEstUsd, VALUE.minSalary)
  // Four more controlled years: far more surplus than one signed year.
  assert.equal(v.years.length, 4) // one pre-arb year, then three of arbitration
  assert.ok(v.surplusUsd > 100e6)
})

test('a reliever is capped and an old one declines', () => {
  const pen = playerValue(star({ role: 'RP', warByYear: { 2026: 3, 2025: 3, 2024: 3 } }), { nextYear: 2027, warSeason: 2026 })
  assert.equal(pen.projWar, VALUE.relieverCap)
  const vet = playerValue(star({ age: 35 }), { nextYear: 2027, warSeason: 2026 })
  const kid = playerValue(star({ age: 25 }), { nextYear: 2027, warSeason: 2026 })
  assert.ok(vet.projWar < kid.projWar)
})

test('a prospect with no big-league WAR is valued by his rank', () => {
  assert.equal(prospectValue(5, null), 80e6)
  assert.equal(prospectValue(84, 3), 25e6)
  assert.equal(prospectValue(null, 8), 5e6)
  assert.equal(prospectValue(null, null), 1e6)
  const p = playerValue({ age: 20, onForty: false, warByYear: {}, topRank: 12, contract: null }, { nextYear: 2027, warSeason: 2026 })
  assert.equal(p.surplusUsd, 55e6)
  assert.equal(p.projWar, null)
  assert.equal(p.prospect, true)
})

test('retained salary raises the receiving club\'s surplus by what it no longer pays', () => {
  const base = playerValue(star(), { nextYear: 2027, warSeason: 2026 })
  const kept = playerValue(star({ retainedUsd: 4e6 }), { nextYear: 2027, warSeason: 2026 })
  assert.equal(Math.round(kept.surplusUsd - base.surplusUsd), 4e6)
})

test('a side’s surplus reads as a letter grade and the deal as one verdict', () => {
  assert.deepEqual([150e6, 60e6, 25e6, 0, -30e6, -60e6, -150e6].map(gradeOf), ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'])
  assert.deepEqual([5e6, -30e6, 70e6, 114.5e6].map(verdictOf), ['fair', 'win', 'big', 'steal'])
})

// The roster row's salary (deal.js salaryText) and the player sheet's contract
// ledger (value.years) must name the same 2027 figure. The row reads payEstUsd,
// which side.js copies from the value; the sheet reads the value's first year.
test('the roster row salary matches the sheet\'s first contract year', () => {
  const arb = star({ contract: { regime: 'arbitration', service: { years: 4 }, cells: [{ year: 2026, kind: 'salary', value: 3e6 }, { year: 2027, kind: 'arbitration', code: 'A2' }] } })
  const pre = star({ contract: { regime: 'pre_arb', service: { years: 1 }, cells: [{ year: 2026, kind: 'none' }] } })
  for (const p of [arb, pre]) {
    const v = playerValue(p, { nextYear: 2027, warSeason: 2026 })
    const row = { ...p, payUsd: null, payLabel: p === arb ? 'Arb 2' : 'Pre-arb', payEstUsd: v.payEstUsd }
    assert.equal(v.years[0].year, 2027)
    assert.equal(salaryText(row), money(v.years[0].pay))
  }
  // Before values load, a pre-arb row still shows the minimum, never pay earned this year.
  assert.equal(salaryText({ onForty: true, payUsd: null, payLabel: 'Pre-arb', lastSalaryUsd: 75e3 }), money(VALUE.minSalary))
})
