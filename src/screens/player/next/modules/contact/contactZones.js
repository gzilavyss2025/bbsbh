import { directionOf, sprayAngle } from '../../../../../api/spray.js'
import { typeOf } from './contactView.js'

// The spray chart as nine zones (#2975): pull / center / oppo by ground ball / line drive /
// fly ball, each a share of the balls that could be placed. Direction is the spray store's own
// 30° thirds, read through the side of each ball (a switch hitter flips per ball). Type is the
// module's launch-angle band; a pop-up folds into fly ball (Gary, 2026-11-12). A ball with no
// angle or no coordinate cannot be placed: it is counted in `leftOut`, never guessed.
export const ZONE_DIRS = [['pull', 'Pull'], ['center', 'Center'], ['oppo', 'Oppo']]
export const ZONE_TYPES = [['ground', 'Ground ball'], ['line', 'Line drive'], ['fly', 'Fly ball']]

const zoneType = (la) => (typeOf(la) === 'pop' ? 'fly' : typeOf(la))

export function contactZones(balls) {
  const counts = new Map()
  let n = 0
  for (const b of balls) {
    const type = zoneType(b.launchAngle)
    const dir = directionOf(sprayAngle(b.x, b.y), b.side)
    if (!type || !dir) continue
    counts.set(`${dir}:${type}`, (counts.get(`${dir}:${type}`) ?? 0) + 1)
    n++
  }
  const cells = ZONE_TYPES.flatMap(([type]) =>
    ZONE_DIRS.map(([dir]) => {
      const c = counts.get(`${dir}:${type}`) ?? 0
      return { dir, type, n: c, share: n ? c / n : null }
    }),
  )
  return { cells, n, leftOut: balls.length - n }
}
