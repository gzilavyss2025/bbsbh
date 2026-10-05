// The Matchup Scout's playId reader (#1490): Savant's at_bat_number and
// pitch_number to the statsapi playId, and the cutoff the fetch holds.
//
// Fixture: the real play-by-play of gamePk 776222 (Pivetta vs Chourio,
// 2025-09-22), pruned by the module's own `fields=` list. The expected ids are
// the ones pull-data.mjs matched (.scratch/scout-polish/).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PLAY_ID_FIELDS, fetchPlayIds, mayRead, playIdFor, playIdsFrom } from '../src/api/scout/playIds.js'

const FEED = JSON.parse(readFileSync(new URL('./fixtures/scout/playids-776222.json', import.meta.url), 'utf8'))

test('at_bat_number is atBatIndex + 1, and pitch_number is the nth isPitch event', () => {
  const ids = playIdsFrom(FEED)
  // Chourio's first plate appearance: Savant at_bat_number 2, three pitches.
  assert.deepEqual(ids.get(2), [
    '9cd06a58-d994-39f0-972a-cd12cc850e46',
    '298499dc-3271-3e88-a917-fe85cabdd010',
    '4801cb3b-c786-3eea-a4c5-08daf51e8e5e',
  ])
  assert.equal(playIdFor(ids, 2, 2), '298499dc-3271-3e88-a917-fe85cabdd010')
  // His other two: five pitches and four.
  assert.equal(ids.get(21).length, 5)
  assert.equal(ids.get(36).length, 4)
  // A pickoff or a mound visit is not a pitch, so it takes no slot.
  const first = FEED.allPlays.find((p) => p.about.atBatIndex === 0)
  assert.ok(first.playEvents.some((e) => !e.isPitch))
  assert.equal(ids.get(1).length, first.playEvents.filter((e) => e.isPitch).length)
})

test('a pitch past the list, or a game with no ids, is null', () => {
  const ids = playIdsFrom(FEED)
  assert.equal(playIdFor(ids, 2, 4), null)
  assert.equal(playIdFor(ids, 999, 1), null)
  assert.equal(playIdFor(null, 2, 1), null)
  assert.deepEqual([...playIdsFrom({}).keys()], [])
})

test('the request asks for the four fields and no score', () => {
  assert.equal(PLAY_ID_FIELDS, 'allPlays,about,atBatIndex,playEvents,isPitch,playId')
  assert.ok(!/score|result|count|description/i.test(PLAY_ID_FIELDS))
})

test('only a game strictly before the cutoff and before today may be read', () => {
  assert.equal(mayRead('2025-09-22', '2026-10-05', '2026-10-05'), true)
  assert.equal(mayRead('2026-10-05', '2026-10-06', '2026-10-05'), false) // today
  assert.equal(mayRead('2026-09-30', '2026-09-30', '2026-10-05'), false) // the cutoff day
  assert.equal(mayRead('2026-09-30', 'garbled', '2026-10-05'), false)
})

test('fetchPlayIds asks once per game, and never for a game on or after the cutoff', async () => {
  const calls = []
  const get = async (path) => {
    calls.push(path)
    return FEED
  }
  assert.equal(await fetchPlayIds(776222, '2025-09-22', '2025-09-22', { get }), null)
  assert.equal(calls.length, 0)
  const [a, b] = await Promise.all([
    fetchPlayIds(776222, '2025-09-22', '2026-10-01', { get }),
    fetchPlayIds(776222, '2025-09-22', '2026-10-01', { get }),
  ])
  assert.equal(calls.length, 1)
  assert.equal(calls[0], `/api/v1/game/776222/playByPlay?fields=${PLAY_ID_FIELDS}`)
  assert.equal(a, b)
  assert.equal(playIdFor(a, 2, 1), '9cd06a58-d994-39f0-972a-cd12cc850e46')
})

test('a failed request is null and is not cached', async () => {
  const realError = console.error
  console.error = () => {}
  try {
    let n = 0
    const get = async () => {
      n += 1
      if (n === 1) throw new Error('down')
      return FEED
    }
    assert.equal(await fetchPlayIds(111, '2025-09-22', '2026-10-01', { get }), null)
    assert.ok((await fetchPlayIds(111, '2025-09-22', '2026-10-01', { get })).get(2))
    assert.equal(n, 2)
  } finally {
    console.error = realError
  }
})
