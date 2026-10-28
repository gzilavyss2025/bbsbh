import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { BALLPARK_SCENES } from '../src/screens/gameday/next/cutscene/ballpark/scenes.js'
import { drawEffects, hopOffset } from '../src/screens/gameday/next/cutscene/ballpark/effects.js'
import { celebrationForPlay } from '../src/screens/gameday/next/cutscene/integration/celebrationForPlay.js'
import { isolateFrames } from '../src/screens/gameday/next/cutscene/ballpark/atlas.js'

test('all five generated actions decode to six complete, isolated playback cells', async () => {
  const source = sharp(new URL('../public/art/ballpark/celebrations.png', import.meta.url).pathname)
  for (const id of ['rbi', 'grandSlam', 'multiRbi', 'homeRun', 'strikeout']) {
    const { character } = BALLPARK_SCENES[id]
    assert.equal(character.sourceCells.length, 6)
    for (const [left, top, width, height] of character.sourceCells) {
      const { data } = await source.clone().extract({ left, top, width, height }).raw().toBuffer({ resolveWithObject: true })
      const image = isolateFrames({ data, width, height }, 1, 1)
      let pixels = 0
      for (let i = 3; i < image.data.length; i += 4) if (image.data[i] >= 32) pixels++
      assert.ok(pixels > 7000, `${id} retains a full character, not a gutter fragment`)
    }
  }
})

test('RBI count selects the approved gesture without changing identity or headline', () => {
  const play = { about: { isComplete: true, halfInning: 'top' }, result: { eventType: 'double', event: 'Double', rbi: 2 }, matchup: { batter: { fullName: 'Batter' } } }
  assert.equal(celebrationForPlay(play).scene, 'multiRbi')
  assert.equal(celebrationForPlay(play).headline, '2-run Double')
  assert.equal(celebrationForPlay(play).name, 'Batter')
  play.result.rbi = 1
  assert.equal(celebrationForPlay(play).scene, 'rbi')
  play.result.rbi = 0
  assert.equal(celebrationForPlay(play), null)
})

test('hop leaves and returns to its baseline and reaches its authored apex', () => {
  const { hop } = BALLPARK_SCENES.multiRbi.track
  assert.equal(hopOffset(0, hop), 0)
  assert.equal(hopOffset(hop.start, hop), 0)
  assert.equal(hopOffset(hop.apex, hop), -hop.height)
  assert.equal(hopOffset(hop.end, hop), 0)
  assert.equal(hopOffset(99, hop), 0)
})

test('pixel effects are deterministic, finite and absent before their accent', () => {
  for (const id of ['rbi', 'grandSlam', 'multiRbi', 'homeRun', 'strikeout']) {
    const { track } = BALLPARK_SCENES[id]
    const calls = []
    const g = { save() {}, restore() {}, fillRect(...rect) { assert.ok(rect.every(Number.isFinite)); calls.push(rect) } }
    drawEffects(g, 0, track)
    assert.equal(calls.length, 0)
    drawEffects(g, track.accentAt + 0.2, track)
    const first = [...calls]
    assert.ok(first.length > 0, id)
    calls.length = 0
    drawEffects(g, track.accentAt + 0.2, track)
    assert.deepEqual(calls, first)
    calls.length = 0
    drawEffects(g, track.duration, track)
    assert.equal(calls.length, 0)
  }
})
