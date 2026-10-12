// resolveBallparkLayout: the one answer to "what did this field look like on
// this date" (#1859). Every visual that names a park should draw what this
// returns, so two cards about the same game cannot show two different walls.
//
// Pure and spoiler-free: a layout is static park geometry and carries no score,
// so it may run at render with no gating. A hit or a flight drawn ON it keeps
// its own reveal gate.

import { BALLPARKS } from '../ballparkData.js'
import { WALLS } from '../ballparkFields.js'
import { auditFence } from './fenceAudit.js'
import { CONFIGURATIONS, SEED } from './configurations.js'

// Same key rule as ballparkData.js and ballparks.js.
function normalizeVenue(name) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// The venue id behind a feed name: through a current park record (which carries
// every sponsor alias), else through an old record's own `names`.
const VENUE_BY_NAME = new Map()
for (const c of CONFIGURATIONS) {
  for (const n of c.names ?? []) VENUE_BY_NAME.set(normalizeVenue(n), c.venueId)
}
for (const [key, rec] of Object.entries(BALLPARKS)) {
  const c = CONFIGURATIONS.find((cfg) => cfg.park && BALLPARKS[cfg.park] === rec)
  if (c) VENUE_BY_NAME.set(key, c.venueId)
}

// 'YYYY-MM-DD' (or any ISO string starting with one), else today, local time.
function dayOf(gameDate) {
  if (typeof gameDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(gameDate)) return gameDate.slice(0, 10)
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const covers = (c, day) => (c.from == null || c.from <= day) && (c.to == null || day <= c.to)

// The fence layer's quality. 'audited' = a traced outline whose CF passes the
// audit; 'estimated' = a traced outline that misses it (drawn, but not to be
// read as a measurement); 'dimensions-only' = no outline, the five posted
// distances only; 'missing' = not even those.
function fenceLayer(c, dist) {
  if (c.fence === 'seed') {
    const points = WALLS[c.seedKey]
    const audit = auditFence(points, dist?.cf)
    const quality = audit?.pass ? 'audited' : 'estimated'
    return { points, quality, audit, cfMarkerAngle: audit?.pass ? audit.cfMarkerAngle : 0 }
  }
  const five = dist && ['lf', 'lc', 'cf', 'rc', 'rf'].every((k) => Number.isFinite(dist[k]))
  return { points: null, quality: five ? 'dimensions-only' : 'missing', audit: null, cfMarkerAngle: 0 }
}

function build(c) {
  const rec = c.park ? BALLPARKS[c.park] : null
  const dist = rec ? rec.dist : c.dist
  const wall = rec ? rec.wall : c.wall
  const fence = fenceLayer(c, dist)
  return {
    venueId: c.venueId,
    configurationId: c.id,
    name: rec?.name ?? c.names?.[0] ?? null,
    validFrom: c.from,
    validTo: c.to,
    measurements: { dist, wall },
    geometry: { fence: fence.points, cfMarkerAngle: fence.cfMarkerAngle },
    quality: { fence: fence.quality, wall: wall ? 'posted' : 'missing' },
    audit: fence.audit,
    provenance: {
      fence: c.fence === 'seed' ? { ...SEED, key: c.seedKey } : null,
      sources: c.sources ?? [],
      note: c.note ?? null,
    },
  }
}

// One layout per configuration, built once (the audit is a few hundred ray casts).
const LAYOUTS = new Map(CONFIGURATIONS.map((c) => [c.id, build(c)]))

// The configuration a venue had on a date. `venueId` wins over `venueName` when
// both are given (a neutral site or a renamed park still has its own id).
// Returns null for a venue with no record (most MiLB parks, a spring park used
// for a season), so callers fall back to their "not on file" state.
export function resolveBallparkLayout({ venueId, venueName, gameDate } = {}) {
  const id = venueId != null && venueId !== '' ? Number(venueId) : VENUE_BY_NAME.get(normalizeVenue(venueName))
  if (id == null) return null
  const day = dayOf(gameDate)
  const c = CONFIGURATIONS.find((cfg) => cfg.venueId === id && covers(cfg, day))
  return c ? LAYOUTS.get(c.id) : null
}

// Every configuration's layout, for the coverage report and the tests.
export function allBallparkLayouts() {
  return [...LAYOUTS.values()]
}
