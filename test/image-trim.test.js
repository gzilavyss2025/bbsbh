// The lab's "Trim and clear background" step for dropped era art
// (src/lib/image/imageTrim.js): pure pixel math, so the browser's canvas only
// supplies and takes back the RGBA bytes.
import assert from 'node:assert/strict'
import test from 'node:test'
import { trimAndClear } from '../src/lib/image/imageTrim.js'

// A w x h image of one colour, with `paint(x, y)` returning an [r,g,b,a] or null.
function image(w, h, paint, bg = [255, 255, 255, 255]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = paint(x, y) ?? bg
      data.set(px, (y * w + x) * 4)
    }
  }
  return { data, width: w, height: h }
}
const alphaAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3]
const RED = [200, 16, 46, 255]

test('white around a mark becomes transparent and the canvas is cropped to the mark', () => {
  const src = image(20, 20, (x, y) => (x >= 5 && x < 15 && y >= 8 && y < 12 ? RED : null))
  const out = trimAndClear(src, { padding: 0 })
  assert.equal(out.width, 10)
  assert.equal(out.height, 4)
  assert.equal(alphaAt(out, 0, 0), 255)
})

test('white INSIDE the mark stays opaque: only background connected to the edge is cleared', () => {
  // A red ring around a white centre.
  const src = image(20, 20, (x, y) => {
    const ring = x >= 4 && x < 16 && y >= 4 && y < 16
    const hole = x >= 8 && x < 12 && y >= 8 && y < 12
    return ring && !hole ? RED : null
  })
  const out = trimAndClear(src, { padding: 0 })
  assert.equal(out.width, 12)
  assert.equal(alphaAt(out, 6, 6), 255, 'the white centre is part of the mark')
  assert.equal(alphaAt(out, 0, 0), 255)
})

test('padding adds a transparent margin on every side', () => {
  const src = image(20, 20, (x, y) => (x >= 5 && x < 15 && y >= 5 && y < 15 ? RED : null))
  const out = trimAndClear(src, { padding: 2 })
  assert.equal(out.width, 14)
  assert.equal(alphaAt(out, 0, 0), 0)
  assert.equal(alphaAt(out, 2, 2), 255)
})

test('an image that is already transparent keeps its alpha and is just cropped', () => {
  const src = image(10, 10, (x, y) => (x === 4 && y === 4 ? RED : [0, 0, 0, 0]), [0, 0, 0, 0])
  const out = trimAndClear(src, { padding: 0 })
  assert.equal(out.width, 1)
  assert.equal(out.height, 1)
})

test('an image with nothing but background gives back null, not a zero-size canvas', () => {
  assert.equal(trimAndClear(image(5, 5, () => null)), null)
})

test('near-white (JPEG fringe) is cleared too, a dark mark is not', () => {
  const src = image(10, 10, (x, y) => (x === 0 ? [250, 250, 250, 255] : x >= 3 && x < 7 ? [20, 20, 20, 255] : null))
  const out = trimAndClear(src, { padding: 0 })
  assert.equal(out.width, 4)
})
