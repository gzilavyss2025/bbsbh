import { directionOf, sprayAngle } from '../../../../../api/spray.js'
import { HOME } from '../../../../../lib/ballpark/ballparkGeometry.js'
import { hitCoordToSvg } from '../../../../../lib/ballpark/hitProjection.js'
import { typeOf } from './contactView.js'

// The spray chart as nine zones (#2975, round 3, Gary 2026-11-12): WHERE each ball went, pull /
// center / oppo by infield / shallow outfield / deep outfield. Direction is the spray store's own
// 30° thirds, read through the side of each ball (a switch hitter flips per ball). Depth is the
// hit coordinate's distance from the plate: where the ball was fielded or landed. Ball type is a
// launch angle, not a place, so it is a filter over the nine, never a ring of them; a pop-up
// folds into fly ball. A ball with no coordinate cannot be placed; one with no launch angle is
// placed under All but not under a type.
export const ZONE_DIRS = { pull: 'Pull', center: 'Center', oppo: 'Oppo' }
// Outer edge of each band in feet (Inference: about the infield's edge, then shallow vs. deep).
export const ZONE_DEPTHS = [['infield', 'Infield', 150], ['shallow', 'Shallow OF', 250], ['deep', 'Deep OF', Infinity]]
// Short labels so the four fit one row at 390 px. "Any type", not "All": the row above already
// has an All (every ball in play), and two Alls a row apart read as one choice.
export const ZONE_TYPES = [[null, 'Any type'], ['ground', 'Ground'], ['line', 'Line'], ['fly', 'Fly']]

// The zones' type for a module type key (a card, or a ball's typeOf): a pop-up is a fly ball here.
// The card menu's pick drives the Zones filter through this (Gary, 2026-11-12); null is Any type.
export const zoneTypeForCard = (t) => (t === 'pop' ? 'fly' : t)
const zoneType = (la) => zoneTypeForCard(typeOf(la))
// A point `ft` feet from the plate, `deg` off dead centre, in the field's SVG space: [x, y] strings.
export const polar = (deg, ft) => {
  const r = (deg * Math.PI) / 180
  return [HOME.x + ft * Math.sin(r), HOME.y - ft * Math.cos(r)].map((v) => v.toFixed(1))
}
// The same projection the dots are drawn with (SVG units are feet), so a dot and its zone agree.
const feet = (b) => {
  const p = hitCoordToSvg(b.x, b.y)
  return Math.hypot(p.x - HOME.x, p.y - HOME.y)
}
const depthOf = (ft) => ZONE_DEPTHS.find(([, , edge]) => ft < edge)[0]

export function contactZones(balls, type = null) {
  const counts = new Map()
  let n = 0
  for (const b of balls) {
    if (type && zoneType(b.launchAngle) !== type) continue
    const dir = directionOf(sprayAngle(b.x, b.y), b.side)
    if (!dir) continue
    const key = `${dir}:${depthOf(feet(b))}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
    n++
  }
  const cells = ZONE_DEPTHS.flatMap(([depth]) =>
    Object.keys(ZONE_DIRS).map((dir) => {
      const c = counts.get(`${dir}:${depth}`) ?? 0
      return { dir, depth, n: c, share: n ? c / n : null }
    }),
  )
  // `byKey['pull:deep']`: the same cells, for readers that walk them in another order.
  return { cells, n, byKey: Object.fromEntries(cells.map((c) => [`${c.dir}:${c.depth}`, c])) }
}

// The thirds as they sit on the field, left field to right field, so a table beside the field
// reads in the same order: a right-handed hitter pulls to left field.
export const fieldOrder = (side) => (side === 'L' ? ['oppo', 'center', 'pull'] : ['pull', 'center', 'oppo'])

// Darker always means more, on ONE fixed scale for every ball type (Gary, 2026-11-12): a share
// sets the OKLCH lightness and the type sets only the hue. The scale jumps over 0.66–0.54, the
// band where neither label colour clears 4.5:1 on every hue (test/contact-zones.test.js checks).
export function zoneLightness(share) {
  const t = Math.min((share ?? 0) / 0.3, 1)
  return t < 0.5 ? 0.95 - 0.29 * (t / 0.5) : 0.54 - 0.29 * ((t - 0.5) / 0.5)
}
export const zoneLabelOnLight = (share) => zoneLightness(share) > 0.6

// Each filter's hue as OKLCH [chroma, hue°], from its token (--zone-all, --batted-ground/-line/-fly
// in tokens/colors.css; the test fails if they drift). A plain oklch() fill, not CSS relative
// colour: relative colour needs Safari 18, and a dropped fill paints the SVG default black.
const ZONE_HUES = { all: [0.0218, 83.0], ground: [0.1467, 28.5], line: [0.0827, 159.6], fly: [0.036, 250.8] }
export const zoneHue = (type) => ZONE_HUES[type ?? 'all']
export function zoneFill(type, share) {
  const [c, h] = zoneHue(type)
  return `oklch(${zoneLightness(share).toFixed(3)} ${(c * 0.9).toFixed(4)} ${h})`
}

// The Zones view for a screen reader: the drawn percentages are bare text, so the field's label
// carries every zone by name, deep to infield and left field to right field, like the table.
const TYPE_NAMES = { ground: 'Ground balls', line: 'Line drives', fly: 'Fly balls' }
const DEPTH_NAMES = { infield: 'infield', shallow: 'shallow outfield', deep: 'deep outfield' }
export function zoneSummary(zones, side, type) {
  const head = TYPE_NAMES[type] ?? 'All balls in play'
  if (!zones.n) return `${head}: none placed.`
  const parts = [...ZONE_DEPTHS].reverse().flatMap(([depth]) =>
    fieldOrder(side).map((dir) => {
      const c = zones.byKey[`${dir}:${depth}`]
      return `${DEPTH_NAMES[depth]} ${dir} ${Math.round(c.share * 100)}%`
    }),
  )
  return `${head}, ${zones.n} placed: ${parts.join(', ')}.`
}
