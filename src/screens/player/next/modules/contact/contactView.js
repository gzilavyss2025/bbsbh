import { MIN_SPRAY_BIP } from '../../../../../api/spray.js'
import { rate3 } from '../../../../../api/person/shared.js'
import { HARD_HIT_MPH } from '../../../../../lib/ballpark/hitProjection.js'
import { monthDayName } from '../../../../../lib/dates.js'

// The batter Contact module's pure view (#1888). The balls come from decodeSprayBalls
// (api/spray.js) with the contact store joined on, so each carries launch angle, distance and
// the stored xBA. An open surface (ADR-0034): decided games only, no gate.

export const VIEWS = [['hr', 'Home runs'], ['hit', 'Hits'], ['all', 'All balls']]
export const COLORS = [['result', 'Result'], ['type', 'Ball type']]
const RESULT_NAMES = { out: 'Out', single: 'Single', double: 'Double', triple: 'Triple', hr: 'Home run' }
export const TYPES = [['ground', 'Ground ball'], ['line', 'Line drive'], ['fly', 'Fly ball'], ['pop', 'Pop-up']]

const DASH = '—'
const avg = (xs) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null)
const known = (balls, k) => balls.map((b) => b[k]).filter((x) => x != null)

// Statcast's bands on launch angle: ground under 10, line drive to 25, fly ball to 50, pop-up above.
export const typeOf = (la) => (la == null ? null : la < 10 ? 'ground' : la < 25 ? 'line' : la <= 50 ? 'fly' : 'pop')

// The balls with the date of their game (`dates`: gamePk to day, from the game log). With `asOf`
// only games before that day stay; a ball whose date is unknown stays out, since it cannot be
// shown to be earlier (so a failed game-log read empties a dated view, never leaks a ball).
// Major-league balls only: the log that dates them is the major-league one.
export function contactBalls(balls, dates, asOf) {
  return balls
    .filter((b) => b.level === 'mlb')
    .map((b) => ({ ...b, date: dates.get(b.gamePk) ?? null }))
    .filter((b) => !asOf || (b.date && b.date < asOf))
}

// The card, or null under the spray card's floor (a thin sample is a sketch, not a picture).
export function contactView(balls) {
  if (balls.length < MIN_SPRAY_BIP) return null
  return {
    balls,
    counts: {
      hr: balls.filter((b) => b.result === 'hr').length,
      hit: balls.filter((b) => b.result !== 'out').length,
      all: balls.length,
    },
  }
}

// The view a card opens on: the first of home runs, hits, all balls that has a ball to show.
export const firstView = (c) => VIEWS.find(([k]) => c[k])[0]

export function pickBalls(balls, view, type) {
  return balls.filter(
    (b) => (view === 'all' || (view === 'hr' ? b.result === 'hr' : b.result !== 'out')) && (!type || typeOf(b.launchAngle) === type),
  )
}

export const markKey = (b, color) => (color === 'type' ? typeOf(b.launchAngle) ?? 'none' : b.result)

// One row per ball type, in a fixed order: share of the balls with an angle, hit rate (`avg`, the
// shape BattedBallMix reads) and the averages the board prints. Null when no ball has an angle.
export function mixRows(balls) {
  const typed = balls.filter((b) => typeOf(b.launchAngle))
  if (!typed.length) return null
  return TYPES.map(([key, name]) => {
    const rows = typed.filter((b) => typeOf(b.launchAngle) === key)
    const evs = known(rows, 'exitVelo')
    return {
      key,
      name,
      n: rows.length,
      share: rows.length / typed.length,
      avg: rows.length ? rows.filter((b) => b.result !== 'out').length / rows.length : null,
      ev: avg(evs),
      hard: evs.length ? evs.filter((v) => v >= HARD_HIT_MPH).length / evs.length : null,
      barrel: rows.filter((b) => b.barrel).length,
      la: avg(known(rows, 'launchAngle')),
      dist: avg(known(rows, 'distance')),
      xba: avg(known(rows, 'xba')),
    }
  })
}

// The panel for the ball a reader tapped.
export function ballDetail(b) {
  const f = (v, fn) => (v == null ? DASH : fn(v))
  return {
    eyebrow: RESULT_NAMES[b.result] ?? '',
    when: monthDayName(b.date),
    big: f(b.distance, String),
    unit: b.distance == null ? '' : 'ft',
    stats: [
      ['Exit velo', f(b.exitVelo, (v) => `${v.toFixed(1)} mph`)],
      ['Launch angle', f(b.launchAngle, (v) => `${v}°`)],
      ['xBA', f(b.xba, rate3)],
      ['Barrel', f(b.barrel, (v) => (v ? 'Yes' : 'No'))],
    ],
  }
}
