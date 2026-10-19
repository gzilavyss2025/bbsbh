// The Highlights module's pure view (src/screens/player/next/modules/highlights/highlightsView.js, #2022).
import test from 'node:test'
import assert from 'node:assert/strict'
import { highlightsView, clipsTag } from '../src/screens/player/next/modules/highlights/highlightsView.js'

const clip = (clipId, date, o = {}) => ({ clipId, date, gamePk: 1, playerId: 668930, title: `t${clipId}`, duration: '00:00:30', poster: 'p', ...o })
const ids = (v) => v.map((c) => c.clipId)
const view = (clips) => highlightsView({ clips, playerId: 668930, season: 2026 })

test('every kept clip, newest first, with a length and a short date', () => {
  const clips = Array.from({ length: 8 }, (_, i) => clip(i + 1, `2026-09-${String(10 + i).padStart(2, '0')}`))
  const v = view(clips)
  assert.deepEqual(ids(v), [8, 7, 6, 5, 4, 3, 2, 1])
  assert.equal(v[0].length, '0:30')
  assert.equal(v[0].when, 'Sep 17')
})

test('a clip dated today is kept: the page is open for a game played today (ADR-0117)', () => {
  assert.deepEqual(ids(view([clip(1, '2026-10-13'), clip(2, '2026-10-12')])), [1, 2])
})

test("another player's and another season's clips are dropped", () => {
  const v = view([clip(1, '2026-10-01', { playerId: 1 }), clip(2, '2025-10-01'), clip(3, '2026-10-01')])
  assert.deepEqual(ids(v), [3])
})

test('a missing length prints none and a missing title stays empty (the card shows the date only)', () => {
  const [c] = view([clip(1, '2026-10-01', { duration: '', title: '' })])
  assert.equal(c.length, '')
  assert.equal(c.title, '')
  assert.deepEqual(view([]), [])
})

test('the count tag is singular for one clip', () => {
  assert.equal(clipsTag(1), '1 clip')
  assert.equal(clipsTag(37), '37 clips')
})
