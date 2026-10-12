// Overlay alignment (#1859): the marks a card plots and the park it plots them
// on must agree. Three layers, each a separate way to drift:
//
//   1. THE FRAME. Hit coordinates go through hitCoordToSvg (its own empirical
//      origin and 2.51 ft/unit, pinned in test/hitchart.test.js); the field is
//      drawn by ballparkGeometry.js in feet, 1:1, off HOME. The two must put
//      "d feet out at bearing θ" on the same SVG point, with left field on the
//      left and center field up the screen.
//   2. REAL BALLS ON REAL WALLS. The two calibrations are separate on purpose
//      (the issue says so: the projection is fitted to the feed's distances,
//      the outlines to Savant's walls). So the end-to-end check is on real
//      games: test/fixtures/overlay-alignment-2026.json holds every home run
//      and every caught fly ball or line drive of three June 2026 home games at
//      each of eight parks (built by .scratch/overlay-alignment/build.mjs).
//      Every home run must land beyond the wall the layout draws; caught balls
//      must not. Measured when the fixture was built: home runs land 12 to 104
//      ft beyond (median 39), and 3 of 292 caught balls inside ±44° land more
//      than 10 ft past the wall, the farthest 21 (a catch at the wall is a few
//      feet out; a wall drawn 4% too large, as the 2018 traces were, would pull
//      the nearest home runs back inside it).
//   3. HTML OVER THE SVG. The hit chart lays its dot numbers over the cropped
//      plot window in percentages; plotPercent must land them where the SVG
//      puts the dot.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  HOME, VIEWBOX, PLOT_SKY_CROP, PLOT_VIEWBOX, buildFieldGeometry, diagramInput, plotPercent,
} from '../src/lib/ballpark/ballparkGeometry.js'
import { hitCoordToSvg, HIT_COORD_ORIGIN, HIT_COORD_FT_PER_UNIT } from '../src/lib/ballpark/hitProjection.js'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { clipToFoulLines } from '../src/lib/ballpark/layout/fenceShape.js'
import { fenceDistanceAt } from '../src/lib/ballpark/layout/fenceAudit.js'

const SAMPLE = JSON.parse(readFileSync(new URL('./fixtures/overlay-alignment-2026.json', import.meta.url), 'utf8'))

// The Gameday coordinate of a ball `ft` feet out at bearing `deg` (0 = center,
// negative toward left field), inverted through the projection's own constants.
const coordAt = (deg, ft) => {
  const rad = (deg * Math.PI) / 180
  return [
    HIT_COORD_ORIGIN.x + (ft * Math.sin(rad)) / HIT_COORD_FT_PER_UNIT,
    HIT_COORD_ORIGIN.y - (ft * Math.cos(rad)) / HIT_COORD_FT_PER_UNIT,
  ]
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`)

test('a ball d feet out plots on the field drawing’s own d-foot point', () => {
  for (const deg of [-45, -30, -15, 0, 15, 30, 45]) {
    for (const ft of [90, 250, 400]) {
      const p = hitCoordToSvg(...coordAt(deg, ft))
      const rad = (deg * Math.PI) / 180
      // The drawing's frame: feet 1:1 off HOME, +x toward right field, up = center.
      near(p.x, HOME.x + ft * Math.sin(rad), 0.15, `x at ${deg}°, ${ft} ft`)
      near(p.y, HOME.y - ft * Math.cos(rad), 0.15, `y at ${deg}°, ${ft} ft`)
    }
  }
})

test('a ball at the pole lands on the end of the drawn foul line', () => {
  const layout = resolveBallparkLayout({ venueId: 3, gameDate: '2026-07-01' })
  const g = buildFieldGeometry(diagramInput(layout))
  for (const [deg, path] of [[-45, g.foulLineL], [45, g.foulLineR]]) {
    const [ex, ey] = path.match(/L (-?[\d.]+) (-?[\d.]+)$/).slice(1).map(Number)
    const ft = Math.hypot(ex - HOME.x, HOME.y - ey)
    const p = hitCoordToSvg(...coordAt(deg, ft))
    near(p.x, ex, 0.2, `${deg < 0 ? 'LF' : 'RF'} pole x`)
    near(p.y, ey, 0.2, `${deg < 0 ? 'LF' : 'RF'} pole y`)
  }
})

// How far a plotted ball sits beyond (+) or inside (−) the wall its layout
// draws, at its own bearing, in feet. Null outside ±44° (a pole's wall is
// carried onto the line by construction) or with no drawn outline.
function marginOf([, venueId, date, coordX, coordY]) {
  const layout = resolveBallparkLayout({ venueId, gameDate: date })
  if (!layout?.geometry.fence) return null
  const p = hitCoordToSvg(coordX, coordY)
  const x = p.x - HOME.x
  const y = HOME.y - p.y
  const deg = (Math.atan2(x, y) * 180) / Math.PI
  if (Math.abs(deg) > 44) return null
  return Math.hypot(x, y) - fenceDistanceAt(clipToFoulLines(layout.geometry.fence), deg)
}

test('every home run in the sample lands beyond the wall its park draws', () => {
  const margins = SAMPLE.hr.map((row) => [row, marginOf(row)]).filter(([, m]) => m != null)
  assert.ok(margins.length >= 40, `enough home runs to mean something (${margins.length})`)
  for (const [row, m] of margins) assert.ok(m > 0, `gamePk ${row[0]} home run plots ${m.toFixed(1)} ft inside the wall`)
})

test('caught balls stay inside the wall, give or take a catch at it', () => {
  const margins = SAMPLE.out.map(marginOf).filter((m) => m != null)
  assert.ok(margins.length >= 250, `enough caught balls (${margins.length})`)
  const far = margins.filter((m) => m > 10)
  assert.ok(far.length / margins.length <= 0.02, `${far.length} of ${margins.length} catches plot more than 10 ft past the wall`)
  assert.ok(Math.max(...margins) <= 25, `a catch plots ${Math.max(...margins).toFixed(1)} ft past the wall`)
})

test('an HTML label lands where the SVG puts the mark, under the cropped window', () => {
  const [minX, minY, w, h] = PLOT_VIEWBOX.split(' ').map(Number)
  assert.deepEqual([minX, minY, w, h], [0, PLOT_SKY_CROP, VIEWBOX.w, VIEWBOX.h - PLOT_SKY_CROP])
  // The window's corners are 0% and 100%; any point maps back through the viewBox.
  assert.deepEqual(plotPercent({ x: 0, y: PLOT_SKY_CROP }), { left: 0, top: 0 })
  assert.deepEqual(plotPercent({ x: VIEWBOX.w, y: VIEWBOX.h }), { left: 100, top: 100 })
  for (const p of [HOME, hitCoordToSvg(...coordAt(-30, 330)), hitCoordToSvg(...coordAt(20, 410))]) {
    const at = plotPercent(p)
    near(minX + (at.left / 100) * w, p.x, 1e-9, 'x round trip')
    near(minY + (at.top / 100) * h, p.y, 1e-9, 'y round trip')
  }
})
