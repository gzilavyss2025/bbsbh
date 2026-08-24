// Unit coverage for src/api/logbookMilestones.js — the Game Log retrospective's
// milestone/collection-progress shelf (docs/design-inspiration.md §8).
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MILESTONE_COLLECTIONS,
  computeAllMilestones,
  computeMilestoneProgress,
  isMilestoneCollectionId,
} from '../src/api/logbookMilestones.js'

// --------------------------------------------------------------------------
// The generic engine, exercised against a small synthetic collection so a
// test doesn't need 30 real stamps to reach `complete: true`.
// --------------------------------------------------------------------------
const THREE_SLOT_COLLECTION = {
  id: 'trio',
  title: 'Trio',
  lede: 'test fixture',
  slots: () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  fillsFor: (fact) => [fact.who].filter(Boolean),
}

function stamp(gamePk, date) {
  return { gamePk, date, mode: 'watched', stampedAt: 1, updatedAt: 1, note: '', placement: null }
}

test('computeMilestoneProgress: empty collection starts unfilled, incomplete', () => {
  const result = computeMilestoneProgress(THREE_SLOT_COLLECTION, [], {})
  assert.equal(result.total, 3)
  assert.equal(result.count, 0)
  assert.equal(result.complete, false)
  assert.deepEqual(result.slots.map((s) => s.filled), [false, false, false])
})

test('computeMilestoneProgress: fills a slot from a resolved fact', () => {
  const stamps = [stamp(1, '2026-04-01')]
  const facts = { 1: { who: 'a', date: '2026-04-01' } }
  const result = computeMilestoneProgress(THREE_SLOT_COLLECTION, stamps, facts)
  assert.equal(result.count, 1)
  const slotA = result.slots.find((s) => s.id === 'a')
  assert.equal(slotA.filled, true)
  assert.equal(slotA.gamePk, 1)
  assert.equal(slotA.date, '2026-04-01')
})

test('computeMilestoneProgress: a stamp with no resolved fact fills nothing', () => {
  const stamps = [stamp(1, '2026-04-01')]
  const result = computeMilestoneProgress(THREE_SLOT_COLLECTION, stamps, {})
  assert.equal(result.count, 0)
})

test('computeMilestoneProgress: the FIRST stamp to fill a slot is credited, not the latest', () => {
  const stamps = [stamp(1, '2026-04-01'), stamp(2, '2026-05-01')]
  const facts = {
    1: { who: 'a', date: '2026-04-01' },
    2: { who: 'a', date: '2026-05-01' },
  }
  const result = computeMilestoneProgress(THREE_SLOT_COLLECTION, stamps, facts)
  const slotA = result.slots.find((s) => s.id === 'a')
  assert.equal(slotA.gamePk, 1)
  assert.equal(slotA.date, '2026-04-01')
})

test('computeMilestoneProgress: complete once every slot is filled', () => {
  const stamps = [stamp(1, '2026-04-01'), stamp(2, '2026-04-02'), stamp(3, '2026-04-03')]
  const facts = {
    1: { who: 'a', date: '2026-04-01' },
    2: { who: 'b', date: '2026-04-02' },
    3: { who: 'c', date: '2026-04-03' },
  }
  const result = computeMilestoneProgress(THREE_SLOT_COLLECTION, stamps, facts)
  assert.equal(result.count, 3)
  assert.equal(result.complete, true)
})

test('computeMilestoneProgress: a collection filling more than one slot per fact (e.g. two clubs)', () => {
  const both = {
    id: 'pair',
    slots: () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    fillsFor: (fact) => [fact.first, fact.second].filter(Boolean),
  }
  const stamps = [stamp(1, '2026-04-01')]
  const facts = { 1: { first: 'a', second: 'b', date: '2026-04-01' } }
  const result = computeMilestoneProgress(both, stamps, facts)
  assert.equal(result.count, 2)
})

// --------------------------------------------------------------------------
// The real registry — team identity from the stamped game facts shape
// api/logbook.js's stampGameFacts produces.
// --------------------------------------------------------------------------
function fact(gamePk, { away, home, date = '2026-04-01' }) {
  return { gamePk, date, away: { id: away }, home: { id: home } }
}

test('MILESTONE_COLLECTIONS: clubs and parks each cover all 30 current MLB clubs', () => {
  for (const collection of MILESTONE_COLLECTIONS) {
    assert.equal(collection.slots().length, 30)
  }
})

test('clubs collection: fills BOTH sides of a stamped game', () => {
  const clubs = MILESTONE_COLLECTIONS.find((c) => c.id === 'clubs')
  const stamps = [stamp(1, '2026-04-01')]
  const factsByPk = { 1: fact(1, { away: 138, home: 158 }) }
  const result = computeMilestoneProgress(clubs, stamps, factsByPk)
  assert.equal(result.count, 2)
  assert.equal(result.slots.find((s) => s.id === 138).filled, true)
  assert.equal(result.slots.find((s) => s.id === 158).filled, true)
})

test('parks collection: fills ONLY the home club\'s slot', () => {
  const parks = MILESTONE_COLLECTIONS.find((c) => c.id === 'parks')
  const stamps = [stamp(1, '2026-04-01')]
  const factsByPk = { 1: fact(1, { away: 138, home: 158 }) }
  const result = computeMilestoneProgress(parks, stamps, factsByPk)
  assert.equal(result.count, 1)
  assert.equal(result.slots.find((s) => s.id === 158).filled, true)
  assert.equal(result.slots.find((s) => s.id === 138).filled, false)
})

test('computeAllMilestones: one result per registered collection, in registry order', () => {
  const results = computeAllMilestones([], {})
  assert.deepEqual(results.map((r) => r.id), MILESTONE_COLLECTIONS.map((c) => c.id))
})

test('isMilestoneCollectionId', () => {
  assert.equal(isMilestoneCollectionId('clubs'), true)
  assert.equal(isMilestoneCollectionId('parks'), true)
  assert.equal(isMilestoneCollectionId('nope'), false)
  assert.equal(isMilestoneCollectionId(undefined), false)
})
