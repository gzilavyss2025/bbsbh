import { directionOf, sprayAngle } from '../../../../api/spray.js'
import { wallDistanceAt, wallHeightAt } from '../../../ballpark/ballparkGeometry.js'
import { resolveBallparkLayout } from '../../../ballpark/layout/resolveLayout.js'
import { shares } from './pitchByPitch.js'

// PARK FIT (#2316): where each Series club's fly balls go, as pull, centre and opposite-field
// shares, and how many of them carry past each Series park's wall. Pure. The balls are
// decodeSprayBalls rows (api/spray.js) for the club's regulars; the pull side is read through the
// side each ball was hit from.
// Statcast's fly-ball band: launch angle 25 to 50 degrees. A ball with no launch angle is left out.
const FLY_MIN = 25
const FLY_MAX = 50
// Under this many fly balls a share is an anecdote, so the club (and the card) draws nothing.
export const MIN_FLY = 30
// Under this many fly balls in one direction, its carry figure is a dash. Chosen by Gary, 2026-10-21: a
// rate over fewer is too noisy (about 11 points either way at 20 balls, 16 at 10). Both Series clubs have
// more than 100 in every direction, so today it changes nothing.
export const MIN_CARRY = 20

const ROWS = [
  { key: 'pull', label: 'Pull' },
  { key: 'center', label: 'Center' },
  { key: 'oppo', label: 'Opposite field' },
]

// A regular's Triple-A balls are not the club's regular season, so only the majors count.
const isFly = (b) => b.level === 'mlb' && b.launchAngle >= FLY_MIN && b.launchAngle <= FLY_MAX

// (balls) -> null | { n, pull, center, oppo } whole-number shares that add up to 100.
export function flyShares(balls) {
  const count = { pull: 0, center: 0, oppo: 0 }
  let n = 0
  for (const b of balls ?? []) {
    if (!isFly(b)) continue
    const third = directionOf(sprayAngle(b.x, b.y), b.side)
    if (!third) continue
    count[third]++
    n++
  }
  if (n < MIN_FLY) return null
  const [pull, center, oppo] = shares([count.pull, count.center, count.oppo])
  return { n, pull, center, oppo }
}

// (balls, layout) -> { pull, center, oppo }: the whole-number share of the club's fly balls in that
// direction that carry past `layout`'s wall, or null under MIN_CARRY balls. AN ESTIMATE, and the card
// says so. A ball counts when its distance is more than the wall's distance on its own angle PLUS the
// wall's height there: a ball coming down at about 45 degrees (an assumption) needs about a foot of
// carry for each foot of wall. Wind and air are ignored. A park with no heights on file asks for the
// distance alone. A ball with no distance is left out, and so is one outside the foul poles (no wall
// stands there).
//
// WHY THE HEIGHT (2026-10-21). On the balls each club hit at its OWN park, where the real result is
// known (2026 regular season: the Rays' 308 at Tropicana, the Brewers' 300 at American Family), distance
// alone agreed with "was it a home run" on 94.5% and 96.3% of balls and read 20.5% and 23.7% against
// real rates of 14.9% and 20.0%. With the height it agrees on 97.7% and 98.7% and reads 17.2% and 20.0%.
export function carryRates(balls, layout) {
  const t = { pull: [0, 0], center: [0, 0], oppo: [0, 0] } // [carried, counted]
  for (const b of balls ?? []) {
    if (!isFly(b) || b.distance == null) continue
    const angle = sprayAngle(b.x, b.y)
    const third = directionOf(angle, b.side)
    if (!third) continue
    const wall = wallDistanceAt(layout, angle)
    if (wall == null) continue
    t[third][1]++
    if (b.distance > wall + (wallHeightAt(layout, angle) ?? 0)) t[third][0]++
  }
  const rate = ([carried, counted]) => (counted >= MIN_CARRY ? Math.round((100 * carried) / counted) : null)
  return { pull: rate(t.pull), center: rate(t.center), oppo: rate(t.oppo) }
}

// (ballsByClub { [clubId]: balls }, { clubA, clubB, layouts }) ->
//   null | { rows: [{ key, label, shares: [a, b] }], counts: [a, b], carry }
// `carry[i]` is the block for `layouts[i]`: [{ key, label, rates: [a, b] }], a rate null when it has no figure.
export function parkFitModel(ballsByClub, { clubA, clubB, layouts = [] }) {
  const [a, b] = [clubA, clubB].map((id) => flyShares(ballsByClub?.[id]))
  if (!a || !b) return null
  return {
    rows: ROWS.map(({ key, label }) => ({ key, label, shares: [a[key], b[key]] })),
    counts: [a.n, b.n],
    carry: layouts.map((layout) => {
      const [ra, rb] = [clubA, clubB].map((id) => carryRates(ballsByClub[id], layout))
      return ROWS.map(({ key, label }) => ({ key, label, rates: [ra[key], rb[key]] }))
    }),
  }
}

// The parks the card draws, one per Series club in `sides` order: [{ clubId, layout, ink }].
// `venueByClub` is each club's home park from the static teams file. The focus game's own venue wins
// for the club that hosts it, so a game moved to another park still draws the park it is played in.
// A club whose park has no layout is left out, and a park two clubs share is drawn once. It names no club.
// `ink` (0 or 1) is the park's colour on the map. It follows the club, not its place in `sides`, which
// turns over from away to home during the Series: the lower club id is 0 whichever park resolves.
export function fitParks({ sides, venueByClub, game, slateDate }) {
  const seen = new Set()
  const parks = []
  const first = Math.min(...sides)
  for (const clubId of sides) {
    const venueId = (game?.homeId === clubId && game.venue?.id) || venueByClub?.[clubId] || null
    const layout = venueId ? resolveBallparkLayout({ venueId, gameDate: slateDate }) : null
    if (!layout || seen.has(layout.configurationId)) continue
    seen.add(layout.configurationId)
    parks.push({ clubId, layout, ink: clubId === first ? 0 : 1 })
  }
  return parks
}
