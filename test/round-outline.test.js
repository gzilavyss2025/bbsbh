// The CF marker search is ill-conditioned on a flat wall (#2931): rounding an
// outline to whole units can move the deepest-point angle by several degrees.
// roundFence rounds only when the unchanged search keeps its angle, so the
// committed fields.js must be a fixed point of it.
import test from 'node:test'
import assert from 'node:assert/strict'
import fields from '../src/lib/ballpark/layout/fields.js'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'
import { auditFence } from '../src/lib/ballpark/layout/fenceAudit.js'
import { roundFence, wholeUnits } from '../scripts/lib/ballpark/round-outline.mjs'

// American Family Field as fields.js carried it before rounding (venue 32).
const AFF = [[-242.5, 242.9], [-240.4, 245], [-233.9, 267.1], [-230, 274.5], [-179.5, 324.1], [-78.5, 369.9], [-72.8, 374.7], [-61.7, 389.7], [-55.5, 395.3], [-5.2, 399.6], [22.6, 399], [55.6, 395.9], [73.5, 378.4], [140.6, 348.2], [171.1, 322.2], [172.6, 311.8], [176.9, 303.7], [243.4, 243.7]]

// The CF sign the renderer reads the marker against: the layout's posted distance.
const postedCf = (id, fallback) => resolveBallparkLayout({ venueId: Number(id), gameDate: '2026-10-22' })?.measurements.dist.cf ?? fallback
const fences = [
  ...Object.entries(fields.venues).map(([id, v]) => [`mlb ${id}`, v.fence, postedCf(id, v.measured.dist.cf)]),
  ...Object.entries(fields.milb.venues).map(([id, v]) => [`milb ${id}`, v.fence, postedCf(id, v.posted.cf)]),
].filter(([, fence]) => fence)

test('rounding AFF moves the marker search, so roundFence keeps it unrounded', () => {
  const cf = postedCf(32)
  const flipped = auditFence(wholeUnits(AFF), cf).cfMarkerAngle
  assert.ok(Math.abs(flipped - auditFence(AFF, cf).cfMarkerAngle) > 0.5)
  assert.equal(roundFence(AFF, cf), AFF)
})

test('a fence whose marker survives rounding is rounded', () => {
  const [, fence, cf] = fences.find(([id]) => id === 'mlb 1')
  assert.deepEqual(roundFence(fence, cf), wholeUnits(fence))
})

test('every committed fence is whole units, or rounding it would move the marker or fail the audit', () => {
  for (const [id, fence, cf] of fences) {
    const r = wholeUnits(fence)
    const [a, b] = [auditFence(fence, cf), auditFence(r, cf)]
    const refused = Math.abs(a.cfMarkerAngle - b.cfMarkerAngle) > 0.5 || !b.pass
    assert.ok(refused || JSON.stringify(fence) === JSON.stringify(r), `${id}: could be whole units`)
    // A refused fence never mixes: it is the original, at one decimal.
    if (refused) assert.equal(roundFence(fence, cf), fence, id)
  }
})
