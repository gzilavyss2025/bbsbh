import assert from 'node:assert/strict'
import test from 'node:test'
import { contractBoard } from '../src/screens/player/next/modules/contract/contractView.js'

// Records copied from the nightly shards (player-contracts/ and contracts-history/player/),
// 2026-10-12: the board's own three players.
const TURANG = {
  season: 2027, club: 'Milwaukee Brewers', salaryUsd: 11750000, contractTotalUsd: null, aavUsd: null,
  terms: 'A2', regime: 'arbitration',
  outYears: [
    { year: 2028, cash: 'A3', cbt: null },
    { year: 2029, cash: 'A4', cbt: null },
    { year: 2030, cash: 'FA', cbt: null },
  ],
  payRank: { pos: '2B', rank: 6, of: 19, tied: false, onMinimum: false, fractionBelow: 0.7222 },
}
const GASSER = {
  season: 2027, club: 'Milwaukee Brewers', salaryUsd: null, terms: null, regime: 'pre_arb',
  outYears: [
    { year: 2028, cash: 'A1', cbt: null },
    { year: 2029, cash: 'A2', cbt: null },
    { year: 2030, cash: 'A3', cbt: null },
    { year: 2031, cash: 'FA', cbt: null },
  ],
  payRank: null,
}
const OHTANI = {
  season: 2027, club: 'Los Angeles Dodgers', salaryUsd: 28216994, contractTotalUsd: 700000000, aavUsd: 70000000,
  terms: '10 y/$700M (24-33)*', regime: 'signed',
  outYears: [2028, 2029, 2030, 2031].map((year) => ({ year, cash: 28216000, cbt: 46082000 })),
  payRank: { pos: 'DH', rank: 3, of: 17, tied: false, onMinimum: false, fractionBelow: 0.875 },
}
const salary = (season, amount) => ({
  rowKey: `salaries#${season}`, sourceFile: 'salaries', season, teamId: null,
  terms: amount == null ? {} : { salary: amount }, confidence: 'exact',
})

test('Turang: arbitration, the pay rank and the colour strip', () => {
  const b = contractBoard(TURANG, [salary(2026, 4150000), salary(2025, 777100), salary(2024, 748200), salary(2023, 720000)])
  assert.equal(b.pill, 'Arbitration')
  assert.equal(b.salary, '$11.75M')
  assert.equal(b.rank.text, '6 of 19 · 2B')
  assert.equal(b.rank.frac, 0.7222)
  assert.deepEqual(b.strip.cols.map((c) => [c.year, c.kind, c.status, c.money]), [
    ['’27', 'arb', 'Arb 2', '$11.75M'],
    ['’28', 'arb', 'Arb 3', ''],
    ['’29', 'arb', 'Arb 4', ''],
    ['’30', 'fa', 'FA eligible', ''],
  ])
  assert.equal(b.strip.cols[0].now, true)
  assert.deepEqual(b.strip.legend.map((k) => k.kind), ['arb', 'fa'])
  assert.deepEqual(b.past.bars.map((x) => [x.year, x.amount]), [
    [2023, 720000], [2024, 748200], [2025, 777100], [2026, 4150000],
  ])
  assert.equal(b.past.total, '$6.4M')
  assert.equal(b.past.seasons, 4)
})

test('Gasser: pre-arbitration shows no figure and no rank; a year with no figure is a gap', () => {
  const b = contractBoard(GASSER, [salary(2026, null), salary(2025, 765400)])
  assert.equal(b.pill, 'Club sets pay')
  assert.equal(b.salary, null)
  assert.equal(b.rank, null)
  assert.deepEqual(b.strip.cols.map((c) => [c.year, c.kind, c.status]), [
    ['’27', 'preArb', 'Club sets pay'],
    ['’28', 'arb', 'Arb 1'],
    ['’29', 'arb', 'Arb 2'],
    ['’30', 'arb', 'Arb 3'],
    ['’31', 'fa', 'FA eligible'],
  ])
  assert.deepEqual(b.past.bars.map((x) => [x.year, x.kind]), [[2025, 'paid'], [2026, 'gap']])
  assert.equal(b.past.total, '$765K')
})

test('Ohtani: a signed deal gets the Guaranteed and AAV tiles and a money column per year', () => {
  const b = contractBoard(OHTANI, [])
  assert.equal(b.pill, 'Signed')
  assert.deepEqual(b.tiles, [['Guaranteed', '$700M'], ['AAV', '$70M']])
  assert.deepEqual(b.strip.cols.map((c) => [c.kind, c.money]), [
    ['deal', '$28.22M'], ['deal', '$28.22M'], ['deal', '$28.22M'], ['deal', '$28.22M'], ['deal', '$28.22M'],
  ])
  assert.equal(b.past, null)
})

test('2020 is drawn, flagged, and left out of the total', () => {
  const b = contractBoard(null, [salary(2021, 3000000), salary(2020, 700000), salary(2019, 650000)])
  assert.equal(b.past.bars.find((x) => x.year === 2020).kind, 'left')
  assert.equal(b.past.total, '$3.65M')
  assert.equal(b.past.seasons, 2)
  assert.equal(b.past.left, true)
})

test('a retired player with salary rows and no current record gets the history alone', () => {
  const b = contractBoard(null, [salary(2023, 25000000), salary(2022, 25000000)])
  assert.equal(b.pill, '2 seasons')
  assert.equal(b.salary, null)
  assert.equal(b.strip, null)
  assert.equal(b.past.total, '$50M')
})

test('nothing to show returns null', () => {
  assert.equal(contractBoard(null, []), null)
  assert.equal(contractBoard(null, [salary(2023, null)]), null)
  assert.equal(contractBoard(null, [salary(2020, 700000)]), null)
})
