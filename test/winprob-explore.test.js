import test from 'node:test'
import assert from 'node:assert/strict'
import { nearestWinProbEvent, winProbReadout, winProbChangeLabel, touchIntent, followLatest, snapToMarker, focusInput, moveSnaps, wholeSwing } from '../src/components/charts/winprob/explore.js'
import { winProbKeyColor, winProbKeyPair } from '../src/components/charts/winprob/keyColors.js'

const FALLBACK = { primary: '#6B6558', secondary: '#938C7C', text: '#FBF6E9' }
import { selectWinProbPath, selectWinProbBigPlays } from '../src/api/winprob.js'
import { WIN_PROB_FIELDS } from '../src/api/game.js'

test('snap selects recorded events, excludes origin, and clamps edges', () => {
  assert.equal(nearestWinProbEvent(-1, 80), 0)
  assert.equal(nearestWinProbEvent(0, 80), 0)
  assert.equal(nearestWinProbEvent(40 / 80, 80), 39)
  assert.equal(nearestWinProbEvent(40.49 / 80, 80), 39)
  assert.equal(nearestWinProbEvent(40.51 / 80, 80), 40)
  assert.equal(nearestWinProbEvent(2, 80), 79)
  assert.equal(nearestWinProbEvent(0.5, 1), 0)
})
test('readout identifies after-play outs and preserves the recorded delta', () => {
  assert.deepEqual(winProbReadout({ home: 48.1, inning: 7, half: 'top', outs: 1, delta: -4.1 }), {
    context: '▲7 · 1 out', delta: -4.1,
  })
  assert.equal(winProbReadout({ home: 100, inning: 9, half: 'bottom', outs: 3 }).context, '▼9 · Half over')
  assert.equal(winProbReadout({ home: 50, inning: 1, half: 'top' }).delta, null)
})
test('outs and the drawn delta inherit reveal clamp and survive field pruning', () => {
  for (const field of ['count', 'outs', 'homeTeamWinProbabilityAdded']) assert.ok(WIN_PROB_FIELDS.includes(field))
  const rows = [1, 2].map(inning => ({ homeTeamWinProbability: 52.2,
    homeTeamWinProbabilityAdded: 2.2, about: { inning, isTopInning: true }, count: { outs: 1 } }))
  const points = selectWinProbPath(rows, { throughHalf: 0 })
  assert.equal(points.length, 1)
  assert.equal(points[0].outs, 1)
  assert.equal(points[0].delta.toFixed(1), '2.2')
  assert.equal(selectWinProbPath([{ ...rows[0], count: null, homeTeamWinProbabilityAdded: null }])[0].outs, null)
})
test('each plotted delta is the step the line draws, so readout and ledger agree', () => {
  const rows = [52.2, 40, 40.2].map((home, i) => ({ homeTeamWinProbability: home,
    homeTeamWinProbabilityAdded: 99, about: { inning: i + 1, isTopInning: true } }))
  const points = selectWinProbPath(rows)
  // The first play is measured from the chart's even 50% origin, not the feed's pre-game odds.
  assert.deepEqual(points.map(p => Number(p.delta.toFixed(1))), [2.2, -12.2, 0.2])
  const [swing] = selectWinProbBigPlays(rows)
  assert.equal(swing.delta, points[swing.idx].delta)
})
test('change label names the gaining club and says no change when it rounds to zero', () => {
  assert.equal(winProbChangeLabel(12.4, 'HOM', 'AWY'), 'HOM +12%')
  assert.equal(winProbChangeLabel(-12.6, 'HOM', 'AWY'), 'AWY +13%')
  assert.equal(winProbChangeLabel(0, 'HOM', 'AWY'), 'No change')
  assert.equal(winProbChangeLabel(-0.3, 'HOM', 'AWY'), 'No change')
})
test('a touch only selects once it moves sideways; a vertical move is a page scroll', () => {
  assert.equal(touchIntent(2, 3), 'pending')
  assert.equal(touchIntent(12, 4), 'drag')
  assert.equal(touchIntent(-12, 4), 'drag')
  assert.equal(touchIntent(3, 14), 'scroll')
})
test('a selection resets to the latest play when more plays arrive', () => {
  assert.deepEqual(followLatest({ count: 20, idx: 12 }, 20), { count: 20, idx: 12 })
  assert.deepEqual(followLatest({ count: 20, idx: 12 }, 30), { count: 30, idx: null })
})

test('a click near a swing marker snaps to it; one farther off does not', () => {
  // 80 plays; marker on play idx 39 sits at fraction 40/80.
  assert.equal(snapToMarker(40.4 / 80, 80, [39], 1 / 80), 39)
  assert.equal(snapToMarker(38.2 / 80, 80, [39], 1 / 80), 37)
  // The nearest of two markers wins.
  assert.equal(snapToMarker(42.6 / 80, 80, [39, 42], 1 / 80), 42)
  assert.equal(snapToMarker(0.5, 80, [], 1 / 80), 39)
})

test('the last play of a finished game reads Final and keeps its change', () => {
  // The decisive play (often a walk-off, often swing #1) must still show its swing.
  const last = { home: 100, inning: 9, half: 'bottom', outs: 2, delta: 31.4 }
  assert.deepEqual(winProbReadout(last, { final: true }), { context: 'Final', delta: 31.4 })
  assert.equal(winProbReadout(last).context, '▼9 · 2 outs')
  assert.equal(winProbReadout({ home: 0, inning: 9, half: 'top', outs: 3 }, { final: true }).delta, null)
})

test('the key colour is the band colour, with readable text on it', () => {
  assert.deepEqual(winProbKeyColor('#FFFFFF', FALLBACK), { fill: '#FFFFFF', text: '#1B2A3A' })
  assert.deepEqual(winProbKeyColor('#0C2340', FALLBACK), { fill: '#0C2340', text: '#FFFFFF' })
  // Not a plain hex (a pattern, a named colour): the club's chip colours.
  assert.deepEqual(winProbKeyColor('url(#x)', FALLBACK), { fill: FALLBACK.primary, text: FALLBACK.text })
})

test('two near-identical key colours move the away key to its fallback', () => {
  const home = { fill: '#0C2340', text: '#FFFFFF' }
  const clash = winProbKeyPair({ fill: '#0E2442', text: '#FFFFFF' }, home, { primary: '#0E2442', secondary: '#E31937', text: '#FFFFFF' })
  assert.equal(clash.away.fill, '#E31937')
  assert.equal(clash.home, home)
  const apart = winProbKeyPair({ fill: '#BD3039', text: '#FFFFFF' }, home, FALLBACK)
  assert.equal(apart.away.fill, '#BD3039')
})

test('focus that did not follow a pointer down on the slider is keyboard focus', () => {
  // Click, Tab away, Tab back: no pointer down came first, so the ring must show.
  assert.equal(focusInput(null, 5000), 'key')
  // A pointer down that never led to focus goes stale rather than hiding a later Tab-in's ring.
  assert.equal(focusInput(1000, 5000), 'key')
  // Focus that lands right after a pointer down (a click's own focus() or a tap's) draws no ring.
  assert.equal(focusInput(4900, 5000), 'pointer')
})

test('only a mouse hover snaps to a swing marker; a drag steps play by play', () => {
  // Hover (no button, no capture): a 1px move after a click must not leave the marker.
  assert.equal(moveSnaps('mouse', false), true)
  // A mouse drag holds pointer capture and stays unsnapped.
  assert.equal(moveSnaps('mouse', true), false)
  // A touch drag captures the pointer and stays unsnapped.
  assert.equal(moveSnaps('touch', true), false)
  assert.equal(moveSnaps('touch', false), false)
})

test('the change pill is the difference of the two header numbers, not a second rounding', () => {
  // Header reads 50% before and 50% after: the pill must say no change, not +1%.
  assert.equal(wholeSwing(49.6, 50.4), 0)
  assert.equal(winProbChangeLabel(wholeSwing(49.6, 50.4), 'HOM', 'AWY'), 'No change')
  // Header goes 50% to 51%: the pill must say +1%, though the raw step (0.2) rounds to 0.
  assert.equal(wholeSwing(50.4, 50.6), 1)
  assert.equal(winProbChangeLabel(wholeSwing(50.4, 50.6), 'HOM', 'AWY'), 'HOM +1%')
  // A fall names the away club; the first play is measured from the even 50%.
  assert.equal(winProbChangeLabel(wholeSwing(60.4, 47.6), 'HOM', 'AWY'), 'AWY +12%')
  assert.equal(wholeSwing(50, 52.2), 2)
})
