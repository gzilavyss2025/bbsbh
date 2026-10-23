// Which fence outline a configuration draws, and how sure it is (#1859). The
// one place that decides it: ../ballparkData.js asks for the current park's
// outline, ./resolveLayout.js for any configuration's, and both get the same
// answer. No import of ballparkData.js, so neither import closes a cycle.
//
// Quality levels:
//   'audited'         an outline that passed its audit (Gameday against Savant's
//                     measurements, or a 2018 trace against the posted CF);
//   'estimated'       a minor-league outline from MLB's older Gameday art, checked
//                     only against the posted signs (no measured survey exists);
//                     or a 2018 trace that misses the posted CF;
//                     or a smooth wall through three posted signs (`threePointWall`);
//   'dimensions-only' no outline, five posted distances;
//   'missing'         not even those.

import FIELDS from './fields.js'
import { WALLS } from '../ballparkFields.js'
import { auditFence } from './fenceAudit.js'

export { FIELDS }

// A smooth wall through a park's left-line, center and right-line signs, for a
// minor-league park that posts those three and not the gaps (41 of 119 in the
// 2026 import, #2612). No source gives the gaps, so they are INTERPOLATED: the
// wall's radius is the one parabola in bearing through the three signs, which
// bows outward toward center and never kinks (a single posted gap sign bends it
// through that sign too). The gap distances it draws are otherwise a
// guess, which is why the quality is 'estimated' and not 'audited'. Home is
// (0,0), +x toward right field, +y toward center; every 2.5 degrees from the
// left-field line (-45) to the right-field line (45), so it ends on both lines.
const WALL_STEP_DEG = 2.5
export function threePointWall(posted) {
  const { lf, lc, cf, rc, rf } = posted ?? {}
  if (![lf, cf, rf].every(Number.isFinite)) return null
  // With both gap signs the five-point wall is the better record; leave it.
  if (Number.isFinite(lc) && Number.isFinite(rc)) return null
  const bow = (lf + rf) / 2 - cf // radius at +-45 degrees, relative to center
  const tilt = (rf - lf) / 2
  // One posted gap sign (at t = -0.5 or +0.5, i.e. +-22.5 degrees) bends the
  // parabola with a cubic that is zero at the three signs: t(t^2-1) is -0.375 at
  // t = 0.5 and +0.375 at t = -0.5. Both gaps posted is the five-point wall's job.
  const gapT = Number.isFinite(lc) ? -0.5 : Number.isFinite(rc) ? 0.5 : null
  const gap = gapT === null ? 0 : (Number.isFinite(lc) ? lc : rc) - (cf + bow * gapT * gapT + tilt * gapT)
  const bend = gapT === null ? 0 : gap / (gapT * (gapT * gapT - 1))
  const points = []
  for (let deg = -45; deg <= 45 + 1e-9; deg += WALL_STEP_DEG) {
    const t = deg / 45
    const r = cf + bow * t * t + tilt * t + bend * t * (t * t - 1)
    const rad = (deg * Math.PI) / 180
    points.push([Math.round(r * Math.sin(rad) * 10) / 10, Math.round(r * Math.cos(rad) * 10) / 10])
  }
  return points
}

// The minor-league parks the importer could draw, as configurations shaped
// like ./configurations.js's. No dated history exists for them, so each
// covers the imported season onward: an older game at the park resolves to
// nothing rather than to a wall nobody checked for that year.
export const MILB_CONFIGURATIONS = Object.entries(FIELDS.milb?.venues ?? {}).map(([id, v]) => ({
  id: `milb-${id}`,
  venueId: Number(id),
  park: null,
  // Every name the importer saw for this season and next: a sponsor rename
  // keeps the venue id, and the name fallback knows both names.
  names: v.names ?? (v.name ? [v.name] : []),
  from: `${FIELDS.season}-01-01`,
  to: null,
  fence: v.fence || threePointWall(v.posted) ? 'milb' : null,
  dist: v.posted,
  wall: null,
  sources: [FIELDS.milb.sources.posted.replace('{venueId}', id)],
}))

// The two softer layers of a CURRENT configuration (#1859, slice 5), from the
// same Gameday drawing as its outline: the playing surface (fair and foul, out
// to the stands) and the warning track's inner edge. Each was stored only when
// plausible (scripts/lib/ballpark/field-svg.mjs's checkLayers). They are
// estimates of a drawing, not measurements, and no note says so on screen: the
// owner's call (2026-10-12), since nobody reads foul ground as a measurement.
// An older configuration, a minor-league park or a park whose layer failed
// gets null, and the renderer draws its stylized layer.
export function softLayersFor(config) {
  const v = config.fence === 'gameday' && config.to == null ? FIELDS.venues[config.venueId] : null
  return { surface: v?.surface ?? null, trackInner: v?.trackInner ?? null }
}

// Savant's measured row for a venue, for the season fields.js was imported
// for. Only a CURRENT configuration may use it; an older one predates it.
export function measuredFor(config) {
  return config.to == null ? FIELDS.venues[config.venueId]?.measured ?? null : null
}

// `dist` is the configuration's posted distances (the CF sign is where the
// label goes, so the marker angle is read against the posted CF).
export function fenceFor(config, dist) {
  let points = null
  let audit = null
  let source = null
  if (config.fence === 'gameday' && config.to == null) {
    const v = FIELDS.venues[config.venueId]
    if (v?.fence) {
      points = v.fence
      audit = v.audit
      source = { kind: 'gameday', season: FIELDS.season, url: FIELDS.sources.fence.replace('{venueId}', config.venueId) }
    }
  } else if (config.fence === 'milb') {
    const v = FIELDS.milb.venues[config.venueId]
    points = v.fence ?? threePointWall(v.posted)
    audit = v.audit
    source = { kind: 'milb', season: FIELDS.season, url: FIELDS.milb.sources.fence.replace('{venueId}', config.venueId) }
  } else if (config.fence === 'seed') {
    points = WALLS[config.seedKey] ?? null
    audit = points ? auditFence(points, dist?.cf) : null
    source = points ? { kind: 'seed', key: config.seedKey } : null
  }
  if (points) {
    const marker = auditFence(points, dist?.cf)
    const quality = source.kind === 'gameday' || (source.kind === 'seed' && audit?.pass) ? 'audited' : 'estimated'
    return { points, quality, audit, source, cfMarkerAngle: marker?.pass ? marker.cfMarkerAngle : 0 }
  }
  const five = dist && ['lf', 'lc', 'cf', 'rc', 'rf'].every((k) => Number.isFinite(dist[k]))
  return { points: null, quality: five ? 'dimensions-only' : 'missing', audit: null, source: null, cfMarkerAngle: 0 }
}
