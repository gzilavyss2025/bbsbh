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
import { parkWindow, SKY_PAD } from '../src/lib/ballpark/layout/parkWindow.js'
import { allBallparkLayouts, resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { buildFieldGeometry, diagramInput, LABEL_HALF, VIEWBOX } from '../src/lib/ballpark/ballparkGeometry.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const topOf = (w) => Number(w.viewBox.split(' ')[1])

test('a distance sign fits the half-height the window allows it', () => {
  // .bpdiagram__dist is set at --fs-title-sm; one CSS px is one unit of the drawing's frame.
  const px = Number(read('tokens/typography.css').match(/--fs-title-sm:\s*(\d+)px/)[1])
  assert.match(read('styles/39-manager-page.css'), /\.bpdiagram__dist \{[^}]*font-size: var\(--fs-title-sm\)/)
  assert.ok(LABEL_HALF >= px / 2, `LABEL_HALF ${LABEL_HALF} under half of ${px}`)
})

test('every park: the window starts just above its highest mark, so nothing is cut and no sky is left', () => {
  for (const layout of allBallparkLayouts()) {
    if (layout.quality.fence === 'missing') continue
    const g = buildFieldGeometry(diagramInput(layout))
    const top = topOf(parkWindow(layout))
    for (const l of g.labels) assert.ok(l.y - LABEL_HALF >= top, `${layout.configurationId}: sign at ${l.y} cut at ${top}`)
    assert.ok(g.top >= top, `${layout.configurationId}: the wall's top ${g.top} cut at ${top}`)
    assert.ok(g.top - top <= SKY_PAD + 1, `${layout.configurationId}: ${g.top - top} units of sky left`)
  }
})

test('the window never rescales: a foot is still a unit, and the bottom of the frame stays', () => {
  const w = parkWindow(resolveBallparkLayout({ venueId: 32, gameDate: '2026-07-01' }))
  const [x, y, width, height] = w.viewBox.split(' ').map(Number)
  assert.equal(x, 0)
  assert.equal(width, VIEWBOX.w)
  assert.equal(y + height, VIEWBOX.h)
  assert.equal(w.aspectRatio, `${VIEWBOX.w} / ${height}`)
  assert.deepEqual(w.percent({ x: 0, y }), { left: 0, top: 0 })
  assert.deepEqual(w.percent({ x: VIEWBOX.w, y: VIEWBOX.h }), { left: 100, top: 100 })
})

test('a narrower window keeps its sides and the same trim; a built geometry gives the same window', () => {
  const brewers = resolveBallparkLayout({ venueId: 32, gameDate: '2026-07-01' })
  const full = parkWindow(brewers)
  const w = parkWindow(brewers, { x: 30, w: 560 })
  const [x, y, width] = w.viewBox.split(' ').map(Number)
  assert.equal(x, 30)
  assert.equal(width, 560)
  assert.equal(y, topOf(full))
  assert.deepEqual(w.percent({ x: 30, y }), { left: 0, top: 0 })
  assert.equal(parkWindow(brewers, { geometry: buildFieldGeometry(diagramInput(brewers)) }).viewBox, full.viewBox)
})

test('a deep park still stands taller than a shallow one', () => {
  // Same scale: the deeper wall needs more frame, so its window starts higher.
  const deep = topOf(parkWindow(resolveBallparkLayout({ venueId: 2392, gameDate: '2026-07-01' }))) // Daikin Park
  const shallow = topOf(parkWindow(resolveBallparkLayout({ venueId: 32, gameDate: '2026-07-01' }))) // American Family Field
  assert.ok(deep < shallow, `deep ${deep} vs shallow ${shallow}`)
})

test('every park card reads the one window', () => {
  // The drawing's own default (the ballpark card, the park sheet, the modal, Park Fit).
  assert.match(read('components/ballpark/BallparkDiagram.jsx'), /viewBox \?\? parkWindow\(/)
  for (const card of ['components/scoring/DefenseDiamond.jsx', 'screens/lineup/next/cards/FieldCard.jsx']) {
    assert.match(read(card), /parkWindow\(layout\)/, card)
    assert.doesNotMatch(read(card), /PLOT_VIEWBOX/, card)
  }
  // The player page's innings art, at its own width.
  assert.match(read('screens/player/next/modules/innings/inningsView.js'), /parkWindow\(park, \{ x: 30, w: 560 \}\)/)
})
