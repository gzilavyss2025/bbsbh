// The shard's wsEvents block (src/lib/postseason/primer/wsEventsBlock.js): the counted games of the
// current Series, classified. Same cutoff as the series block (ADR-0087): a game on or after the
// slate date is never in it. Every counted game is handed in with every later game's data planted.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bracket2025 } from '../postseason/fixtures.js'
import { seriesBlock } from '../../src/lib/postseason/primer/seriesBlock.js'
import { wsEventsBlock } from '../../src/lib/postseason/primer/wsEventsBlock.js'
import { playsOf } from './ws-fixture.js'

const WS_2025 = [813027, 813026, 813032, 813023, 813022, 813025, 813024]
const real = { 813027: playsOf(813027), 813032: playsOf(813032), 813022: playsOf(813022), 813024: playsOf(813024) }
const pbp = Object.fromEntries(WS_2025.map((pk) => [pk, { allPlays: real[pk] ?? [] }]))
const box = { teams: { away: { team: { id: 119 } }, home: { team: { id: 141 } } } }
const boxes = Object.fromEntries(WS_2025.map((pk) => [pk, { box }]))
const block = (cutoff, pk) => wsEventsBlock(bracket2025(cutoff), pk, boxes, pbp)

test('Game 5 day (2025-10-29): Games 1 to 4 only; the opening pair of Game 5 is not in it', () => {
  const b = block('2025-10-29', 813022)
  assert.ok(b.events.length > 0)
  assert.ok(b.events.every((e) => e.date < '2025-10-29'), 'no event on or after the slate date')
  assert.ok(b.events.some((e) => e.tag === 'grandSlam' && e.pk === 813027))
  assert.ok(!b.events.some((e) => e.tag === 'openingHrPair'), '813022 is the slate game')
  assert.ok(!b.events.some((e) => e.pk === 813022 || e.pk === 813024))
})

test('the rows carry the club, the date, the season and the game number', () => {
  const e = block('2025-10-29', 813022).events.find((x) => x.tag === 'grandSlam')
  assert.equal(e.season, 2025)
  assert.equal(e.n, 1)
  assert.equal(e.date, '2025-10-24')
  assert.equal(e.wta, false)
})

test('Game 1 day: the block exists with no events (so does the series block)', () => {
  assert.deepEqual(block('2025-10-24', 813027), { events: [], wta: false })
  assert.deepEqual(seriesBlock(bracket2025('2025-10-24'), 813027, {}).games, [])
})

test('wta is true heading into Game 7 at 3-3, false a game earlier', () => {
  assert.equal(block('2025-11-01', 813024).wta, true)
  assert.equal(block('2025-10-31', 813025).wta, false)
  assert.ok(!block('2025-11-01', 813024).events.some((e) => e.pk === 813024))
})

test('a counted game with no play-by-play drops the block; a game outside a Series has none', () => {
  assert.equal(wsEventsBlock(bracket2025('2025-10-29'), 813022, boxes, { ...pbp, 813027: undefined }), null)
  assert.equal(wsEventsBlock(bracket2025('2025-10-29'), 1, boxes, pbp), null)
})
