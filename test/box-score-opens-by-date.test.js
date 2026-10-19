import assert from 'node:assert/strict'
import test from 'node:test'
import { boxScoreOpensByDate, slateToday } from '../src/lib/dates.js'

// ADR-0117: a box score opens with no tap when its schedule date is before the slate's today.
// The date alone decides. `now` is chosen so the UTC, local and Pacific dates agree (or the
// earliest is the one named), whatever zone the test runs in.

// 20:00Z: 2026-10-19 in UTC and Pacific; 2026-10-19 or -20 locally; the earliest is 10-19.
const AFTERNOON = new Date('2026-10-19T20:00:00Z')

test('a game dated before today opens', () => {
  assert.equal(boxScoreOpensByDate('2026-10-18', AFTERNOON), true)
  assert.equal(boxScoreOpensByDate('2026-07-07', AFTERNOON), true)
})

test('a game dated today stays sealed', () => {
  assert.equal(boxScoreOpensByDate('2026-10-19', AFTERNOON), false)
})

test('a game dated after today stays sealed', () => {
  assert.equal(boxScoreOpensByDate('2026-10-20', AFTERNOON), false)
})

test('a suspended game opens on its first date: the date rule reads no status', () => {
  // gamePk 777861 (CLE @ MIN): suspended 2025-05-19, officialDate stays 2025-05-19.
  assert.equal(boxScoreOpensByDate('2025-05-19', AFTERNOON), true)
})

test('after 00:00 UTC, a West-coast game still on stays sealed', () => {
  // 02:30Z on 10-20 is 19:30 Pacific on 10-19: the 10-19 game may still be on.
  const lateWest = new Date('2026-10-20T02:30:00Z')
  assert.equal(slateToday(lateWest), '2026-10-19')
  assert.equal(boxScoreOpensByDate('2026-10-19', lateWest), false)
  assert.equal(boxScoreOpensByDate('2026-10-18', lateWest), true)
})

test('the next afternoon, that game opens', () => {
  assert.equal(boxScoreOpensByDate('2026-10-19', new Date('2026-10-20T20:00:00Z')), true)
})

test('a missing or garbled date stays sealed', () => {
  for (const bad of [undefined, null, '', '2026-13-45', '2026-02-30', '10/18/2026', '2026-10-18T19:00:00Z', 20261018]) {
    assert.equal(boxScoreOpensByDate(bad, AFTERNOON), false, String(bad))
  }
})
