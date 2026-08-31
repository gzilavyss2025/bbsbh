// The league-wide bullpen board (src/api/around-the-game/bullpen.js).
//
// It re-runs api/workload.js's availability rules across all thirty clubs, so
// the RULES themselves are not retested here — they belong to that module. What
// is worth pinning is what this layer adds and could get wrong quietly: that
// starters never pad a bullpen, that a club with no arms on file is dropped
// rather than shown as an empty pen, and that the board ranks on a SHARE, which
// is the one claim the page makes in its own words.
import test from 'node:test'
import assert from 'node:assert/strict'
import { bullpenFor, bullpenBoard, leagueBullpen } from '../src/api/around-the-game/bullpen.js'

const AS_OF = '2026-08-17'

// An arm with `apps` on the given days, each at `pitches`.
const arm = (name, teamId, role, days, pitches = 20) => ({
  name,
  teamId,
  role,
  apps: days.map((d) => ({ d, p: pitches })),
  season: { g: days.length, gs: role === 'SP' ? days.length : 0, pitches: days.length * pitches },
})

const data = {
  pitchers: {
    // Worked the last three days: three straight, so LIKELY DOWN.
    1: arm('Burned', 158, 'RP', ['2026-08-16', '2026-08-15', '2026-08-14'], 20),
    // One heavy outing yesterday: one flag, so LIMITED.
    2: arm('Warm', 158, 'RP', ['2026-08-16'], 30),
    // Nothing in a week: AVAILABLE.
    3: arm('Rested', 158, 'RP', ['2026-08-05'], 15),
    // A starter on the same club — must not count either way.
    4: arm('Ace', 158, 'SP', ['2026-08-13'], 95),
    // A second club with one untaxed arm.
    5: arm('Other', 112, 'RP', ['2026-08-01'], 12),
  },
}

test('a bullpen holds relievers only — a rotation is not a pen', () => {
  const arms = bullpenFor(data, 158, AS_OF)
  assert.deepEqual(
    arms.map((a) => a.name).sort(),
    ['Burned', 'Rested', 'Warm'],
  )
})

test('the three statuses come out as the workload rules decide them', () => {
  const byName = Object.fromEntries(bullpenFor(data, 158, AS_OF).map((a) => [a.name, a.status]))
  assert.equal(byName.Burned, 'down')
  assert.equal(byName.Warm, 'limited')
  assert.equal(byName.Rested, 'fresh')
})

test('a flagged arm carries the reason it was flagged', () => {
  const burned = bullpenFor(data, 158, AS_OF).find((a) => a.name === 'Burned')
  assert.ok(burned.reasons.length > 0)
  assert.ok(burned.reasons.some((r) => r.includes('straight days')))
})

test('the arms list leads with the most-worked name', () => {
  assert.equal(bullpenFor(data, 158, AS_OF)[0].name, 'Burned')
})

// The order this list is in decides which row a reader sees first, and ranking
// on pitches alone put the one name they came for below arms that were fine.
// The fixture above cannot catch it — its most-worked arm IS its down arm — so
// this one separates the two deliberately.
const mixed = {
  pitchers: {
    // Three straight short outings: down on the hard flag, 24 pitches all week.
    1: arm('Streak', 158, 'RP', ['2026-08-16', '2026-08-15', '2026-08-14'], 8),
    // One big outing four days ago: nothing tripped, 60 pitches all week.
    2: arm('Heavy', 158, 'RP', ['2026-08-13'], 60),
  },
}

test('the arms list leads on availability, not on pitch count', () => {
  const arms = bullpenFor(mixed, 158, AS_OF)
  assert.deepEqual(arms.map((a) => a.name), ['Streak', 'Heavy'])
  assert.equal(arms[0].status, 'down')
  assert.ok(
    arms[0].last7dayPitches < arms[1].last7dayPitches,
    'the leading row threw FEWER pitches — status is what put it there',
  )
})

// `leader` is the board's "Most used" column, which is a claim about pitch
// count and nothing else. It used to be arms[0], which was only ever right
// while the list was sorted on load.
test('the most-used arm is the most-worked one, not merely the first row', () => {
  const board = bullpenBoard(mixed, [158], AS_OF, 'downPct')
  assert.equal(board[0].arms[0].name, 'Streak')
  assert.equal(board[0].leader.name, 'Heavy')
  assert.equal(board[0].leader.last7dayPitches, 60)
})

// The board's stated claim: four tired arms out of six is a different night
// than four out of eleven, so the order is a share and not a count.
test('the board ranks on the share of the staff, not the head count', () => {
  const board = bullpenBoard(data, [158, 112], AS_OF, 'downPct')
  assert.equal(board[0].teamId, 158)
  assert.equal(board[0].counts.down, 1)
  assert.equal(board[0].total, 3)
  assert.equal(board[0].downPct, 33.3)
  assert.equal(board[1].downPct, 0)
})

test('a club with no arms on file is dropped rather than shown as an empty pen', () => {
  const board = bullpenBoard(data, [158, 112, 999], AS_OF, 'downPct')
  assert.deepEqual(
    board.map((r) => r.teamId).sort((a, b) => a - b),
    [112, 158],
  )
})

test('each row names its most-worked arm', () => {
  const board = bullpenBoard(data, [158], AS_OF, 'downPct')
  assert.equal(board[0].leader.name, 'Burned')
})

test('the league line totals every club on the board', () => {
  const board = bullpenBoard(data, [158, 112], AS_OF, 'downPct')
  const league = leagueBullpen(board)
  assert.equal(league.arms, 4)
  assert.equal(league.down, 1)
  assert.equal(league.limited, 1)
  assert.equal(league.fresh, 2)
  assert.equal(league.clubs, 2)
})

test('the board is null rather than empty when the workload file is missing', () => {
  assert.equal(bullpenBoard(null, [158], AS_OF), null)
  assert.equal(bullpenBoard({ pitchers: {} }, [158], AS_OF), null)
})
