// The innings page's Field tab draws the defense on the park the game is played in (it used to
// draw one generic diamond for every park). Two pins: the tab hands the diamond the park's
// layout, and every fielder's spot sits inside the cropped plot window it is laid over.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { plotPercent } from '../src/lib/ballpark/ballparkGeometry.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')

test('DefenseSection resolves the venue layout and passes it to the diamond', () => {
  const s = read('components/inning/EnteringReference.jsx')
  assert.match(s, /resolveBallparkLayout\(\{ venueId: venue\?\.id, venueName: venue\?\.name/)
  assert.match(s, /<DefenseDiamond defense=\{defense\} layout=\{layout\}/)
})

test('every park spot lands inside the plot window with room for its label', () => {
  const block = read('components/scoring/DefenseDiamond.jsx').match(/const PARK_SPOTS = \{([\s\S]*?)\n\}/)[1]
  const spots = [...block.matchAll(/'?(\w+)'?: \{ x: (\d+), y: (\d+) \}/g)]
  assert.equal(spots.length, 8)
  for (const [, pos, x, y] of spots) {
    const { left, top } = plotPercent({ x: Number(x), y: Number(y) })
    assert.ok(left > 10 && left < 90, `${pos} left ${left}`)
    assert.ok(top > 5 && top < 95, `${pos} top ${top}`)
  }
})
