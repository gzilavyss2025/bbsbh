import { sprayAngle } from '../../../../../api/spray.js'
import { HOME } from '../../../../../lib/ballpark/ballparkGeometry.js'
import { hitCoordToSvg } from '../../../../../lib/ballpark/hitProjection.js'
import { typeOf } from './contactView.js'

// The spray chart as nine zones (#2975, round 3, Gary 2026-11-12): WHERE each ball went, the left /
// center / right thirds of fair ground (30° each) by infield / shallow outfield / deep outfield.
// The thirds are the field's own, never the batter's, so a switch hitter's balls from both boxes
// land where they went; the side only names them (zoneNames). Depth is the hit coordinate's
// distance from the plate: where the ball was fielded or landed. Ball type is a launch angle, not a
// place, so it is a filter over the nine, never a ring of them; a pop-up folds into fly ball. A ball
// with no coordinate cannot be placed; one with no launch angle is placed under All only.
export const ZONE_THIRDS = ['left', 'center', 'right'] // left field to right field
const CENTER_DEG = 15 // the centre third: ±15° of dead centre, the spray store's own split
const thirdOf = (deg) => (deg == null ? null : deg < -CENTER_DEG ? 'left' : deg > CENTER_DEG ? 'right' : 'center')

// The batter's side for naming the thirds: 'S' when the other box has at least a tenth of his
// balls (Inference: a stray ball recorded from the other box does not make a switch hitter).
export function batterSide(balls) {
  const l = balls.filter((b) => b.side === 'L').length
  const minor = Math.min(l, balls.length - l)
  return balls.length && minor / balls.length >= 0.1 ? 'S' : l * 2 > balls.length ? 'L' : 'R'
}
// The thirds' names: pull is left field for a right-handed hitter, right field for a left-handed
// one. A switch hitter pulls to both, so his thirds take the field's names.
export function zoneNames(side) {
  if (side === 'S') return { left: 'LF', center: 'CF', right: 'RF' }
  return side === 'L' ? { left: 'Oppo', center: 'Center', right: 'Pull' } : { left: 'Pull', center: 'Center', right: 'Oppo' }
}
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
    const dir = thirdOf(sprayAngle(b.x, b.y))
    if (!dir) continue
    const key = `${dir}:${depthOf(feet(b))}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
    n++
  }
  const cells = ZONE_DEPTHS.flatMap(([depth]) =>
    ZONE_THIRDS.map((dir) => {
      const c = counts.get(`${dir}:${depth}`) ?? 0
      return { dir, depth, n: c, share: n ? c / n : null }
    }),
  )
  // `byKey['pull:deep']`: the same cells, for readers that walk them in another order.
  return { cells, n, byKey: Object.fromEntries(cells.map((c) => [`${c.dir}:${c.depth}`, c])) }
}

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
const SPOKEN = { LF: 'left field', CF: 'center field', RF: 'right field' }
export function zoneSummary(zones, side, type) {
  const head = TYPE_NAMES[type] ?? 'All balls in play'
  if (!zones.n) return `${head}: none placed.`
  const parts = [...ZONE_DEPTHS].reverse().flatMap(([depth]) =>
    ZONE_THIRDS.map((dir) => {
      const c = zones.byKey[`${dir}:${depth}`]
      const name = zoneNames(side)[dir]
      return `${DEPTH_NAMES[depth]} ${SPOKEN[name] ?? name.toLowerCase()} ${Math.round(c.share * 100)}%`
    }),
  )
  return `${head}, ${zones.n} placed: ${parts.join(', ')}.`
}
