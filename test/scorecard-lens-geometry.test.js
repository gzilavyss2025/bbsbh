import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PHONE_LENS_QUERY,
  lensFrame,
  lensOffset,
  lensOn,
  lensZoom,
} from '../src/lib/scorecard/geometry.js'

// The lens (ADR-0092): on a phone, the scorecard pane scrolls so the next
// sealed box sits under a fixed navy frame. These pin the pure parts: when the
// lens is on, the zoom, where the frame sits, and the scroll that puts a
// measured cell under it.

const STEP = { inning: 3, half: 'top', side: 'top', count: 2, total: 9, nextCount: 3, halfOver: true }

test('lensOn: on a phone, with a frontier, while taps commit', () => {
  assert.equal(lensOn({ phone: true, stepInfo: STEP, commitReveals: true }), true)
})

test('lensOn: off wider than a phone', () => {
  assert.equal(lensOn({ phone: false, stepInfo: STEP, commitReveals: true }), false)
})

test('lensOn: off with no frontier (a caught-up game, Scores Unlocked, a stamp)', () => {
  assert.equal(lensOn({ phone: true, stepInfo: null, commitReveals: true }), false)
})

test('lensOn: off when effectiveReveal says taps do not commit (G7)', () => {
  assert.equal(lensOn({ phone: true, stepInfo: STEP, commitReveals: false }), false)
})

test('PHONE_LENS_QUERY is the one phone test, today a 480px width', () => {
  assert.equal(PHONE_LENS_QUERY, '(max-width: 480px)')
})

test('lensZoom: the rail plus two inning columns fill the pane', () => {
  // 390 / (100 + 2 * 86) = 1.4338…
  const z = lensZoom({ paneWidth: 390, railWidth: 100, cellWidth: 86, max: 1.5 })
  assert.ok(Math.abs(z * (100 + 2 * 86) - 390) < 1e-9)
})

test('lensZoom: capped at the sheet maximum', () => {
  assert.equal(lensZoom({ paneWidth: 440, railWidth: 80, cellWidth: 80, max: 1.5 }), 1.5)
})

test('lensZoom: no pane width yet gives no zoom change (1)', () => {
  assert.equal(lensZoom({ paneWidth: 0, railWidth: 100, cellWidth: 86, max: 1.5 }), 1)
})

// The pane in these: 600px tall, a 30px sticky header, a 40px foot row,
// 129px rows. `cellTop` is the frontier box's top in the pane's content
// (scroll 0). There is no spacer above slot 1, so row 1's box is at 30.
const PANE = { paneHeight: 600, headerHeight: 30, footHeight: 40, railRight: 143, cellWidth: 123, cellHeight: 129 }

test('lensFrame: a box deep in the order sits at the seat, 54% down, over the SECOND column', () => {
  const f = lensFrame({ ...PANE, cellTop: 30 + 5 * 129 })
  assert.deepEqual(f, {
    top: 324,
    left: 266, // rail (143) + one column (123): the previous inning shows to the left
    width: 123,
    height: 129,
    padBottom: 276, // row 9 can reach the seat: pane height minus the seat
    bandAbove: 294, // the paper between the header and the frame
    bandBelow: 107, // between the frame's bottom (453) and the foot row (560)
  })
})

test('lensFrame: the top of the order rides above the seat, so no blank paper shows over row 1', () => {
  // Row 1 leads off: the frame sits on row 1 itself, under the header.
  const one = lensFrame({ ...PANE, cellTop: 30 })
  assert.equal(one.top, 30)
  assert.equal(one.bandAbove, 0)
  assert.equal(one.bandBelow, 600 - 40 - (30 + 129))
  // Row 2, then row 3: the frame moves down one row a tap.
  assert.equal(lensFrame({ ...PANE, cellTop: 159 }).top, 159)
  assert.equal(lensFrame({ ...PANE, cellTop: 288 }).top, 288)
  // Row 4 is past the seat: the frame stops there and the sheet scrolls.
  assert.equal(lensFrame({ ...PANE, cellTop: 417 }).top, 324)
  // A ride never puts the frame under the sticky header.
  assert.equal(lensFrame({ ...PANE, cellTop: 12 }).top, 30)
})

test('lensFrame: a riding frame needs no scroll, and a seated one scrolls as before', () => {
  const at = (cellTop) => {
    const frame = lensFrame({ ...PANE, cellTop })
    return lensOffset({ cellRect: { top: cellTop, left: 266 }, paneRect: { top: 0, left: 0 }, scrollTop: 0, scrollLeft: 0, frame }).top
  }
  assert.equal(at(30), 0)
  assert.equal(at(288), 0)
  assert.equal(at(30 + 5 * 129), 30 + 5 * 129 - 324)
})

test('lensFrame: no frontier box measured yet sits at the seat, and no band is negative', () => {
  assert.equal(lensFrame({ ...PANE, cellTop: null }).top, 324)
  const tiny = lensFrame({ paneHeight: 40, headerHeight: 30, footHeight: 20, railRight: 100, cellWidth: 80, cellHeight: 80, cellTop: 30 })
  assert.equal(tiny.bandAbove, 0)
  assert.equal(tiny.bandBelow, 0)
})

test('lensOffset: puts a measured cell under the frame', () => {
  // The cell is 500px down and 300px right of the pane's top-left corner on
  // screen, while the pane is already scrolled by (100, 40).
  const out = lensOffset({
    cellRect: { top: 560, left: 316 },
    paneRect: { top: 60, left: 16 },
    scrollTop: 100,
    scrollLeft: 40,
    frame: { top: 324, left: 266 },
  })
  // Content position of the cell: (100 + 500, 40 + 300) = (600, 340).
  assert.deepEqual(out, { top: 600 - 324, left: 340 - 266 })
})

test('lensOffset: a cell above the frame scrolls the pane back up', () => {
  const out = lensOffset({
    cellRect: { top: 100, left: 266 },
    paneRect: { top: 0, left: 0 },
    scrollTop: 500,
    scrollLeft: 0,
    frame: { top: 324, left: 266 },
  })
  assert.deepEqual(out, { top: 276, left: 0 })
})

test('lensOffset: never asks for a negative scroll', () => {
  const out = lensOffset({
    cellRect: { top: 10, left: 10 },
    paneRect: { top: 0, left: 0 },
    scrollTop: 0,
    scrollLeft: 0,
    frame: { top: 324, left: 266 },
  })
  assert.deepEqual(out, { top: 0, left: 0 })
})

test('lensOffset: rounds to whole pixels so a re-measure does not re-scroll', () => {
  const out = lensOffset({
    cellRect: { top: 400.4, left: 300.6 },
    paneRect: { top: 0, left: 0 },
    scrollTop: 0,
    scrollLeft: 0,
    frame: { top: 324, left: 266 },
  })
  assert.deepEqual(out, { top: 76, left: 35 })
})
