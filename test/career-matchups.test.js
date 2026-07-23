// Unit coverage for the pure sort/format helpers behind the lineup page's
// Career Matchups tables (src/api/careerMatchups.js, wired into
// TeamInfo.jsx's CareerMatchups/MatchupTable). careerMatchupsFor itself is
// a thin symmetric-key lookup and isn't covered here.
import assert from 'node:assert/strict'
import test from 'node:test'
import { sortByPitcher, matchupLine } from '../src/api/careerMatchups.js'

function row({ batterId, pitcherId, pa }) {
  return {
    batter: { id: batterId, name: `Batter ${batterId}`, teamId: 1 },
    pitcher: { id: pitcherId, name: `Pitcher ${pitcherId}`, teamId: 2 },
    ab: pa,
    h: 0,
    hr: 0,
    bb: 0,
    k: 0,
    pa,
    levels: [],
  }
}

test('sortByPitcher groups every row by pitcher, keeping batters adjacent', () => {
  const rows = [
    row({ batterId: 1, pitcherId: 10, pa: 3 }),
    row({ batterId: 2, pitcherId: 20, pa: 5 }),
    row({ batterId: 3, pitcherId: 10, pa: 7 }),
  ]
  const sorted = sortByPitcher(rows)
  const pitcherIds = sorted.map((r) => r.pitcher.id)
  // Pitcher 10's two rows stay together, never split by pitcher 20's row.
  assert.deepEqual(pitcherIds, [10, 10, 20])
})

test('sortByPitcher ranks pitcher groups by the group\'s total PA', () => {
  const rows = [
    // Pitcher 10: total PA 4 (lower total, but one higher single-row PA)
    row({ batterId: 1, pitcherId: 10, pa: 4 }),
    // Pitcher 20: total PA 9 across two rows
    row({ batterId: 2, pitcherId: 20, pa: 5 }),
    row({ batterId: 3, pitcherId: 20, pa: 4 }),
  ]
  const sorted = sortByPitcher(rows)
  assert.deepEqual(
    sorted.map((r) => r.pitcher.id),
    [20, 20, 10],
  )
})

test('sortByPitcher ranks batters within a pitcher group by PA, most first', () => {
  const rows = [
    row({ batterId: 1, pitcherId: 10, pa: 2 }),
    row({ batterId: 2, pitcherId: 10, pa: 8 }),
    row({ batterId: 3, pitcherId: 10, pa: 5 }),
  ]
  const sorted = sortByPitcher(rows)
  assert.deepEqual(
    sorted.map((r) => r.batter.id),
    [2, 3, 1],
  )
})

test('sortByPitcher on an empty list returns an empty list', () => {
  assert.deepEqual(sortByPitcher([]), [])
})

test('matchupLine renders the bare AB/H line with no extras or levels', () => {
  const r = { h: 2, ab: 7, hr: 0, bb: 0, k: 0, levels: [] }
  assert.equal(matchupLine(r, 'MLB'), '2-for-7')
})

test('matchupLine appends only the nonzero extras, in HR/BB/K order', () => {
  const r = { h: 1, ab: 3, hr: 1, bb: 0, k: 2, levels: [] }
  assert.equal(matchupLine(r, 'MLB'), '1-for-3, 1 HR, 2 K')
})

test('matchupLine drops the level tag when history is entirely at tonight\'s own level', () => {
  const r = { h: 1, ab: 4, hr: 0, bb: 0, k: 0, levels: ['AA'] }
  assert.equal(matchupLine(r, 'AA'), '1-for-4')
})

test('matchupLine keeps the level tag, including tonight\'s level, when history spans more than one level', () => {
  const r = { h: 3, ab: 9, hr: 0, bb: 0, k: 0, levels: ['AA', 'A+'] }
  assert.equal(matchupLine(r, 'AA'), '3-for-9 — AA, A+')
})

test('matchupLine keeps a single non-tonight level tag', () => {
  const r = { h: 0, ab: 2, hr: 0, bb: 0, k: 0, levels: ['A+'] }
  assert.equal(matchupLine(r, 'AA'), '0-for-2 — A+')
})
