// Unit coverage for the wire's replies (src/api/transactions/replies.js): which
// roster move answers which earlier one, and the per-row roster kind it reads
// (rosterKind, src/api/teamTransactions.js). The Romero fixture is cut down
// from the Brewers' 2026 file (Aug. 3); the rest are built to one rule each.
import assert from 'node:assert/strict'
import test from 'node:test'
import { findReplies } from '../src/api/transactions/replies.js'
import { groupIntoStories } from '../src/api/teamTransactions.js'

const MIL = 158
const SEASON = { start: '2026-03-26', end: '2026-09-27' }
const story = (id, moves, teamId = MIL) => ({ id, teamId, moves })
const day = (date, ...stories) => ({ date, stories })
// The ids a story replies to, or [] for none.
const quoted = (replies, id) => (replies[id] ?? []).map((q) => q.id)

test('a traded player placed on the injured list the same day replies to the trade', () => {
  const days = [
    day(
      '2026-08-03',
      story('trade', [[669160, 'trade-in'], [668941, 'trade-in'], [825484, 'trade-out']]),
      story('il', [[668941, 'il']]),
    ),
  ]
  const replies = findReplies(days, { season: SEASON })
  assert.deepEqual(quoted(replies, 'il'), ['trade'])
  assert.deepEqual(replies.il[0], { id: 'trade', date: '2026-08-03' })
  assert.deepEqual(quoted(replies, 'trade'), [])
})

test('the outright, release, trade or claim that resolves a designation replies to it', () => {
  for (const kind of ['out', 'rel', 'trade-out', 'lost']) {
    const days = [
      day('2026-08-10', story('after', [[1, kind]])),
      day('2026-08-03', story('des', [[1, 'des']])),
    ]
    assert.deepEqual(quoted(findReplies(days), 'after'), ['des'], kind)
  }
})

test('a designation is not answered by a different player’s release', () => {
  const days = [
    day('2026-08-10', story('after', [[2, 'rel']])),
    day('2026-08-03', story('des', [[1, 'des']])),
  ]
  assert.deepEqual(quoted(findReplies(days), 'after'), [])
})

test('an option after a waiver claim replies to the claim', () => {
  const days = [
    day('2026-05-02', story('opt', [[7, 'opt']])),
    day('2026-05-01', story('claim', [[7, 'claim']])),
  ]
  assert.deepEqual(quoted(findReplies(days, { season: SEASON }), 'opt'), ['claim'])
})

test('a claim and its option told in one story reply to nothing', () => {
  const days = [day('2026-05-01', story('both', [[7, 'claim'], [7, 'opt']]))]
  assert.deepEqual(findReplies(days, { season: SEASON }), {})
})

test('a recall fills the spot an injured-list placement opened the same day', () => {
  const days = [day('2026-06-10', story('il', [[1, 'il']]), story('up', [[2, 'cu']]))]
  assert.deepEqual(quoted(findReplies(days, { season: SEASON }), 'up'), ['il'])
})

test('a fill filed the day after its opening still replies', () => {
  const days = [
    day('2026-06-11', story('up', [[2, 'se']])),
    day('2026-06-10', story('down', [[1, 'opt']])),
  ]
  assert.deepEqual(quoted(findReplies(days, { season: SEASON }), 'up'), ['down'])
})

test('a fill two days off its opening does not reply', () => {
  const days = [
    day('2026-06-12', story('up', [[2, 'cu']])),
    day('2026-06-10', story('down', [[1, 'opt']])),
  ]
  assert.deepEqual(findReplies(days, { season: SEASON }), {})
})

test('a fill answering two openings quotes them both', () => {
  const days = [
    day(
      '2026-06-10',
      story('il', [[1, 'il']]),
      story('pat', [[3, 'list']]),
      story('up', [[2, 'cu'], [4, 'act']]),
    ),
  ]
  assert.deepEqual(quoted(findReplies(days, { season: SEASON }), 'up'), ['il', 'pat'])
})

test('an unbalanced club-day draws no count reply', () => {
  // Two openings, one fill: a doubleheader's 27th man or a short club — the
  // rule cannot say which, so it says nothing.
  const days = [
    day('2026-06-10', story('il', [[1, 'il']]), story('opt', [[3, 'opt']]), story('up', [[2, 'cu']])),
  ]
  assert.deepEqual(findReplies(days, { season: SEASON }), {})
})

test('a row the rule cannot read silences the whole club-day', () => {
  const days = [
    day('2026-06-10', story('il', [[1, 'il']]), story('up', [[2, 'cu']]), story('odd', [[5, '?']])),
  ]
  assert.deepEqual(findReplies(days, { season: SEASON }), {})
})

test('a trade day is not counted', () => {
  const days = [
    day('2026-07-31', story('il', [[1, 'il']]), story('deal', [[2, 'trade-in'], [3, 'trade-out']])),
    day('2026-07-30', story('up', [[4, 'cu']])),
  ]
  assert.deepEqual(findReplies(days, { season: SEASON }), {})
})

test('a 60-day transfer changes nothing on the active roster', () => {
  const days = [
    day('2026-06-10', story('il', [[1, 'il']]), story('xfer', [[9, 'il60']]), story('up', [[2, 'cu']])),
  ]
  const replies = findReplies(days, { season: SEASON })
  assert.deepEqual(quoted(replies, 'up'), ['il'])
  assert.deepEqual(quoted(replies, 'xfer'), [])
})

test('a story that balances itself neither replies nor is quoted', () => {
  const days = [
    day('2026-06-10', story('shuffle', [[1, 'il'], [2, 'cu']]), story('il', [[3, 'il']])),
    day('2026-06-11', story('up', [[4, 'cu']])),
  ]
  assert.deepEqual(quoted(findReplies(days, { season: SEASON }), 'up'), ['il'])
})

test('count replies hold to the regular season, and to one club', () => {
  const october = [day('2026-10-02', story('il', [[1, 'il']]), story('up', [[2, 'cu']]))]
  assert.deepEqual(findReplies(october, { season: SEASON }), {})
  const march = [day('2026-03-20', story('il', [[1, 'il']]), story('up', [[2, 'cu']]))]
  assert.deepEqual(findReplies(march, { season: SEASON }), {})
  // No season known: the count rule stays off rather than guessing.
  const june = [day('2026-06-10', story('il', [[1, 'il']]), story('up', [[2, 'cu']]))]
  assert.deepEqual(findReplies(june), {})
  // Two clubs on one wire day never answer each other.
  const wire = [day('2026-06-10', story('il', [[1, 'il']], 158), story('up', [[2, 'cu']], 138))]
  assert.deepEqual(findReplies(wire, { season: SEASON }), {})
})

test('stories with no moves (an older nightly file) reply to nothing', () => {
  const days = [day('2026-06-10', { id: 'a', teamId: MIL }, { id: 'b', teamId: MIL })]
  assert.deepEqual(findReplies(days, { season: SEASON }), {})
})

// The pipeline writes each row's roster kind onto its story.
const row = (id, typeCode, description, extra = {}) => ({
  id,
  typeCode,
  description,
  date: '2026-08-03',
  effectiveDate: '2026-08-03',
  person: { id: 1000 + id, fullName: `Player ${id}` },
  toTeam: { id: MIL },
  ...extra,
})

test('the pipeline tags each row with its roster kind', () => {
  const rows = [
    row(1, 'SC', 'Milwaukee Brewers placed LHP Player 1 on the 15-day injured list.'),
    row(2, 'SC', 'Milwaukee Brewers transferred RHP Player 2 to the 60-day injured list.'),
    row(3, 'TR', 'St. Louis Cardinals traded LHP Player 3 to Milwaukee Brewers.', {
      fromTeam: { id: 138 },
    }),
  ]
  const [{ stories }] = groupIntoStories(rows, { orgId: MIL })
  const kinds = Object.fromEntries(stories.flatMap((s) => s.moves))
  assert.equal(kinds[1001], 'il')
  assert.equal(kinds[1002], 'il60')
  assert.equal(kinds[1003], 'trade-in')
})

test('a call-up never fills the spot his own option opened', () => {
  // Bo Naylor, Little League Classic: recalled Aug. 23, optioned Aug. 24. The
  // count balances across the two days, and it is still not a pair.
  const days = [
    day('2026-08-24', story('down', [[680777, 'opt']])),
    day('2026-08-23', story('up', [[680777, 'cu']])),
  ]
  assert.deepEqual(findReplies(days, { season: SEASON }), {})
})

test('a day that allows a 27th man is not counted', () => {
  // Brewers, April 4 doubleheader: Logan Henderson's recall balanced the day
  // before's designation by count alone, and answered his game instead.
  const days = [
    day('2026-04-04', story('up', [[701656, 'cu']])),
    day('2026-04-03', story('des', [[1, 'des']])),
  ]
  assert.deepEqual(quoted(findReplies(days, { season: SEASON }), 'up'), ['des'])
  const allow = new Set([`${MIL}|2026-04-04`])
  assert.deepEqual(findReplies(days, { season: SEASON, extraManDays: allow }), {})
})
