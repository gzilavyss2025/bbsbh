import { test } from 'node:test'
import assert from 'node:assert/strict'
import { batterPalette, recolorBatter } from '../src/screens/gameday/next/zonemap/batterPalette.js'
import { teamChipColors } from '../src/lib/teams.js'
import { NEUTRAL_FALLBACK_PAIR } from '../src/lib/brandColors.js'

test('the batter uses MLB and the minor club own brand, with a neutral unknown fallback', () => {
  assert.equal(batterPalette(136).equipment, teamChipColors(136).primary)
  assert.equal(batterPalette(234).jersey, teamChipColors(234).primary) // Durham, not parent Tampa Bay
  assert.notEqual(batterPalette(234).jersey, batterPalette(139).jersey)
  assert.equal(batterPalette(234).trim, teamChipColors(234).secondary)
  assert.equal(batterPalette(-1).equipment, NEUTRAL_FALLBACK_PAIR[0])
  assert.equal(batterPalette(136, { jersey: '#FFFFFF', pants: '#999999' }).jersey, '#FFFFFF')
})

test('material recoloring preserves bat, white gloves, trousers and transparency while retaining shading', () => {
  const image = { width: 10, height: 10, data: new Uint8ClampedArray(400) }
  const at = (x, y) => (y * image.width + x) * 4
  const set = (x, y, rgba) => image.data.set(rgba, at(x, y))
  const get = (x, y) => [...image.data.slice(at(x, y), at(x, y) + 4)]
  set(0, 1, [22, 38, 75, 255]) // equipment
  set(1, 1, [11, 19, 37, 255]) // its shadow
  set(2, 4, [224, 211, 190, 255]) // cream shirt
  set(3, 7, [224, 211, 190, 255]) // cream trousers
  set(4, 2, [211, 166, 52, 255]) // bat, above the uniform
  set(5, 6, [211, 166, 52, 255]) // uniform piping
  set(6, 4, [224, 225, 230, 255]) // white glove
  set(7, 4, [224, 211, 190, 0]) // transparent background
  recolorBatter(image, { equipment: '#CC2211', jersey: '#22AA33', trim: '#2255CC' })
  assert.ok(get(0, 1)[0] > get(0, 1)[1] * 3, 'equipment takes the red primary')
  assert.ok(get(0, 1)[0] > get(1, 1)[0], 'equipment keeps its original light and shadow')
  assert.ok(get(2, 4)[1] > get(2, 4)[0] * 3, 'the shirt can have an independent fabric color')
  assert.ok(get(5, 6)[2] > get(5, 6)[0] * 3, 'uniform piping takes the secondary')
  assert.deepEqual(get(3, 7), [224, 211, 190, 255])
  assert.deepEqual(get(4, 2), [211, 166, 52, 255])
  assert.deepEqual(get(6, 4), [224, 225, 230, 255])
  assert.deepEqual(get(7, 4), [224, 211, 190, 0])
  recolorBatter(image, { pants: '#777777' })
  assert.equal(get(3, 7)[0], get(3, 7)[1], 'trousers also support an explicit material override')
})
