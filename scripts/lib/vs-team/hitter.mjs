// A hitter's career line against one club, from his summed components
// (gen-vs-team-splits.mjs). Pure, so test/vs-team-splits.test.js can import it.
import { mlbOps, rate3 } from '../../../src/api/person/shared.js'

export function hitterCar(s) {
  const obDen = s.ab + s.bb + s.hbp + s.sf
  const obp = obDen > 0 ? (s.h + s.bb + s.hbp) / obDen : 0
  const slg = s.ab > 0 ? s.tb / s.ab : 0
  return {
    g: s.g, pa: s.pa, ab: s.ab, h: s.h, avg: s.ab > 0 ? rate3(s.h / s.ab) : '.000', hr: s.hr,
    xbh: s.d + s.t + s.hr, rbi: s.rbi, bb: s.bb, so: s.so,
    obp: rate3(obp), slg: rate3(slg),
    ops: rate3(mlbOps(obp, slg)), // MLB's own rounding, not the full-precision sum (#1275)
  }
}
