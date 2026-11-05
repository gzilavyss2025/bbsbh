import assert from 'node:assert/strict'
import test from 'node:test'
import { pick, relationOf, VOLATILE_DAYS } from '../src/lib/anchors/pick.js'

// Issue #2809, Done means. The seed's own fixtures, against the real registry.
const ON = '2026-09-25'

test('11 -> the 12 moon walkers, "fewer than"', () => {
  const got = pick(11, { unit: 'people', date: ON, seed: 'p1' })
  assert.equal(got?.anchor.id, 'moon-walked')
  assert.equal(got.relation, 'fewer')
})

test('9 -> the 9 Supreme Court justices, "as many as"', () => {
  const got = pick(9, { unit: 'people', date: ON, seed: 'p1' })
  assert.equal(got?.anchor.id, 'scotus')
  assert.equal(got.relation, 'equal')
})

// The issue lists 13 -> horses "more than". The registry holds 13 Triple Crown winners
// (Justify, 2018, made 13), so 13 is "as many as" and 14 is the "more than" case.
test('13 -> the Triple Crown horses: 13 is "as many as", 14 is "more than"', () => {
  const at13 = pick(13, { unit: 'people', date: ON, seed: 'p1' })
  assert.equal(at13?.anchor.id, 'triple-crown-horses')
  assert.equal(at13.relation, 'equal')
  const at14 = pick(14, { unit: 'people', date: ON, seed: 'p1' })
  assert.equal(at14?.anchor.id, 'triple-crown-horses')
  assert.equal(at14.relation, 'more')
})

test('a tier-3 anchor is picked only when nothing else fits', () => {
  // 15 is exact on the 15 unassisted triple plays (tier 3), but the 13 horses (tier 2) fit too.
  const at15 = pick(15, { unit: 'people', date: ON, seed: 'p1' })
  assert.equal(at15?.anchor.id, 'triple-crown-horses')
  assert.equal(at15.relation, 'more')
  // 2: only the 3 people who flew to the moon twice (tier 3) fit.
  assert.equal(pick(2, { unit: 'people', date: ON, seed: 'p1' })?.anchor.id, 'moon-twice')
})

test('relationOf compares the count with the anchor', () => {
  assert.equal(relationOf(3, 4), 'fewer')
  assert.equal(relationOf(4, 4), 'equal')
  assert.equal(relationOf(5, 4), 'more')
})

test('a gap past max(1, 20% of n) picks nothing', () => {
  // 20: past 15 (+3 allowed) and short of 28 (-6 allowed); 24 and 27 are unverified.
  assert.equal(pick(20, { unit: 'people', date: ON, seed: 'p1' }), null)
  assert.equal(pick(0, { unit: 'people', date: ON, seed: 'p1' }), null)
})

test('a team anchor never pairs with players, nor a player anchor with teams', () => {
  assert.notEqual(pick(1, { unit: 'people', date: ON, seed: 'p1' })?.anchor.id, 'dolphins-perfect')
  assert.equal(pick(1, { unit: 'teams', date: ON, seed: 'p1' })?.anchor.id, 'dolphins-perfect')
  assert.equal(pick(12, { unit: 'teams', date: ON, seed: 'p1' }), null)
})

test('only verified anchors are picked', () => {
  const anchors = [
    { id: 'a', count: 10, unit: 'people', tier: 1, kind: 'static', status: 'disputed', sources: [{ url: 'u', checked: '2026-01-01' }] },
    { id: 'b', count: 10, unit: 'people', tier: 2, kind: 'static', status: 'verified', sources: [{ url: 'u', checked: '2026-01-01' }] },
  ]
  assert.equal(pick(10, { unit: 'people', date: ON, seed: 's', anchors })?.anchor.id, 'b')
})

test(`a volatile anchor is skipped ${VOLATILE_DAYS} days after its last check; a static one never`, () => {
  const mk = (kind) => [{ id: kind, count: 10, unit: 'people', tier: 1, kind, status: 'verified', sources: [{ url: 'u', checked: '2026-01-01' }] }]
  assert.equal(pick(10, { unit: 'people', date: '2026-06-30', seed: 's', anchors: mk('volatile') })?.anchor.id, 'volatile')
  assert.equal(pick(10, { unit: 'people', date: '2026-07-01', seed: 's', anchors: mk('volatile') }), null)
  assert.equal(pick(10, { unit: 'people', date: '2030-01-01', seed: 's', anchors: mk('static') })?.anchor.id, 'static')
})

test('an equal gap on both sides goes to the anchor above the count ("fewer than")', () => {
  // 11 sits one under the moon (12) and one over the Bill of Rights (10), both tier 1.
  for (const seed of ['a', 'b', 'c', 'd', 'e']) assert.equal(pick(11, { unit: 'people', date: ON, seed }).anchor.id, 'moon-walked')
})

test('a tie goes to the lower tier, then to a stable hash of the seed', () => {
  const src = [{ url: 'u', checked: '2026-01-01' }]
  const a = { id: 'a', count: 10, unit: 'people', tier: 2, kind: 'static', status: 'verified', sources: src }
  const b = { id: 'b', count: 10, unit: 'people', tier: 1, kind: 'static', status: 'verified', sources: src }
  const c = { id: 'c', count: 10, unit: 'people', tier: 1, kind: 'static', status: 'verified', sources: src }
  assert.equal(pick(10, { unit: 'people', date: ON, seed: 'x', anchors: [a, b] }).anchor.id, 'b')
  const seen = new Set()
  for (let i = 0; i < 40; i += 1) {
    const one = pick(10, { unit: 'people', date: ON, seed: `p${i}`, anchors: [b, c] }).anchor.id
    assert.equal(pick(10, { unit: 'people', date: ON, seed: `p${i}`, anchors: [c, b] }).anchor.id, one, 'stable for one seed')
    seen.add(one)
  }
  assert.equal(seen.size, 2, 'different seeds spread across the tied anchors')
})
