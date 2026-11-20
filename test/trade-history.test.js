// One past trade rebuilt from the wire (src/lib/trade/history.js). Rows are
// the White Sox wire for 2025-06-13, trimmed: Vaughn to Milwaukee for Civale and cash.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupTrade, tradeLead } from '../src/lib/trade/history.js'

const CWS = 145, MIL = 158
const desc = 'Chicago White Sox traded 1B Andrew Vaughn to Milwaukee Brewers for RHP Aaron Civale and cash.'
const rows = [
  { id: 846932, typeCode: 'TR', date: '2025-06-13', fromTeam: { id: MIL }, toTeam: { id: CWS }, description: desc },
  { id: 846932, typeCode: 'TR', date: '2025-06-13', person: { id: 650644, fullName: 'Aaron Civale' }, fromTeam: { id: MIL }, toTeam: { id: CWS }, description: desc },
  { id: 846932, typeCode: 'TR', date: '2025-06-13', person: { id: 683734, fullName: 'Andrew Vaughn' }, fromTeam: { id: CWS }, toTeam: { id: MIL }, description: desc },
  { id: 900001, typeCode: 'TR', date: '2025-06-13', person: { id: 1, fullName: 'Someone Else' }, fromTeam: { id: CWS }, toTeam: { id: 147 } },
  { id: 900002, typeCode: 'OPT', date: '2025-06-13', person: { id: 2, fullName: 'Optioned' }, fromTeam: { id: CWS }, toTeam: { id: 247 } },
]

test('a trade groups by its transaction id, seen from the club the player joined', () => {
  const t = groupTrade(rows, 683734, MIL)
  assert.equal(t.id, 846932)
  assert.deepEqual(t.got.map((p) => p.name), ['Andrew Vaughn'])
  assert.deepEqual(t.gave.map((p) => p.name), ['Aaron Civale'])
  // The row with no player is the cash.
  assert.equal(t.other, true)
  assert.equal(t.description, desc)
})

test('a player who was not traded that day has no trade', () => {
  assert.equal(groupTrade(rows, 2, MIL), null)
})

test('a trade that names affiliates still splits by direction', () => {
  // A prospect traded straight to Double-A Biloxi (5015) for a big-league reliever from Milwaukee.
  const affRows = [
    { id: 7, typeCode: 'TR', date: '2025-07-30', person: { id: 10, fullName: 'Prospect' }, fromTeam: { id: 580 }, toTeam: { id: 5015 } },
    { id: 7, typeCode: 'TR', date: '2025-07-30', person: { id: 11, fullName: 'Reliever' }, fromTeam: { id: MIL }, toTeam: { id: 140 } },
  ]
  const t = groupTrade(affRows, 10, MIL)
  assert.deepEqual(t.got.map((p) => p.name), ['Prospect'])
  assert.deepEqual(t.gave.map((p) => p.name), ['Reliever'])
})

test('the trade reads as one sentence from the player\'s side', () => {
  const izzi = { id: 1, name: 'Ashton Izzi' }
  const trade = { date: '2025-07-24', got: [izzi, { id: 2, name: 'Brandyn Garcia' }], gave: [{ id: 3, name: 'Josh Naylor' }] }
  assert.equal(tradeLead(trade, izzi.id, 'Seattle'), 'Came from Seattle on July 24, 2025, with Brandyn Garcia, for Josh Naylor.')
  // Alone, and for cash.
  assert.equal(tradeLead({ date: '2025-07-24', got: [izzi], gave: [] }, izzi.id, 'Seattle', ['cash']), 'Came from Seattle on July 24, 2025, for cash.')
  assert.equal(tradeLead({ date: '2025-07-24', got: [izzi], gave: [] }, izzi.id, 'Seattle'), 'Came from Seattle on July 24, 2025.')
})
