// Unit coverage for src/api/logbookMilestones.js — the Game Log retrospective's
// milestone/collection-progress shelf (docs/design-inspiration.md §8).
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MILESTONE_COLLECTIONS,
  computeAllMilestones,
  computeMilestoneProgress,
  isMilestoneCollectionId,
  rosterFor,
} from '../src/api/logbookMilestones.js'

// --------------------------------------------------------------------------
// The generic engine, exercised against a small synthetic collection so a
// test doesn't need 30 real stamps to reach `complete: true`.
// --------------------------------------------------------------------------
const THREE_SLOT_COLLECTION = {
  id: 'trio',
  title: 'Trio',
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

// --------------------------------------------------------------------------
// The roster — a level's own slot list, off the weekly static team snapshot
// (api/teams-static.js). What makes the two collections describe MLB, AAA,
// AA, A+ and A rather than only the 30 MLB clubs.
// --------------------------------------------------------------------------
const SNAPSHOT = {
  bySportId: {
    // sportId keys are STRINGS in the real file — assert against that shape,
    // not a friendlier one.
    '11': [
      { id: 512, teamName: 'Mud Hens', name: 'Toledo Mud Hens', venueName: 'Fifth Third Field' },
      { id: 226, teamName: 'Aviators', name: 'Las Vegas Aviators', venueName: 'Las Vegas Ballpark' },
    ],
  },
}

test('rosterFor: shapes a minor level off the snapshot, alphabetical by label', () => {
  const roster = rosterFor(SNAPSHOT, 11)
  assert.deepEqual(roster.map((r) => r.label), ['Aviators', 'Mud Hens'])
  assert.equal(roster.find((r) => r.id === 512).venueName, 'Fifth Third Field')
})

test('rosterFor: MLB prefers the short club name the app already uses', () => {
  const roster = rosterFor({ bySportId: { '1': [{ id: 158, teamName: 'Nope', venueName: 'American Family Field' }] } }, 1)
  assert.deepEqual(roster, [{ id: 158, label: 'Brewers', venueName: 'American Family Field' }])
})

test('rosterFor: no snapshot falls back to the 30 MLB clubs for sportId 1', () => {
  assert.equal(rosterFor(undefined, 1).length, 30)
  assert.equal(rosterFor({ bySportId: {} }, 1).length, 30)
})

test('rosterFor: no snapshot means an EMPTY minor level, never the MLB list', () => {
  assert.deepEqual(rosterFor(undefined, 11), [])
  assert.deepEqual(rosterFor({ bySportId: {} }, 14), [])
})

test('a roster narrows the slots, and its venue names ride along onto them', () => {
  const parks = MILESTONE_COLLECTIONS.find((c) => c.id === 'parks')
  const roster = rosterFor(SNAPSHOT, 11)
  const stamps = [stamp(1, '2026-04-01')]
  const factsByPk = { 1: fact(1, { away: 226, home: 512 }) }
  const result = computeMilestoneProgress(parks, stamps, factsByPk, roster)
  assert.equal(result.total, 2)
  assert.equal(result.count, 1)
  const toledo = result.slots.find((s) => s.id === 512)
  assert.equal(toledo.filled, true)
  assert.equal(toledo.venueName, 'Fifth Third Field')
})

// The regression this pins: `count` used to be the number of ids any stamp
// filled, which is not the same thing as the number of SLOTS filled. A stamp
// at a level other than the one on screen fills ids that are in no slot here,
// and counting those reported "31 of 30" off a single Mud Hens game.
test('count and complete ignore ids that are not slots at this level', () => {
  const clubs = MILESTONE_COLLECTIONS.find((c) => c.id === 'clubs')
  const roster = rosterFor(SNAPSHOT, 11)
  const stamps = [stamp(1, '2026-04-01'), stamp(2, '2026-04-02')]
  const factsByPk = {
    1: fact(1, { away: 226, home: 512 }), // both AAA — both are slots
    2: fact(2, { away: 138, home: 158 }), // both MLB — neither is a slot here
  }
  const result = computeMilestoneProgress(clubs, stamps, factsByPk, roster)
  assert.equal(result.total, 2)
  assert.equal(result.count, 2)
  assert.equal(result.complete, true)
})

test('computeAllMilestones: passes the roster through to every collection', () => {
  const roster = rosterFor(SNAPSHOT, 11)
  for (const result of computeAllMilestones([], {}, roster)) {
    assert.equal(result.total, 2)
  }
})
