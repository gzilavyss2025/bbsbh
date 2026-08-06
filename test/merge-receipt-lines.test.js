// The merge receipt's line rules (src/lib/account/mergeReceiptFlag.js).
//
// PRD §5.3: counts of the user's own things, never a game, never a matchup,
// never a score (invariant P10) — and a channel that is `unavailable` has its
// line OMITTED rather than shown as zero, because "a zero is a claim; an
// omission is not."
//
// The case these tests exist for is the one phase 5's audit caught: every count
// is read from LOCAL storage, so a line drawn without checking its channel
// asserts a merge that never happened. On a Clerk-configured deploy with no
// Redis — the supported 501 degrade, PRD §1.3 — the card must render NOTHING,
// because dismissing it burns the one-shot flag and the real receipt could then
// never appear.
import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeReceiptLines } from '../src/lib/account/mergeReceiptFlag.js'

const COUNTS = { stamps: 12, games: 8, days: 3 }

const statusOf = (phase) => ({
  reveal: { phase },
  spoiledDays: { phase },
  stamps: { phase },
  prefs: { phase },
})

test('every channel synced draws every line it has a count for', () => {
  const lines = mergeReceiptLines({
    status: statusOf('synced'),
    counts: COUNTS,
    clubName: 'Brewers',
  })
  assert.deepEqual(lines.map((l) => l.id), ['stamps', 'games', 'days', 'club'])
  assert.deepEqual(lines.map((l) => l.text), [
    '12 stamps',
    '8 games in progress',
    "3 days you'd already unsealed",
    'Brewers',
  ])
})

test('a store-less deployment draws NOTHING — not even the locally-counted games line', () => {
  for (const phase of ['unavailable', 'error', 'local', 'off', 'pulling']) {
    const lines = mergeReceiptLines({
      status: statusOf(phase),
      counts: COUNTS,
      clubName: 'Brewers',
    })
    assert.deepEqual(lines, [], `${phase} must not claim a merge`)
  }
})

test('each line is gated on its OWN channel, not on the rollup', () => {
  const status = {
    ...statusOf('synced'),
    stamps: { phase: 'unavailable' },
    reveal: { phase: 'error' },
  }
  const lines = mergeReceiptLines({ status, counts: COUNTS, clubName: 'Brewers' })
  assert.deepEqual(lines.map((l) => l.id), ['days', 'club'])
})

test('a synced channel with a zero count draws no line either', () => {
  const lines = mergeReceiptLines({
    status: statusOf('synced'),
    counts: { stamps: 0, games: 0, days: 0 },
    clubName: '',
  })
  assert.deepEqual(lines, [])
})

test('singulars read as singulars', () => {
  const lines = mergeReceiptLines({
    status: statusOf('synced'),
    counts: { stamps: 1, games: 1, days: 1 },
    clubName: '',
  })
  assert.deepEqual(lines.map((l) => l.text), [
    '1 stamp',
    '1 game in progress',
    "1 day you'd already unsealed",
  ])
})

test('a missing or malformed status claims nothing rather than throwing', () => {
  assert.deepEqual(mergeReceiptLines({ counts: COUNTS, clubName: 'Brewers' }), [])
  assert.deepEqual(mergeReceiptLines({ status: null, counts: null, clubName: null }), [])
  assert.deepEqual(mergeReceiptLines({}), [])
})
