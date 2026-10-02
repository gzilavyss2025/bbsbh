// The lens's carry strip (#724, slice L6): src/lib/scorecard/carry.js.
// `carryShows` is the measured rule (G2): rects in, a yes or no out.
// `carryBoxes` names the boxes the strip holds, from the clamped view alone,
// pinned on the captured real game (gamePk 823035) with the same tap walk the
// bar's tests use.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { scorecardFull, scorecardStep } from '../src/api/scorecardGame.js'
import { halfIndex } from '../src/api/select.js'
import { carryBoxes, carryShows } from '../src/lib/scorecard/carry.js'
import { halfCards } from '../src/lib/scorecard/situation.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

// ---------------------------------------------------------------------------
// carryShows
// ---------------------------------------------------------------------------

// The pane's visible paper: under the sticky header, over the foot row, right
// of the rail. Rects are viewport rects, as getBoundingClientRect gives them.
const SEE = { top: 40, bottom: 700, left: 100, right: 390 }
const box = (top, left = 120) => ({ top, bottom: top + 120, left, right: left + 120 })

test('carryShows: no when every box sits inside the visible paper', () => {
  assert.equal(carryShows(SEE, [box(300), box(450, 200)]), false)
})

test('carryShows: yes when one box is off the bottom or the top', () => {
  assert.equal(carryShows(SEE, [box(300), box(1200)]), true)
  assert.equal(carryShows(SEE, [box(-400)]), true)
})

test('carryShows: yes when a box is only partly in view, under the header, the foot or the rail', () => {
  assert.equal(carryShows(SEE, [box(10)]), true)
  assert.equal(carryShows(SEE, [box(640)]), true)
  assert.equal(carryShows(SEE, [box(300, 40)]), true)
  assert.equal(carryShows(SEE, [box(300, 300)]), true)
})

test('carryShows: a sub-pixel overlap does not count as hidden', () => {
  assert.equal(carryShows(SEE, [{ top: 39.4, bottom: 160, left: 99.6, right: 220 }]), false)
})

test('carryShows: no when there is nothing to carry', () => {
  assert.equal(carryShows(SEE, []), false)
})

// ---------------------------------------------------------------------------
// carryBoxes
// ---------------------------------------------------------------------------

const card = (atBatIndex, last, extra = {}) => ({
  kind: 'atbat',
  atBatIndex,
  batter: { last },
  ...extra,
})
// A one-inning view: each [slot, card] lands in its slot's row, column 0.
const viewOf = (entries) => ({
  grid: {
    columns: [{ inning: 3 }],
    slots: Array.from({ length: 9 }, (_, i) => ({
      slot: i + 1,
      cells: Object.fromEntries(entries.filter(([s]) => s === i + 1).map(([, c]) => [0, c])),
    })),
  },
})

test('carryBoxes: the last box, labelled, and every runner on base', () => {
  const view = viewOf([
    [7, card(10, 'Quillen', { reached: 2 })],
    [8, card(11, 'Varganyi', { reached: 1 })],
    [9, card(12, 'Okafor')],
  ])
  assert.deepEqual(
    carryBoxes(view, 3, 'top').map((b) => [b.atBatIndex, b.label]),
    [
      [12, 'Okafor · last'],
      [10, 'Quillen · on 2nd'],
      [11, 'Varganyi · on 1st'],
    ],
  )
})

test('carryBoxes: a last box that is also a runner is one box, not two', () => {
  const view = viewOf([[9, card(12, 'Varganyi', { reached: 1 })]])
  assert.deepEqual(
    carryBoxes(view, 3, 'top').map((b) => b.label),
    ['Varganyi · last · on 1st'],
  )
})

test('carryBoxes: at most three, the last box first', () => {
  const view = viewOf([
    [6, card(9, 'Ortiz', { reached: 3 })],
    [7, card(10, 'Quillen', { reached: 2 })],
    [8, card(11, 'Varganyi', { reached: 1 })],
    [9, card(12, 'Okafor')],
  ])
  assert.deepEqual(
    carryBoxes(view, 3, 'top').map((b) => b.atBatIndex),
    [12, 9, 10],
  )
})

test('carryBoxes: a man scored or put out is no runner', () => {
  const view = viewOf([
    [7, card(10, 'Quillen', { reached: 3, scored: true })],
    [8, card(11, 'Varganyi', { reached: 1, outAt: 2 })],
    [9, card(12, 'Okafor')],
  ])
  assert.deepEqual(
    carryBoxes(view, 3, 'top').map((b) => b.label),
    ['Okafor · last'],
  )
})

test('carryBoxes: a missing name degrades to the slot number', () => {
  const view = viewOf([[9, card(12, '', { reached: 1 })]])
  assert.equal(carryBoxes(view, 3, 'top')[0].label, '#9 · last · on 1st')
})

test('carryBoxes: an empty half has nothing to carry', () => {
  assert.deepEqual(carryBoxes(viewOf([]), 3, 'top'), [])
  assert.deepEqual(carryBoxes(null, 3, 'top'), [])
})

// The spoiler footing: at every tap of the real game, each box the strip holds
// is a box already open on that step's clamped sheet, and it is one the walk's
// own half has opened (G8).
test('carryBoxes reads only opened boxes, at every step of a real game', () => {
  const counts = {}
  const countFor = (inning, half) => counts[`${inning}${half}`] ?? 0
  let through = -1
  let carried = 0
  for (;;) {
    const s = scorecardStep(FEED, through, countFor)
    if (!s) break
    if (s.nextCount >= s.total && s.halfOver) through = halfIndex(s.inning, s.half)
    else counts[`${s.inning}${s.half}`] = s.nextCount
    const next = scorecardStep(FEED, through, countFor)
    const view = scorecardFull({ feed: FEED }, s.side, {
      through,
      step: next ? { halfIdx: through + 1, count: next.count } : null,
    })
    const open = new Set(halfCards(view, s.inning).map((c) => c.atBatIndex))
    for (const b of carryBoxes(view, s.inning, s.half)) {
      assert.ok(open.has(b.atBatIndex), `${b.label} is not an open box`)
      carried += 1
    }
  }
  assert.ok(carried > 10, 'the walk should carry boxes')
})
