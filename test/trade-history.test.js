// One past trade rebuilt from the wire (src/lib/trade/history.js). Rows are
// the White Sox wire for 2025-06-13, trimmed: Vaughn to Milwaukee for Civale and cash.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupTrade } from '../src/lib/trade/history.js'

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
