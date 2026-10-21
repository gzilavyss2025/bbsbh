// The park window (Gary, 2026-10-21: "too much white space above center field"). Every park is
// drawn at one scale, a foot to a unit, in a frame sized for the deepest wall on file, so a
// typical park left a band of empty sky above its center-field sign. Each card now crops the
// frame to just above its own park's highest mark: the same scale, never a rescale, only less
// sky. lib/ballpark/layout/parkWindow.js is the one window every park card reads.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parkWindow, skyTop, SKY_PAD } from '../src/lib/ballpark/layout/parkWindow.js'
import { allBallparkLayouts, resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { buildFieldGeometry, diagramInput, VIEWBOX, wallStroke } from '../src/lib/ballpark/ballparkGeometry.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const SIGN_HALF = 10
const topOf = (w) => Number(w.viewBox.split(' ')[1])

// The highest mark the drawing makes: a distance sign's upper half, or the wall's outer edge.
function highestMark(layout) {
  const g = buildFieldGeometry(diagramInput(layout))
  const ys = g.labels.map((l) => l.y - SIGN_HALF)
  for (const s of g.fenceSegs) {
    for (const m of s.d.matchAll(/[ML]\s*-?[\d.]+\s+(-?[\d.]+)/g)) ys.push(Number(m[1]) - wallStroke(s.h) / 2)
  }
  return Math.min(...ys)
}

test('every park: the window starts just above its highest mark, so nothing is cut and no sky is left', () => {
  for (const layout of allBallparkLayouts()) {
    if (layout.quality.fence === 'missing') continue
    const top = topOf(parkWindow(layout))
    const mark = highestMark(layout)
    assert.ok(top <= mark, `${layout.configurationId}: window ${top} cuts a mark at ${mark}`)
    assert.ok(mark - top <= SKY_PAD + 1, `${layout.configurationId}: ${mark - top} units of sky left`)
  }
})

test('the window never rescales: a foot is still a unit, and the bottom of the frame stays', () => {
  const brewers = resolveBallparkLayout({ venueId: 32, gameDate: '2026-07-01' })
  const w = parkWindow(brewers)
  const [x, y, width, height] = w.viewBox.split(' ').map(Number)
  assert.equal(x, 0)
  assert.equal(width, VIEWBOX.w)
  assert.equal(y + height, VIEWBOX.h)
  assert.equal(w.aspectRatio, `${VIEWBOX.w} / ${height}`)
  assert.deepEqual(w.percent({ x: 0, y }), { left: 0, top: 0 })
  assert.deepEqual(w.percent({ x: VIEWBOX.w, y: VIEWBOX.h }), { left: 100, top: 100 })
})

test('a narrower window keeps its sides and still trims the sky', () => {
  const brewers = resolveBallparkLayout({ venueId: 32, gameDate: '2026-07-01' })
  const w = parkWindow(brewers, { x: 30, w: 560 })
  const [x, y, width] = w.viewBox.split(' ').map(Number)
  assert.equal(x, 30)
  assert.equal(width, 560)
  assert.equal(y, skyTop(brewers))
  assert.deepEqual(w.percent({ x: 30, y }), { left: 0, top: 0 })
})

test('a deep park still stands taller than a shallow one', () => {
  // Same scale: the deeper wall needs more frame, so its window starts higher.
  const deep = skyTop(resolveBallparkLayout({ venueId: 2392, gameDate: '2026-07-01' })) // Daikin Park
  const shallow = skyTop(resolveBallparkLayout({ venueId: 32, gameDate: '2026-07-01' })) // American Family Field
  assert.ok(deep < shallow, `deep ${deep} vs shallow ${shallow}`)
})

test('every park card reads the one window', () => {
  // The drawing's own default (the ballpark card, the park sheet, the modal, Park Fit).
  assert.match(read('components/ballpark/BallparkDiagram.jsx'), /parkWindow\(layout\)/)
  // The two defense cards, through defenseWindow.
  assert.match(read('lib/ballpark/layout/defenseWindow.js'), /parkWindow\(layout\)/)
  assert.match(read('screens/lineup/next/cards/FieldCard.jsx'), /defenseWindow\(layout\)/)
  assert.doesNotMatch(read('screens/lineup/next/cards/FieldCard.jsx'), /PLOT_VIEWBOX/)
  // The player page's innings art, at its own width.
  assert.match(read('screens/player/next/modules/innings/inningsView.js'), /parkWindow\(/)
  assert.doesNotMatch(read('screens/player/next/modules/innings/inningsView.js'), /PARK_VIEWBOX = /)
})
