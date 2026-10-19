import { directionOf, sprayAngle } from '../../../../api/spray.js'
import { shares } from './pitchByPitch.js'

// PARK FIT (#2316): where each Series club's fly balls go, as pull, centre and opposite-field
// shares, set beside the Milwaukee field. Pure. The balls are decodeSprayBalls rows (api/spray.js)
// for the club's regulars; the pull side is read through the side each ball was hit from.
export const MILWAUKEE_VENUE_ID = 32
// Statcast's fly-ball band: launch angle 25 to 50 degrees. A ball with no launch angle is left out.
const FLY_MIN = 25
const FLY_MAX = 50
// Under this many fly balls a share is an anecdote, so the club (and the card) draws nothing.
export const MIN_FLY = 30

const ROWS = [
  { key: 'pull', label: 'Pull' },
  { key: 'center', label: 'Center' },
  { key: 'oppo', label: 'Opposite field' },
]

// (balls) -> null | { n, pull, center, oppo } whole-number shares that add up to 100.
export function flyShares(balls) {
  const count = { pull: 0, center: 0, oppo: 0 }
  let n = 0
  for (const b of balls ?? []) {
    if (!(b.launchAngle >= FLY_MIN && b.launchAngle <= FLY_MAX)) continue
    const third = directionOf(sprayAngle(b.x, b.y), b.side)
    if (!third) continue
    count[third]++
    n++
  }
  if (n < MIN_FLY) return null
  const [pull, center, oppo] = shares([count.pull, count.center, count.oppo])
  return { n, pull, center, oppo }
}

// (ballsByClub { [clubId]: balls }, { clubA, clubB }) -> null | { rows: [{ key, label, shares: [a, b] }], counts: [a, b] }
export function parkFitModel(ballsByClub, { clubA, clubB }) {
  const [a, b] = [clubA, clubB].map((id) => flyShares(ballsByClub?.[id]))
  if (!a || !b) return null
  return { rows: ROWS.map(({ key, label }) => ({ key, label, shares: [a[key], b[key]] })), counts: [a.n, b.n] }
}
