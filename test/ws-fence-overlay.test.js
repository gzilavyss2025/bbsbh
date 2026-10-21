// The Park fit card's fence overlay (2026-10-21): two parks' walls in one frame. The geometry that needs
// both parks at once: one window, and which distance signs step aside for each other.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overlayLabels, overlayWindow } from '../src/lib/postseason/worldseries/scouting/fenceOverlay.js'
import { geometryOf, parkWindow } from '../src/lib/ballpark/layout/parkWindow.js'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'

const DAY = '2026-10-22'
const MIL = resolveBallparkLayout({ venueId: 32, gameDate: DAY })
const TB = resolveBallparkLayout({ venueId: 12, gameDate: DAY })

// A park drawn from five posted distances (no outline), so a case does not depend on any real park's data.
const park = (lf, cf, rf) => ({
  measurements: { dist: { lf, lc: (lf + cf) / 2, cf, rc: (cf + rf) / 2, rf }, wall: { lf: 8, cf: 8, rf: 8 }, measured: null },
  geometry: { fence: null, cfMarkerAngle: 0 },
})
const slot = (signs, k) => signs.find((s) => s.slot === k)
const moved = (s) => s.dx !== 0 || s.dy !== 0
// The signs after the move, for a two-park view.
const at = (s) => ({ x: s.x + s.dx, y: s.y + s.dy })

test('the window is the highest mark of either park, at the same scale', () => {
  const w = overlayWindow([TB, MIL])
  const top = (win) => Number(win.viewBox.split(' ')[1])
  assert.equal(top(w), Math.min(top(parkWindow(TB)), top(parkWindow(MIL))))
  // The frame keeps its width and its bottom: only the sky above the highest mark is cut.
  assert.equal(w.viewBox.split(' ').slice(2).length, 2)
  assert.equal(w.viewBox.split(' ')[2], parkWindow(MIL).viewBox.split(' ')[2])
  // One park: the same window as the park's own.
  assert.equal(overlayWindow([MIL]).viewBox, parkWindow(MIL).viewBox)
})

test('each park has its three signs, in slot order, standing where the single-park drawing puts them', () => {
  const [a, b] = overlayLabels([TB, MIL])
  for (const [signs, layout] of [[a, TB], [b, MIL]]) {
    assert.deepEqual(signs.map((s) => s.slot), ['lf', 'cf', 'rf'])
    assert.deepEqual(signs.map((s) => s.t), geometryOf(layout).labels.map((l) => l.t))
    assert.deepEqual(signs.map((s) => [s.x, s.y]), geometryOf(layout).labels.map((l) => [l.x, l.y]))
  }
})

test('signs far apart stay where they are', () => {
  const [a, b] = overlayLabels([park(330, 400, 330), park(400, 460, 400)])
  assert.ok([...a, ...b].every((s) => !moved(s)))
})

test('where signs would overlap, the park with the nearer wall steps inside it and no other sign moves', () => {
  // The first park's wall is nearer home in the lines, the second park's at center.
  const [a, b] = overlayLabels([park(330, 410, 330), park(340, 400, 335)])
  assert.ok(moved(slot(a, 'lf')) && moved(slot(a, 'rf')), 'the shallower lines step in')
  assert.ok(!moved(slot(b, 'lf')) && !moved(slot(b, 'rf')), 'the deeper lines stay')
  assert.ok(moved(slot(b, 'cf')) && !moved(slot(a, 'cf')), 'the shallower center steps in')
})

test('a sign steps toward home and toward the field, never out past its wall', () => {
  const [a, b] = overlayLabels([park(330, 410, 330), park(340, 400, 335)])
  const lf = slot(a, 'lf')
  const rf = slot(a, 'rf')
  assert.ok(lf.dx > 0 && lf.dy > -10, 'left field steps right, toward the centre line')
  assert.ok(rf.dx < 0 && rf.dy > -10, 'right field steps left, toward the centre line')
  const cf = slot(b, 'cf')
  assert.ok(Math.abs(cf.dx) < 1 && cf.dy > 0, 'center field steps straight toward home')
})

test('after the move no two signs overlap, for the two Series parks', () => {
  const [a, b] = overlayLabels([TB, MIL])
  for (const k of ['lf', 'cf', 'rf']) {
    const [p, q] = [at(slot(a, k)), at(slot(b, k))]
    assert.ok(Math.abs(p.x - q.x) >= 46 || Math.abs(p.y - q.y) >= 22, `${k}: ${JSON.stringify([p, q])}`)
  }
  // Tropicana's line signs stand nearer home and step in. The center signs do not meet: American Family's
  // stands at 8 degrees (its CF marker angle), Tropicana's at dead center, 58 units apart.
  assert.deepEqual(a.filter(moved).map((s) => s.slot), ['lf', 'rf'])
  assert.deepEqual(b.filter(moved), [])
})

test('one park: nothing moves', () => {
  const [a] = overlayLabels([MIL])
  assert.ok(a.every((s) => !moved(s)))
})

test('a park with no posted line distance has only the signs it has', () => {
  const noLines = { measurements: { dist: { lf: null, lc: null, cf: 410, rc: null, rf: null }, wall: null, measured: null }, geometry: { fence: null, cfMarkerAngle: 0 } }
  const [a] = overlayLabels([noLines])
  assert.deepEqual(a.map((s) => s.slot), ['cf'])
})
