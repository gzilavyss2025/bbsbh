// The innings card's pure view (src/screens/player/next/modules/innings/inningsView.js).
import test from 'node:test'
import assert from 'node:assert/strict'
import { batterView, innWindow, pitcherView, ringSize, scopeOptions, spotAt } from '../src/screens/player/next/modules/innings/inningsView.js'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'

// Brice Turang, 2026 season, MLB Stats API (the board's sample).
const turang = { positions: [{ pos: '2B', innings: '1311.2' }, { pos: 'SS', innings: '12.0' }], dh: null }

test('a ring is a position\'s share of his field innings; the biggest is the top ring', () => {
  const v = batterView(turang)
  assert.deepEqual(v.rings.map((r) => r.pos), ['2B', 'SS'])
  assert.equal(v.rings[0].top, true)
  assert.equal(v.rings[1].top, false)
  assert.equal(Math.round(v.rings[0].share * 1000), 991)
  assert.equal(v.rings[0].innings, '1311.2')
  assert.deepEqual(v.idle, ['C', '1B', '3B', 'LF', 'CF', 'RF'])
})

test('a sliver of a share still draws, and the arc never passes the circle', () => {
  assert.equal(ringSize(0.001), 3)
  assert.equal(ringSize(0), 0)
  assert.equal(ringSize(0.5), 50)
  assert.equal(ringSize(1.2), 100)
})

test('the mound is the pitcher card\'s: P is no ring on the hitting card, and a DH-only bat keeps the card', () => {
  assert.equal(batterView({ positions: [{ pos: 'P', innings: '85.2' }], dh: null }), null)
  const ohtani = batterView({ positions: [{ pos: 'P', innings: '85.2' }], dh: { games: 134 } })
  assert.deepEqual([ohtani.rings.length, ohtani.dh], [0, 134])
})

test('no fielding data is no card', () => {
  assert.equal(batterView(null), null)
  assert.equal(batterView({ positions: [], dh: null }), null)
})

test('the pitcher ring is the starter share, summed in outs (104.0 + 5.1 is 109.1)', () => {
  const v = pitcherView({ starter: '104.0', reliever: '5.1' })
  assert.equal(v.starter, '104.0')
  assert.equal(Math.round(v.size * 10), 951)
  assert.equal(pitcherView({ starter: '0.0', reliever: '0.0' }), null)
  assert.equal(pitcherView(null), null)
})

test('scopes: Season always; MLB career after a debut; MiLB career for a player on a minor-league club', () => {
  const keys = (bio) => scopeOptions(bio).map((s) => s.key)
  assert.deepEqual(keys({ debut: '2023-04-01', team: { id: 158 } }), ['season', 'mlb'])
  assert.deepEqual(keys({ debut: '', team: { id: 1, parentOrgId: 158 } }), ['season', 'milb'])
  assert.deepEqual(keys({ debut: '2024-04-01', team: { id: 1, parentOrgId: 158 } }), ['season', 'mlb', 'milb'])
  assert.deepEqual(keys({}), ['season'])
})

test('a ring stands at its position in the park\'s own feet, cropped like the board; no park uses the shared field\'s spots', () => {
  // The board's window is this park's own (innWindow): x 30 to 590, the sky trimmed to its signs.
  const win = innWindow(resolveBallparkLayout({ venueId: 32, gameDate: '2026-07-01' }))
  const [, top, , h] = win.viewBox.split(' ').map(Number)
  assert.deepEqual(spotAt('CF', win), { x: 50, y: ((235 - top) / h) * 100 })
  assert.deepEqual(spotAt('C', win), { x: 50, y: ((527 - top) / h) * 100 })
  assert.deepEqual(spotAt('CF', null), { x: 50, y: 12 })
})
