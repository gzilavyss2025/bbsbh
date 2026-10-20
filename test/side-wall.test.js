// The side view's real wall (docs/contact-replay.md §7.1), pure: lib/pitcherCard/sideWall.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { wallAlong } from '../src/lib/pitcherCard/sideWall.js'
import { HIT_COORD_FT_PER_UNIT, HIT_COORD_ORIGIN } from '../src/lib/ballpark/hitProjection.js'

const dodger = resolveBallparkLayout({ venueId: 22, gameDate: '2026-10-15' }) // gamePk 849810
const at = (ft, deg) => ({ // a landing coordinate `ft` feet out, `deg` degrees off center (+ right field)
  coordX: HIT_COORD_ORIGIN.x + (ft * Math.sin((deg * Math.PI) / 180)) / HIT_COORD_FT_PER_UNIT,
  coordY: HIT_COORD_ORIGIN.y - (ft * Math.cos((deg * Math.PI) / 180)) / HIT_COORD_FT_PER_UNIT,
})

test('wallAlong: straightaway center is the measured center field wall', () => {
  const w = wallAlong(dodger, at(300, 0))
  assert.ok(Math.abs(w.ft - 395) <= 4, `center wall ${w.ft}`) // measured 394.9
  assert.equal(w.height, 7.5)
})

test('wallAlong: the line to line walls are shorter and closer than center', () => {
  const lf = wallAlong(dodger, at(300, -40))
  const rf = wallAlong(dodger, at(300, 40))
  assert.ok(lf.ft < 380 && rf.ft < 380)
  assert.ok(lf.height < 7.5 && rf.height < 7.5)
})

test('wallAlong: null with no layout, no coordinate, foul territory or behind the plate', () => {
  assert.equal(wallAlong(null, at(300, 0)), null)
  assert.equal(wallAlong(dodger, { coordX: null, coordY: 100 }), null)
  assert.equal(wallAlong(dodger, at(200, 60)), null) // outside the foul line
  assert.equal(wallAlong(dodger, { coordX: HIT_COORD_ORIGIN.x, coordY: HIT_COORD_ORIGIN.y + 20 }), null) // behind home
})
