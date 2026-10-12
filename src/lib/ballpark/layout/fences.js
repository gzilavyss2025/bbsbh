// Which fence outline a configuration draws, and how sure it is (#1859). The
// one place that decides it: ../ballparkData.js asks for the current park's
// outline, ./resolveLayout.js for any configuration's, and both get the same
// answer. No import of ballparkData.js, so neither import closes a cycle.
//
// Quality levels:
//   'audited'         an outline that passed its audit (Gameday against Savant's
//                     measurements, or a 2018 trace against the posted CF);
//   'estimated'       a 2018 trace that misses the posted CF (drawn by no one
//                     today; kept so a new failure shows up as a level, not a gap);
//   'dimensions-only' no outline, five posted distances;
//   'missing'         not even those.

import FIELDS from './fields.json' with { type: 'json' }
import { WALLS } from '../ballparkFields.js'
import { auditFence } from './fenceAudit.js'

export { FIELDS }

// Savant's measured row for a venue, for the season fields.json was imported
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
  } else if (config.fence === 'seed') {
    points = WALLS[config.seedKey] ?? null
    audit = points ? auditFence(points, dist?.cf) : null
    source = points ? { kind: 'seed', key: config.seedKey } : null
  }
  if (points) {
    const marker = auditFence(points, dist?.cf)
    const quality = source.kind === 'gameday' || audit?.pass ? 'audited' : 'estimated'
    return { points, quality, audit, source, cfMarkerAngle: marker?.pass ? marker.cfMarkerAngle : 0 }
  }
  const five = dist && ['lf', 'lc', 'cf', 'rc', 'rf'].every((k) => Number.isFinite(dist[k]))
  return { points: null, quality: five ? 'dimensions-only' : 'missing', audit: null, source: null, cfMarkerAngle: 0 }
}
