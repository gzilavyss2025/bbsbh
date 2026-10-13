// The jump bar's pure half (src/lib/jumpbar/spy.js, #1883): the scroll-spy's
// choice of the current section, the bar's own sideways scroll, and the count
// badge's text.
import test from 'node:test'
import assert from 'node:assert/strict'
import { countLabel, currentSection, scrollLeftToShow } from '../src/lib/jumpbar/spy.js'

const S = [
  { key: 'overview', top: -900 },
  { key: 'season', top: -200 },
  { key: 'splits', top: 40 },
  { key: 'career', top: 700 },
]

test('the current section is the last one whose top crossed the line', () => {
  assert.equal(currentSection(S, { line: 24 }), 'season')
  assert.equal(currentSection(S, { line: 40 }), 'splits')
})

test('before any section crosses the line, the first is current', () => {
  const below = S.map((s) => ({ ...s, top: s.top + 2000 }))
  assert.equal(currentSection(below, { line: 24 }), 'overview')
})

test('at the bottom of the scroll area, the last section is current', () => {
  assert.equal(currentSection(S, { line: 24, atEnd: true }), 'career')
})

test('no sections gives no current section', () => {
  assert.equal(currentSection([], { line: 24 }), null)
  assert.equal(currentSection([], { atEnd: true }), null)
})

test('a button in view leaves the bar where it is', () => {
  assert.equal(scrollLeftToShow({ scrollLeft: 100, width: 300, itemLeft: 150, itemWidth: 80, pad: 16 }), 100)
})

test('a button off the right end scrolls the bar left far enough to show it', () => {
  // The button ends at 520; with 16px of pad the bar must show to 536.
  assert.equal(scrollLeftToShow({ scrollLeft: 0, width: 358, itemLeft: 420, itemWidth: 100, pad: 16 }), 178)
})

test('a button off the left end scrolls the bar back to it, never below 0', () => {
  assert.equal(scrollLeftToShow({ scrollLeft: 300, width: 358, itemLeft: 120, itemWidth: 90, pad: 16 }), 104)
  assert.equal(scrollLeftToShow({ scrollLeft: 300, width: 358, itemLeft: 8, itemWidth: 90, pad: 16 }), 0)
})

test('a count reads with thousands separators; no count is null', () => {
  assert.equal(countLabel(2881), '2,881')
  assert.equal(countLabel(4), '4')
  assert.equal(countLabel(0), '0')
  assert.equal(countLabel('TBD'), 'TBD')
  assert.equal(countLabel(null), null)
  assert.equal(countLabel(undefined), null)
  assert.equal(countLabel(''), null)
  assert.equal(countLabel(Number.NaN), null)
})
