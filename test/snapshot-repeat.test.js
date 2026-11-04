// The nightly score generators skip a team_snapshots row that repeats the
// team's previous one (only `asOf` moved). Without that, every offseason night
// added a 162-game copy of each club's final line to season-score.json,
// team-score.json and scripts/data/team-snapshots.sql.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { repeatsPrevious } from '../scripts/lib/db.js'

const final = { asOf: '2026-11-03', gamesPlayed: 162, wins: 86, score: 6 }

test('a snapshot that only moves asOf repeats the previous one', () => {
  assert.equal(repeatsPrevious(JSON.stringify(final), { ...final, asOf: '2026-11-04' }), true)
})

test('a changed number is not a repeat', () => {
  assert.equal(repeatsPrevious(JSON.stringify(final), { ...final, asOf: '2026-11-04', wins: 87 }), false)
})

test('the first snapshot is never a repeat', () => {
  assert.equal(repeatsPrevious(undefined, final), false)
})

test('a payload with no asOf compares whole', () => {
  const form = { last10: [6, 4] }
  assert.equal(repeatsPrevious(JSON.stringify(form), { last10: [6, 4] }), true)
  assert.equal(repeatsPrevious(JSON.stringify(form), { last10: [7, 3] }), false)
})
