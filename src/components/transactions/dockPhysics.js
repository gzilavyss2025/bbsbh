// The wire dock's motion, as arithmetic. No DOM, no React, no time source —
// every function here takes numbers and returns numbers, so the FEEL of the
// drag is unit-testable (test/dock-physics.test.js) instead of being something
// you can only assess by flicking a phone.
//
// That split is the point. A sheet reads as fluid because of four decisions —
// where a flick lands, how hard an edge resists, which rest position wins, how
// long the settle runs — and all four are pure. What is left in WireDock.jsx is
// only pointer plumbing.
//
// The coordinate system: `offset` is the sheet's translateY in CSS pixels,
// measured DOWN from fully open. 0 is the tallest detent; the rail (the resting
// peek) is the largest number. Bigger offset = more of the sheet pushed off the
// bottom of the screen. Every function below speaks that one coordinate.

// How the sheet is sized against the viewport. The tallest detent stops short
// of the top so the slate's date banner stays visible behind it — an open dock
// must never read as a page of its own, because it is not one: the games are
// still the page (see WireDock.jsx's header).
export const SHEET_FRACTION = 0.92
// The working position. Just over half the viewport, which on a 844pt iPhone
// leaves four game rows legible above the sheet while showing five moves in it.
export const HALF_FRACTION = 0.54

// Apple's scroll deceleration constant (Designing Fluid Interfaces, WWDC 2018).
// 0.998 is the "normal scroll feel" value; lower is snappier.
export const DECELERATION_RATE = 0.998

// Where a flick comes to rest, given the velocity it was released at. This is
// the exponential-decay form Apple ships, NOT the textbook v²/(2a) — they are
// not the same curve, and the textbook one under-throws badly at the velocities
// a thumb actually produces.
//
// `velocity` is px/s, positive downward (the direction a dismissing flick
// travels). The return is a signed px displacement to add to the release
// position; the detent nearest THAT point is the one to animate to, which is
// what makes a small flick throw the sheet a long way.
export function projectMomentum(velocity, decelerationRate = DECELERATION_RATE) {
  if (!Number.isFinite(velocity) || velocity === 0) return 0
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

// Progressive resistance past a boundary. A hard stop reads as "frozen"; this
// reads as "responsive, but there is nothing more here" — the further you pull,
// the less the sheet follows, asymptotically. `dimension` is the travel the
// resistance is scaled against (the sheet's own height).
export function rubberband(overshoot, dimension, constant = 0.55) {
  if (!Number.isFinite(overshoot) || overshoot === 0) return 0
  if (!(dimension > 0)) return 0
  const sign = overshoot < 0 ? -1 : 1
  const magnitude = Math.abs(overshoot)
  return (sign * (magnitude * dimension * constant)) / (dimension + constant * magnitude)
}

// The detent offsets for a viewport, ordered OPEN → CLOSED, so an index is a
// position on one axis the caller can step up and down: 0 full, 1 half, 2 rail.
//
// `railHeight` is measured from the rendered rail rather than assumed, because
// the rail's height is the one number the slate's bottom padding also depends
// on — a constant here that disagreed with the CSS would hide a game card.
export function detentOffsets(viewportHeight, railHeight) {
  const vh = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0
  const sheet = Math.round(vh * SHEET_FRACTION)
  const rail = Math.max(0, Math.min(Number.isFinite(railHeight) ? railHeight : 0, sheet))
  const half = Math.round(vh * HALF_FRACTION)
  return [
    0,
    // Clamped between the two neighbours so a short viewport (a landscape
    // phone, a browser with a keyboard up) degrades to two usable positions
    // instead of producing a half detent that sits below the rail.
    Math.max(0, Math.min(sheet - half, sheet - rail)),
    sheet - rail,
  ]
}

// The index of the detent nearest a position. Ties resolve to the more OPEN
// one, which is the forgiving direction: an ambiguous drag that opens is undone
// by one tap, while one that closes has thrown away what the reader was
// reaching for.
export function nearestDetent(offset, detents) {
  let best = 0
  let bestGap = Infinity
  for (let i = 0; i < detents.length; i += 1) {
    const gap = Math.abs(detents[i] - offset)
    if (gap < bestGap) {
      bestGap = gap
      best = i
    }
  }
  return best
}

// Where a release lands: project the momentum forward, then snap to whatever
// detent that projected point is nearest. Clamped to the detent range first, so
// a hard flick past the ends still resolves to an end rather than to nothing.
//
// `snapToSequential` refuses to skip a detent however hard the flick — a flick
// from the rail can reach half but never full. Vaul exposes the same option and
// it is the right default HERE: the dock's tallest detent covers the slate, and
// covering the page the reader came for is not something a gesture should do by
// accident. A deliberate second drag still gets there.
export function releaseDetent(offset, velocity, detents, { from = null, snapToSequential = true } = {}) {
  if (!detents.length) return 0
  const open = detents[0]
  const closed = detents[detents.length - 1]
  const projected = Math.max(open, Math.min(closed, offset + projectMomentum(velocity)))
  const landed = nearestDetent(projected, detents)
  if (!snapToSequential || from == null) return landed
  return Math.max(from - 1, Math.min(from + 1, landed))
}

// How long the settle runs. A fixed duration makes a 12px correction feel
// sluggish and a full-height throw feel abrupt, so this scales with the
// distance still to travel and then clamps: nothing is ever slower than
// MAX_SETTLE_MS (which would read as lag) or faster than MIN_SETTLE_MS (which
// reads as a cut rather than a move).
export const MIN_SETTLE_MS = 200
export const MAX_SETTLE_MS = 480

export function settleMs(distance) {
  const px = Math.abs(Number.isFinite(distance) ? distance : 0)
  return Math.round(Math.max(MIN_SETTLE_MS, Math.min(MAX_SETTLE_MS, 140 + px * 0.55)))
}

// The velocity a release carries, in px/s, from a short history of
// `{ y, t }` samples. Only the tail matters: a drag that paused before release
// has ENDED at rest however fast it moved a second earlier, and averaging over
// the whole gesture is exactly how a sheet acquires a phantom throw.
export const VELOCITY_WINDOW_MS = 90

export function velocityFrom(samples, windowMs = VELOCITY_WINDOW_MS) {
  if (!samples || samples.length < 2) return 0
  const last = samples[samples.length - 1]
  let first = samples[0]
  for (let i = samples.length - 2; i >= 0; i -= 1) {
    first = samples[i]
    if (last.t - samples[i].t >= windowMs) break
  }
  const dt = last.t - first.t
  if (dt <= 0) return 0
  return ((last.y - first.y) / dt) * 1000
}

// How far open the sheet is, 0 at the rail and 1 at the tallest detent. The
// scrim reads this: it stays fully clear across the rail→half stretch (a dock
// at its working height sits BESIDE the slate, and dimming the games would
// break the flow the dock exists to preserve) and fades in only across
// half→full, where the sheet has effectively become the page.
export function openness(offset, detents) {
  if (detents.length < 2) return 0
  const closed = detents[detents.length - 1]
  const open = detents[0]
  if (closed === open) return 0
  return Math.max(0, Math.min(1, (closed - offset) / (closed - open)))
}

export function scrimAlpha(offset, detents, max = 0.34) {
  if (detents.length < 3) return 0
  const [full, half] = detents
  if (half === full) return 0
  const t = (half - offset) / (half - full)
  return Math.max(0, Math.min(1, t)) * max
}
