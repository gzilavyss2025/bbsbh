import { directionOf, sprayAngle } from '../../../../../api/spray.js'
import { HIT_COORD_FT_PER_UNIT, HIT_COORD_ORIGIN } from '../../../../../lib/ballpark/hitProjection.js'
import { typeOf } from './contactView.js'

// The spray chart as nine zones (#2975, round 3, Gary 2026-11-12): WHERE each ball went, pull /
// center / oppo by infield / shallow outfield / deep outfield. Direction is the spray store's own
// 30° thirds, read through the side of each ball (a switch hitter flips per ball). Depth is the
// hit coordinate's distance from the plate: where the ball was fielded or landed. Ball type is a
// launch angle, not a place, so it is a filter over the nine, never a ring of them; a pop-up
// folds into fly ball. A ball with no coordinate cannot be placed; one with no launch angle is
// placed under All but not under a type.
export const ZONE_DIRS = [['pull', 'Pull'], ['center', 'Center'], ['oppo', 'Oppo']]
// Outer edge of each band in feet (Inference: about the infield's edge, then shallow vs. deep).
export const ZONE_DEPTHS = [['infield', 'Infield', 150], ['shallow', 'Shallow OF', 250], ['deep', 'Deep OF', Infinity]]
// Short labels so the four fit one row at 390 px beside the other controls.
export const ZONE_TYPES = [[null, 'All'], ['ground', 'Ground'], ['line', 'Line'], ['fly', 'Fly']]

const zoneType = (la) => (typeOf(la) === 'pop' ? 'fly' : typeOf(la))
const feet = (b) =>
  Math.hypot(b.x - HIT_COORD_ORIGIN.x, HIT_COORD_ORIGIN.y - b.y) * HIT_COORD_FT_PER_UNIT
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
    ZONE_DIRS.map(([dir]) => {
      const c = counts.get(`${dir}:${depth}`) ?? 0
      return { dir, depth, n: c, share: n ? c / n : null }
    }),
  )
  return { cells, n }
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
