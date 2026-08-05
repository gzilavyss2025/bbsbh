// Geometry for the player page's percentile radar — the polygon on
// src/components/playercard/StatRadar.jsx. Pure: numbers in, numbers out, no
// DOM and no React, so the shape can be pinned by unit tests rather than
// eyeballed in a browser. The component does nothing but turn these into SVG
// attributes. Same split as lib/beeswarm.js and lib/passportLayout.js.
//
// WHY PERCENTILES ARE THE RADIUS. Savant's percentile ranks are already
// pre-flipped so that higher is always better, even for metrics where a low raw
// number is the good one (xERA, BB%, hard-hit% allowed) — see
// gen-savant-percentiles.mjs. That is exactly the "farther out is better"
// property a radar needs, on a scale that's already common across metrics with
// wildly different units (a rate in %, a speed in mph, an xwOBA in the .300s).
// Plotting the raw rates instead would need a per-metric normalisation invented
// here and would put "lower is better" spokes in backwards.
//
// It also makes the league-average ring free: on a percentile scale the average
// player sits at the 50th by construction, so the reference ring is a constant
// at 0.5 rather than a second data series to fetch and keep in step.

// Where the average-player reference ring sits. See above — this is a property
// of the percentile scale, not a tunable.
export const AVERAGE_RING = 0.5

// A percentile can legitimately be 0, and a spoke pinned exactly at the centre
// collapses the polygon into a spike with no area near it — visually it reads
// as missing data rather than as "worst in the league". Floor the plotted
// radius (never the reported number) so a 0th-percentile spoke still shows as a
// visible pinch.
const MIN_RADIUS = 0.06

// Spokes start at 12 o'clock and run clockwise, which is how the eye reads a
// dial. SVG's y axis grows downward, so "up" is -90°.
const START_ANGLE = -Math.PI / 2

export function spokeAngle(index, count) {
  return START_ANGLE + (index / count) * Math.PI * 2
}

// One spoke's point at a given 0..1 radius, in a viewBox whose centre is
// (cx, cy) and whose outermost ring is `r`.
export function pointAt(index, count, radius, { cx, cy, r }) {
  const angle = spokeAngle(index, count)
  return {
    x: cx + Math.cos(angle) * r * radius,
    y: cy + Math.sin(angle) * r * radius,
  }
}

const path = (points) => points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')

// Two decimals is finer than a device pixel at any size this renders and keeps
// the emitted path strings short.
function round(n) {
  return Math.round(n * 100) / 100
}

// Everything StatRadar needs to draw, for a list of
// {key, label, percentile, value} spokes.
//
// `percentile` may be null for a metric a player is under Savant's own sample
// floor for. A null spoke is NOT dropped — dropping it would silently change
// the polygon's number of sides and make a five-metric player's shape
// incomparable to everyone else's. It's plotted at the average ring and
// reported as unknown, so the shape stays a pentagon and the label says why.
// Minimum room a side label needs to its outside edge, in user units. A radar's
// left and right spokes sit at ~95% of the label radius horizontally, and their
// text runs OUTWARD from that anchor — so an anchor comfortably inside the
// viewBox can still have most of its label clipped off the edge.
//
// The number is measured, not guessed: the widest spoke label the app renders
// is "Hard-hit ↓" at --fs-caption in the condensed face, ~90 user units with
// the viewBox at 1:1 with CSS pixels. 95 leaves a hair of slack. This is what
// the geometry has to buy, and what the tests assert against.
export const LABEL_ROOM = 95

// How far beyond the rim a spoke's label sits, in user units — a FIXED offset,
// not a fraction of the radius. It was a fraction at first, which made the
// radius the only real lever on where labels land: shrinking the polygon to
// pull a label inward also pulled the label's own offset in behind it, so the
// net movement was about a third of what you asked for and the left label
// stayed clipped through two rounds of tuning. With a fixed offset, `padding`
// moves labels one-for-one.
const LABEL_OFFSET = 14

// `size` is the square polygon's box; `gutter` widens the viewBox horizontally
// on both sides to make room for the side labels' text (see LABEL_ROOM — the
// first version of this had no gutter and clipped "Hard-hit %" off the left
// edge, which every unit test passed because the anchor POINT was in bounds).
//
// The resulting viewBox width is deliberately the same number of user units as
// the card's max rendered width in CSS pixels (see .statradar__svg). That 1:1
// mapping is what lets the spoke labels use the design system's own --fs-* type
// tokens and come out at the size those tokens promise — with a narrower
// viewBox the browser scales user units up and every label renders bigger than
// its token says. Changing one without the other silently resizes the type.
// Defaults: a 90-unit polygon in a 400×280 box. The box is much wider than the
// polygon because the LABELS need the width, not the shape — `gutter` buys the
// side labels their LABEL_ROOM, while `size`/`padding` are kept just tight
// enough to clear the top and bottom labels, so the card doesn't reserve a
// square of mostly-empty paper on a phone.
export function radarGeometry(spokes, { size = 280, padding = 50, gutter = 60 } = {}) {
  const count = spokes.length
  const width = size + gutter * 2
  const cx = width / 2
  const cy = size / 2
  const r = size / 2 - padding
  const frame = { cx, cy, r }
  if (count < 3) return null

  const points = spokes.map((s, i) => {
    const known = Number.isFinite(s.percentile)
    const radius = known ? Math.max(s.percentile / 100, MIN_RADIUS) : AVERAGE_RING
    return { ...pointAt(i, count, radius, frame), known }
  })

  return {
    size,
    width,
    height: size,
    center: { x: cx, y: cy },
    radius: r,
    // The outer ring — "best in the league" — and the dashed average ring.
    outline: path(spokes.map((_, i) => pointAt(i, count, 1, frame))),
    averageRing: path(spokes.map((_, i) => pointAt(i, count, AVERAGE_RING, frame))),
    // The player's own shape.
    shape: path(points),
    points,
    // One axis line per spoke, centre to rim, plus the anchor the label hangs
    // off. Labels sit a little OUTSIDE the rim; `anchor`/`baseline` are the SVG
    // text-anchor and dominant-baseline that keep a label from overlapping the
    // polygon it describes — a spoke at 12 o'clock wants its text centred above
    // the rim, one at 3 o'clock wants it left-aligned to the right of it.
    axes: spokes.map((s, i) => {
      const rim = pointAt(i, count, 1, frame)
      const label = pointAt(i, count, (r + LABEL_OFFSET) / r, frame)
      const dx = label.x - cx
      const dy = label.y - cy
      return {
        key: s.key,
        label: s.label,
        value: s.value,
        percentile: Number.isFinite(s.percentile) ? s.percentile : null,
        lowerIsBetter: Boolean(s.lowerIsBetter),
        x2: round(rim.x),
        y2: round(rim.y),
        labelX: round(label.x),
        labelY: round(label.y),
        anchor: nearZero(dx) ? 'middle' : dx > 0 ? 'start' : 'end',
        baseline: nearZero(dy) ? 'middle' : dy > 0 ? 'hanging' : 'auto',
      }
    }),
  }
}

// A spoke within a hair of dead-centre horizontally/vertically counts as
// centred — floating point never gives exactly 0 for cos(-π/2).
function nearZero(n) {
  return Math.abs(n) < 0.001
}
