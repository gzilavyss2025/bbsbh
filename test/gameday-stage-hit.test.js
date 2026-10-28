import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spriteHitArea } from '../src/screens/gameday/next/stage/hitArea.js'

const inside = (p, polygon) => polygon.every((a, i) => {
  const b = polygon[(i + 1) % polygon.length]
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-8
})
test('packed sprite targets keep their own centers and give up their neighbors, at either display scale', () => {
  const sprites = [{ key: 'C', x: 100, y: 100 }, { key: 'batter', x: 90, y: 95 }, { key: 'P', x: 100, y: 78 }]
  for (const scale of [1, 2]) for (const size of [34, 44]) for (const sprite of sprites) {
    const polygon = spriteHitArea(sprite, sprites, size, scale), half = size / 2
    assert.ok(inside([half, half], polygon), sprite.key + ' keeps its center')
    for (const other of sprites.filter((p) => p.key !== sprite.key)) {
      assert.equal(inside([half + (other.x - sprite.x) * scale, half + (other.y - sprite.y) * scale], polygon), false)
    }
    assert.ok(polygon.flat().every((v) => v >= 0 && v <= size))
  }
})
test('a single sprite retains its full padded target', () => {
  const sprite = { key: 'CF', x: 10, y: 10 }
  assert.deepEqual(spriteHitArea(sprite, [sprite], 34), [[0, 0], [34, 0], [34, 34], [0, 34]])
})
