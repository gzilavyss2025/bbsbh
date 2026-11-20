// The lineup a club fields before and after a deal (src/lib/trade/lineup.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lineupAfter } from '../src/lib/trade/lineup.js'

const p = (id, pos, war, level = 'MLB') => ({ id, name: `P${id}`, pos, war, level })

// A club: a 3.0 third baseman (traded away) over a 0.4 backup, a 1.0 first
// baseman, and a deep enough rest of the field.
const club = [
  p(1, 'C', 2.0), p(2, '1B', 1.0), p(3, '2B', 2.5), p(4, 'SS', 2.9),
  p(5, '3B', 3.0), p(6, '3B', 0.4, 'AAA'),
  p(7, 'LF', 1.5), p(8, 'CF', 2.4), p(9, 'RF', 1.8),
  p(20, 'P', 6.6), p(21, 'P', 2.0), p(22, 'P', 1.5), p(23, 'P', 1.0), p(24, 'P', 0.8), p(25, 'P', 0.2),
  p(30, 'SS', 0.1, 'AA'),
]

test('a traded starter is replaced by the best man left, and a weak one is flagged', () => {
  const view = lineupAfter(club, { out: [club[4]], inn: [] })
  const third = view.spots.find((s) => s.spot === '3B')
  assert.equal(third.before.id, 5)
  assert.equal(third.after.id, 6)
  assert.equal(third.changed, true)
  assert.equal(third.weak, true, 'under 1.0 WAR is a weak spot')
})

test('an arriving player takes his spot, and the man he passes moves to DH', () => {
  const view = lineupAfter(club, { out: [], inn: [p(99, '1B', 3.2)] })
  const first = view.spots.find((s) => s.spot === '1B')
  const dh = view.spots.find((s) => s.spot === 'DH')
  assert.equal(first.after.id, 99)
  assert.equal(first.incoming, true)
  assert.equal(dh.after.id, 2, 'the old first baseman is the best bat left')
})

test('only big-league and Triple-A players start; the rest of the farm does not', () => {
  const view = lineupAfter(club, { out: [club[3]], inn: [] })
  const ss = view.spots.find((s) => s.spot === 'SS')
  assert.notEqual(ss.after?.id, 30)
})

test('the top five arms by WAR make the rotation', () => {
  const view = lineupAfter(club, {})
  const arms = view.spots.filter((s) => s.group === 'arm').map((s) => s.after.id)
  assert.deepEqual(arms, [20, 21, 22, 23, 24])
})

test("the lineup's WAR is the sum of its starters, before and after", () => {
  // The 0.4 backup was the DH; he moves to third, and nobody near the majors is left to DH.
  const view = lineupAfter(club, { out: [club[4]], inn: [] })
  assert.equal(Math.round((view.before - view.after) * 10) / 10, 3.0)
  assert.deepEqual(view.spots.filter((s) => s.changed).map((s) => s.spot), ['3B', 'DH'])
  assert.equal(view.spots.find((s) => s.spot === 'DH').after, null)
})

test('an outfielder whose own spot is taken slides to an open outfield spot', () => {
  // The left fielder leaves; a 3.1 center fielder sits behind a 3.5 one.
  const of = [p(40, 'LF', 4.6), p(41, 'CF', 3.5), p(42, 'CF', 3.1), p(43, 'RF', 2.0), p(44, 'LF', 0.3)]
  const view = lineupAfter(of, { out: [of[0]], inn: [] })
  assert.equal(view.spots.find((s) => s.spot === 'LF').after.id, 42)
})

test('a spot with nobody of its own takes the best bat left before the DH', () => {
  const thin = [p(49, 'C', 1.0), p(50, '2B', 3.0), p(51, 'SS', 2.0), p(52, '3B', 1.5), p(53, 'SS', 1.2)]
  const view = lineupAfter(thin, {})
  assert.equal(view.spots.find((s) => s.spot === '1B').after.id, 53)
  assert.equal(view.spots.find((s) => s.spot === 'DH').after, null)
})

test('a reliever does not start; the rotation is starters and arms with no known role', () => {
  const staff = [{ ...p(60, 'P', 4.0), role: 'CL' }, { ...p(61, 'P', 3.0), role: 'RP' }, { ...p(62, 'P', 2.0), role: 'SP' }, p(63, 'P', 1.0)]
  const arms = lineupAfter(staff, {}).spots.filter((s) => s.group === 'arm').map((s) => s.after?.id ?? null)
  assert.deepEqual(arms, [62, 63, null, null, null])
})
