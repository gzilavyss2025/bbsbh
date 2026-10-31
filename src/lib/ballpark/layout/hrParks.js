import { CONFIGURATIONS } from './configurations.js'
import { resolveBallparkLayout } from './resolveLayout.js'
import { HOME, wallDistanceAt, wallHeightAt } from '../ballparkGeometry.js'
import { bearing } from './fenceShape.js'

// The major-league parks (our curated registry). Resolved on the game's date, so a park
// that closed or moved its wall counts as it stood then.
const VENUE_IDS = [...new Set(CONFIGURATIONS.map((c) => c.venueId))]

// (ball) -> null | { leaves: [park name], stays: [park name] } for one batted ball: which parks it
// would have been a home run in (#2695). `ball` is selectPlayBattedBall's shape plus `gameDate`.
// AN ESTIMATE: the parkFit.js rule, a ball leaves when its distance is more than the wall's distance on
// its own bearing PLUS the wall's height there (about a foot of carry per foot of wall). Wind and air
// are ignored, so the count can differ from Savant's. Null with no landing or no distance, or for a
// ball outside the foul poles (no wall stands there).
export function hrParks(ball) {
  if (ball?.x == null || ball?.y == null || !(ball.distance > 0)) return null
  const deg = bearing([ball.x - HOME.x, HOME.y - ball.y])
  const leaves = []
  const stays = []
  for (const venueId of VENUE_IDS) {
    const layout = resolveBallparkLayout({ venueId, gameDate: ball.gameDate })
    if (!layout) continue
    const wall = wallDistanceAt(layout, deg)
    if (wall == null) return null
    ;(ball.distance > wall + (wallHeightAt(layout, deg) ?? 0) ? leaves : stays).push(layout.name)
  }
  return { leaves, stays }
}
