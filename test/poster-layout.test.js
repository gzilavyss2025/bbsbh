import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BLOCK_HEIGHT,
  BLOCK_ORDER,
  cardsHeight,
  columns,
  contentBox,
  POSTER,
  posterLayout,
} from '../src/lib/preview/posterLayout.js'
import { posterDateParts } from '../src/api/gamePreview.js'
import { focusPoint } from '../src/lib/preview/posterArt.js'

// The poster is exported as an image, so nothing about it can be checked by
// looking at the running app the way a DOM surface can. These pin the parts
// that are pure arithmetic — the frame's ratio, the stack, and the two
// coordinate conversions that are easy to get backwards.

test('the frame is 3:4 portrait — the tallest X shows uncropped', () => {
  assert.equal(POSTER.width, 1200)
  assert.equal(POSTER.height, 1600)
  assert.equal(POSTER.width / POSTER.height, 0.75)
})

test('every block fits between the head and the footer', () => {
  const layout = posterLayout(new Set(BLOCK_ORDER), { cards: cardsHeight(9) })
  assert.equal(layout.blocks.length, 3)
  for (const b of layout.blocks) {
    assert.ok(b.y >= POSTER.headHeight, `${b.key} starts inside the head`)
    assert.ok(
      b.y + b.height <= POSTER.height - POSTER.footerHeight,
      `${b.key} runs past the footer rule`,
    )
  }
})

test('blocks stack in declared order and never overlap', () => {
  const layout = posterLayout(new Set(BLOCK_ORDER), { cards: cardsHeight(9) })
  assert.deepEqual(
    layout.blocks.map((b) => b.key),
    BLOCK_ORDER,
  )
  for (let i = 1; i < layout.blocks.length; i += 1) {
    const prev = layout.blocks[i - 1]
    assert.ok(layout.blocks[i].y >= prev.y + prev.height, 'blocks overlap')
  }
})

test('a disabled block is dropped and its room shared out, not left blank', () => {
  const all = posterLayout(new Set(BLOCK_ORDER), { cards: cardsHeight(9) })
  const fewer = posterLayout(new Set(['arms', 'zone']))
  assert.equal(fewer.blocks.length, 2)
  assert.ok(fewer.gap > all.gap, 'a shorter poster should breathe more, not leave a hole')
  const last = fewer.blocks[fewer.blocks.length - 1]
  assert.ok(last.y + last.height <= POSTER.height - POSTER.footerHeight)
})

test('an empty poster is legal and paints only head and footer', () => {
  const layout = posterLayout(new Set())
  assert.equal(layout.blocks.length, 0)
  assert.equal(layout.overflows, false)
})

test('cardsHeight tracks the posted rows and clamps to a nine-man card', () => {
  assert.ok(cardsHeight(9) > cardsHeight(3))
  assert.equal(cardsHeight(9), cardsHeight(12), 'a batting order is never longer than nine')
  assert.equal(cardsHeight(0), cardsHeight(1), 'an unposted card still reserves one row of notice')
})

test('the content box and its two columns stay inside the margins', () => {
  const box = contentBox()
  assert.equal(box.x, POSTER.margin)
  assert.equal(box.x + box.width, POSTER.width - POSTER.margin)
  const [left, right] = columns(32)
  assert.equal(left.x, box.x)
  assert.equal(right.x + right.width, box.x + box.width)
  assert.equal(left.width, right.width)
})

// Switching blocks off must not leave a sheet of blank paper: the head takes
// the slack (up to headStretch) and the remaining stack is centred in the rest.
test('a fuller poster has a shorter head, and the head never shrinks below its floor', () => {
  const full = posterLayout(new Set(BLOCK_ORDER), { cards: cardsHeight(9) })
  const one = posterLayout(new Set(['arms']))
  const none = posterLayout(new Set())
  assert.equal(full.head.height, POSTER.headHeight + full.head.stretch)
  assert.ok(full.head.height >= POSTER.headHeight)
  assert.ok(one.head.height > full.head.height, 'a sparser poster should give the photo more room')
  assert.equal(one.head.height, POSTER.headHeight + POSTER.headStretch, 'stretch is capped')
  assert.equal(none.head.height, POSTER.headHeight + POSTER.headStretch)
})

test('the remaining stack is centred, not hung from the head', () => {
  const one = posterLayout(new Set(['arms']))
  const block = one.blocks[0]
  const above = block.y - one.head.height
  const below = one.footerY - (block.y + block.height)
  assert.ok(Math.abs(above - below) < 1, `stack is not centred: ${above} above, ${below} below`)
})

test('a stretched head still leaves every block inside the sheet', () => {
  for (const set of [new Set(['arms']), new Set(['zone']), new Set(['arms', 'zone'])]) {
    const layout = posterLayout(set)
    for (const b of layout.blocks) {
      assert.ok(b.y >= layout.head.height, `${b.key} starts inside the head`)
      assert.ok(b.y + b.height <= layout.footerY, `${b.key} runs past the footer`)
    }
  }
})

test('three natural-height blocks are declared and reachable', () => {
  for (const key of BLOCK_ORDER) assert.ok(BLOCK_HEIGHT[key] > 0, `${key} has no natural height`)
})

// A bare "2026-08-12" must not be read as UTC and rolled back a day for
// anyone west of Greenwich — the trap lib/dates.js avoids everywhere else.
test('the dateline is parsed as local parts, not as a UTC instant', () => {
  assert.deepEqual(posterDateParts('2026-08-12'), {
    weekday: 'Wednesday',
    monthDay: 'August 12',
    year: '2026',
  })
  assert.deepEqual(posterDateParts(''), { weekday: '', monthDay: '', year: '' })
  assert.deepEqual(posterDateParts('not-a-date'), { weekday: '', monthDay: '', year: '' })
})

test('a CSS focal point converts to canvas fractions, and a bad one centres', () => {
  assert.deepEqual(focusPoint('50% 20%'), { x: 0.5, y: 0.2 })
  assert.deepEqual(focusPoint('0% 100%'), { x: 0, y: 1 })
  assert.deepEqual(focusPoint(''), { x: 0.5, y: 0.5 })
  assert.deepEqual(focusPoint('nonsense'), { x: 0.5, y: 0.5 })
})
