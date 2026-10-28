import test from 'node:test'
import assert from 'node:assert/strict'
import { renderSprite, poses } from '../tools/player-sprites/template.mjs'

test('all six poses export at both supported body extremes', () => {
  assert.equal(Object.keys(poses).length, 6)
  for (const pose of Object.keys(poses)) {
    for (const heightInches of [54, 84]) for (const weightPounds of [100, 350]) {
      const svg = renderSprite({ heightInches, weightPounds }, pose)
      assert.ok(svg.includes('viewBox="0 0 192 256"'))
      assert.ok(!/NaN|undefined|Infinity/.test(svg))
    }
  }
})

test('uniform overrides and joint adjustments reach exported artwork', () => {
  const svg = renderSprite({ colors: { jersey: '#123456', gear: '#abcdef' }, poses: { catcher: { glove: [41, 112] } } }, 'catcher')
  assert.ok(svg.includes('fill="#123456"'))
  assert.ok(svg.includes('fill="#abcdef"'))
  assert.ok(svg.includes('cx="41" cy="112"'))
  assert.ok(renderSprite({}, 'bat-left').includes('translate(160 0) scale(-1 1)'))
  assert.ok(!renderSprite({}, 'bat-right').includes('translate(160 0) scale(-1 1)'))
})

test('invalid colors, dimensions, poses and joint coordinates are rejected', () => {
  assert.throws(() => renderSprite({ colors: { jersey: '\"/><script>' } }))
  assert.throws(() => renderSprite({ heightInches: 90 }))
  assert.throws(() => renderSprite({ weightPounds: 'bad' }))
  assert.throws(() => renderSprite({}, 'unknown'))
  assert.throws(() => renderSprite({ poses: { pitcher: { arms: [[1,2]] } } }, 'pitcher'))
})
