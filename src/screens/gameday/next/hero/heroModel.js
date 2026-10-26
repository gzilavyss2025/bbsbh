import { pitchLadder } from '../../../../api/playbyplay/pitchInfo.js'

// The hero's pure parts: what the scorebook box draws for one at-bat entry (a computeHalfInningFeed
// card, already clamped to the reader's cursor by its caller), and the words around it.

const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
export const ordinal = (n) => ORD[n] ?? ''

// Two pitch columns (numbers, X for the ball put in play), the legs the batter ran as of the cursor
// (4 = scored), the code, the RBI and the out number. A called third strike has no code by design
// (scorebookCode.js): `looking` tells the box to draw the backwards K.
export function boxModel(e) {
  const ladder = pitchLadder(e.pitches ?? [])
  const looking = Boolean(e.calledLooking)
  return {
    balls: ladder.filter((p) => p.side === 'ball').map((p) => p.label),
    strikes: ladder.filter((p) => p.side === 'strike').map((p) => p.label),
    legs: e.scored ? 4 : e.reached ?? 0,
    code: looking ? 'K' : e.code ?? '',
    looking,
    rbi: e.rbi ?? 0,
    out: e.outNumber ?? null,
  }
}

// "103 mph · 30° · 382 ft"; a ground ball's distance is where it was fielded, so it is left out.
export function contactLine(e) {
  const b = e.battedBall
  if (!b || b.exitVelo == null) return ''
  const parts = [`${Math.round(b.exitVelo)} mph`]
  if (b.launchAngle != null) parts.push(`${b.launchAngle}°`)
  if (b.distance != null && b.trajectory !== 'ground_ball') parts.push(`${b.distance} ft`)
  return parts.join(' · ')
}

export const playLine = (e) => (e.descSegments ?? []).map((s) => s.text ?? '').join('').trim()
