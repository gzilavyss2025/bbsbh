import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seasonOver } from '../scripts/lib/time/season-in-play.mjs'
import { freezeDecision } from '../scripts/frozen/freeze-season.mjs'

// #2778: the nightly freezes season N the first night it is over (ADR-0074),
// does nothing on every other night, and fails loudly once the live files have
// moved on to N+1 with N never frozen.

// statsapi's 2026 row, the fields seasonOver reads (checked live, ADR-0074's table).
const row2026 = { seasonId: '2026', regularSeasonStartDate: '2026-03-26', offseasonStartDate: '2026-11-01' }
const row2027 = { seasonId: '2027', regularSeasonStartDate: '2027-03-25', offseasonStartDate: '2027-11-01' }

test('seasonOver: the postseason is still the season', () => {
  assert.equal(seasonOver('2026-10-31', row2026), null)
  assert.equal(seasonOver('2026-07-04', row2026), null)
})

test('seasonOver: the offseason opens on the row\'s offseasonStartDate', () => {
  assert.equal(seasonOver('2026-11-01', row2026), 2026)
  assert.equal(seasonOver('2026-12-31', row2026), 2026)
})

test('seasonOver: January to Opening Day, last season is over', () => {
  assert.equal(seasonOver('2027-01-01', row2027), 2026)
  assert.equal(seasonOver('2027-03-24', row2027), 2026)
  assert.equal(seasonOver('2027-02-01', null), 2026)
})

test('seasonOver: from Opening Day the new season is in play, not over', () => {
  assert.equal(seasonOver('2027-03-25', row2027), null)
})

test('seasonOver: in November or December with no usable row it cannot decide, and throws naming the season', () => {
  // Gary, #2887: the step exits 1 that night rather than wait silently.
  assert.throws(() => seasonOver('2026-11-15', null), /2026/)
  assert.throws(() => seasonOver('2026-12-31', row2027), /2026/)
  assert.throws(() => seasonOver('2026-11-15', { seasonId: '2026' }), /2026/)
})

test('seasonOver: before November with no row it is still not over (no throw)', () => {
  assert.equal(seasonOver('2026-07-04', null), null)
  assert.equal(seasonOver('2026-10-31', null), null)
})

const live = (season, prospectsYear = season) => ({
  salaries: season,
  clubs: [season, season],
  prospectsYear,
})

test('freezeDecision: season not over yet is a quiet wait', () => {
  const d = freezeDecision({ over: null, frozen: [2025], live: live(2026) })
  assert.equal(d.action, 'wait')
  assert.equal(d.exitCode, 0)
})

test('freezeDecision: already frozen is a quiet no-op', () => {
  const d = freezeDecision({ over: 2026, frozen: [2026], live: live(2026) })
  assert.equal(d.action, 'noop')
  assert.equal(d.exitCode, 0)
  // Still a no-op once the live files have moved on: that season is safe.
  assert.equal(freezeDecision({ over: 2026, frozen: [2026], live: live(2027) }).action, 'noop')
})

test('freezeDecision: over, not frozen, live files still that season → freeze', () => {
  const d = freezeDecision({ over: 2027, frozen: [2026], live: live(2027) })
  assert.equal(d.action, 'freeze')
  assert.equal(d.season, 2027)
  assert.equal(d.exitCode, 0)
})

test('freezeDecision: live files already on N+1 is too late, fails and names N', () => {
  const d = freezeDecision({ over: 2027, frozen: [2026], live: live(2028) })
  assert.equal(d.action, 'too-late')
  assert.notEqual(d.exitCode, 0)
  assert.match(d.message, /2027/)
})

test('freezeDecision: one file moved on is enough to be too late', () => {
  const d = freezeDecision({ over: 2027, frozen: [2026], live: live(2027, 2028) })
  assert.equal(d.action, 'too-late')
  assert.notEqual(d.exitCode, 0)
  assert.match(d.message, /2027/)
  assert.match(d.message, /top-prospects/)
})

test('freezeDecision: live files behind the season fail too (nothing true to freeze)', () => {
  const d = freezeDecision({ over: 2027, frozen: [2026], live: live(2026) })
  assert.equal(d.action, 'mismatch')
  assert.notEqual(d.exitCode, 0)
  assert.match(d.message, /2027/)
})
