// The figures the ABS Challenges card hands the player hover card
// (src/screens/team/next/ranks/challenges/challengeDetail.js). They must be the
// plot's own numbers, so a reader who hovers a face sees what placed it there.
import assert from 'node:assert/strict'
import test from 'node:test'
import { challengeCard } from '../src/api/around-the-game/absClubCard.js'
import { challengeDetail } from '../src/screens/team/next/ranks/challenges/challengeDetail.js'

const man = (over) => ({ playerId: 1, name: 'A Hitter', pitches: 2000, plateAppearances: 400, asBatter: 10, wonBatter: 6, resultsBatter: '1110100110', ...over })
const job = (men) => challengeCard({ levels: { MLB: { byTeam: { 1: men, 2: [man({ playerId: 9, asBatter: 4, wonBatter: 1, resultsBatter: '0100' })] } } } }, 1).batter

test('called: calls, the pitches behind them, the rate, and the review marks', () => {
  const j = job([man({})])
  const d = challengeDetail(j, 'called', j.rows[0])
  assert.deepEqual(d.columns, ['Calls', 'Pitches', 'Rate'])
  assert.equal(d.row.label, 'Season')
  assert.deepEqual(d.row.cells.map((c) => c.v), ['10', '2,000', '0.50%'])
  assert.equal(d.row.cells[2].over, true)
  assert.equal(d.strip.label, 'Reviews')
  assert.equal(d.strip.marks, '1110100110')
  assert.equal(d.strip.right, 6)
  assert.equal(d.strip.wrong, 4)
})

test('success: called, won, the share, and clay only above the league share', () => {
  const j = job([man({})])
  const d = challengeDetail(j, 'success', j.rows[0])
  assert.deepEqual(d.columns, ['Called', 'Won', 'Success'])
  assert.deepEqual(d.row.cells.map((c) => c.v), ['10', '6', '60.0%'])
  // League share is 7 of 14, so 60% is over it.
  assert.equal(d.row.cells[2].over, true)
  const worse = job([man({ wonBatter: 2, resultsBatter: '1100000000' })])
  assert.equal(challengeDetail(worse, 'success', worse.rows[0]).row.cells[2].over, false)
})

test('a man with no reviews prints a dash, and his marks row says none', () => {
  const j = job([man({ asBatter: 0, wonBatter: 0, resultsBatter: '' })])
  const d = challengeDetail(j, 'success', j.rows[0])
  assert.equal(d.row.cells[2].v, '—')
  assert.deepEqual(d.strip, { label: 'Reviews' })
})

test('a file without results has no marks row at all', () => {
  const j = job([man({ resultsBatter: undefined, wonBatter: undefined })])
  assert.equal(challengeDetail(j, 'called', j.rows[0]).strip, null)
})
