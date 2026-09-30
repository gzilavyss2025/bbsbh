// The reader's own unlock of the day's live scores moves the bracket (Gary,
// 2026-09-30). `live` counts the cutoff day's Finals; without it the bracket
// still shows the state heading into the day.
import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { results, seriesWith, skeleton, winsOf } from './fixtures.js'

const at = (cutoff, live) => deriveBracket(skeleton(2025), results(2025), cutoff, { live })

test('live: MIL beat CHC in NLDS Game 1 on 2025-10-04, so the pips move that day', () => {
  assert.equal(winsOf(seriesWith(at('2025-10-04', false), 'NL', 'division', 'MIL')), 'CHC 0, MIL 0')
  const live = seriesWith(at('2025-10-04', true), 'NL', 'division', 'MIL')
  assert.equal(winsOf(live), 'CHC 0, MIL 1')
  assert.equal(live.playsOnCutoff, true, 'the series still has its ticket on the day')
})

test('live: a series that ends on the cutoff day is decided and its winner advances', () => {
  const b = at('2025-10-01', true)
  const decided = b.leagues.NL.wildcard.filter((s) => s.decided)
  assert.ok(decided.length > 0)
  for (const s of decided) {
    assert.equal(s.playsOnCutoff, true)
    const next = b.series.find((x) => x.key === s.feeds)
    assert.ok(next.slots.some((slot) => slot.club?.id === s.winner.id), 'the winner fills the next round')
  }
  const plain = at('2025-10-01', false)
  assert.ok(plain.leagues.NL.wildcard.every((s) => !s.decided), 'without live, nothing is decided yet')
})
