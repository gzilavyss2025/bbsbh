// The zone edge one missed call is off, for the build-time ABS scripts (missEdge below). The
// in-game favor selector that also lived here went with the old StatBox card (#2566).

const HALF_PLATE = 8.5 / 12
const BALL_R = 1.45 / 12

// Attribute one missed call to a single zone edge — the boundary it's most on
// the wrong side of (expanded misses, clearance < 0) or nearest to (squeezed
// misses, clearance > 0 but smallest) — plus how far off that edge it was, in
// inches. Deliberately mirrors gen-umpire-accuracy.mjs's missRegion exactly
// (same formula, same batter-oriented horizontal flip) so the live "worst
// call" edge and the season zone-map tendency never disagree about which
// edge a given pitch belongs to.
//
// EXPORTED for scripts/gen-abs-challenges.mjs, which needs the same edge
// distance for the pitch a club challenged and would otherwise be the THIRD
// copy of this formula in the repo. It is pure geometry over one pitch — no
// feed, no game state, nothing sealed — so a build-time importer is the same
// arrangement gen-umpire-accuracy.mjs already has with challenges.js's
// challengesForPlay. No UI module may import it: this file stays reveal-only.
export function missEdge(pX, pZ, top, bot, batSide) {
  const bx = batSide === 'L' ? -pX : pX
  const clearances = {
    high: top + BALL_R - pZ, // <0 ⇒ above the zone
    low: pZ - (bot - BALL_R), // <0 ⇒ below the zone
    inside: HALF_PLATE + BALL_R - bx, // <0 ⇒ too far inside
    outside: bx + (HALF_PLATE + BALL_R), // <0 ⇒ too far outside
  }
  let edge = 'high'
  let min = Infinity
  for (const [k, v] of Object.entries(clearances)) {
    if (v < min) {
      min = v
      edge = k
    }
  }
  return { edge, inches: Math.abs(min) * 12 }
}

