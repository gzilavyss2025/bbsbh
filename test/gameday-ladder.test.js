// Gameday's size ladder (#2568): window size -> tier -> blocks shown. The
// thresholds and the block table are Gary's locked round 2 calls.
import assert from 'node:assert/strict'
import test from 'node:test'
import { blocksFor, foldedFor, menuFor, tierOf } from '../src/lib/gameday/ladder.js'

const NEVER_FOLD = ['band', 'stage', 'hero', 'bar']

test('each tier at its round 1 size shows its blocks', () => {
  assert.deepEqual(blocksFor(tierOf(390, 763)), NEVER_FOLD)
  assert.deepEqual(blocksFor(tierOf(760, 1024)), [...NEVER_FOLD, 'navigator', 'trail'])
  assert.deepEqual(blocksFor(tierOf(1180, 820)), [...NEVER_FOLD, 'navigator', 'trail', 'battingOrder', 'reference'])
  assert.deepEqual(blocksFor(tierOf(1440, 900)), [
    ...NEVER_FOLD, 'navigator', 'trail', 'battingOrder', 'reference', 'eventLog',
  ])
})

test('the round 2 DEVICES table lands on the tier the Sizes tab shows', () => {
  const want = {
    'iPhone SE': [375, 553, 'P'], 'iPhone 15': [390, 763, 'P'], 'iPhone 15 Pro Max': [430, 839, 'P'],
    'iPad mini portrait': [744, 1133, 'T'], 'iPad 10th portrait': [820, 1180, 'T'],
    'iPad mini landscape': [1133, 744, 'L'], 'iPad Air 11 landscape': [1180, 820, 'L'],
    'Old iPad landscape': [1024, 768, 'L'], 'Laptop window': [1280, 720, 'L'],
    'MacBook Air 13': [1440, 790, 'D'], 'iPad Pro 13 landscape': [1376, 1032, 'D'], '1080p monitor': [1920, 1080, 'D'],
  }
  for (const [name, [w, h, tier]] of Object.entries(want)) assert.equal(tierOf(w, h), tier, name)
})

test('the never-fold set is in every tier', () => {
  for (const t of ['P', 'T', 'L', 'D']) for (const b of NEVER_FOLD) assert.ok(blocksFor(t).includes(b), `${t} ${b}`)
})

test('the menu folds what the tier does not show', () => {
  assert.deepEqual(foldedFor('P'), ['navigator', 'trail', 'battingOrder', 'reference', 'eventLog'])
  assert.deepEqual(foldedFor('D'), [])
})

// L and D draw the event log in the Menu even where the ladder shows it (the defense drawer
// takes its slot). L already folds it, so the Menu must not list it twice (a duplicate key, the
// panel drawn twice).
test('the menu lists each block once, with the event log on L and D', () => {
  for (const tier of ['P', 'T', 'L', 'D']) {
    const m = menuFor(tier)
    assert.equal(new Set(m).size, m.length, tier)
  }
  assert.ok(menuFor('L').includes('eventLog'))
  assert.ok(menuFor('D').includes('eventLog'))
  assert.deepEqual(menuFor('T'), foldedFor('T'))
})
