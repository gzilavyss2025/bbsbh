// resolveBallparkLayout: the one answer to "what did this field look like on
// this date" (#1859). Every visual that names a park should draw what this
// returns, so two cards about the same game cannot show two different walls.
//
// Pure and spoiler-free: a layout is static park geometry and carries no score,
// so it may run at render with no gating. A hit or a flight drawn ON it keeps
// its own reveal gate.

import { BALLPARKS } from '../ballparkData.js'
import { CONFIGURATIONS, SEED } from './configurations.js'
import { fenceFor, measuredFor, softLayersFor, MILB_CONFIGURATIONS } from './fences.js'

// Every configuration: the curated registry first, then the imported
// minor-league parks it does not already cover.
const curated = new Set(CONFIGURATIONS.map((c) => c.venueId))
const ALL = [...CONFIGURATIONS, ...MILB_CONFIGURATIONS.filter((c) => !curated.has(c.venueId))]

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
for (const c of ALL) {
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

// The short note a diagram prints when its wall is not a checked outline, so a
// straight five-point sketch never passes for the real fence. A checked
// Gameday outline needs none.
function accuracyNote(quality, kind) {
  if (quality === 'dimensions-only') return 'Wall drawn straight between the posted distances'
  if (quality === 'estimated' && kind !== 'milb') return 'Wall shape is approximate'
  if (kind === 'seed') return 'Wall traced from a 2018 drawing'
  if (kind === 'milb') return "Wall from MLB's drawing of this park, checked against its posted distances"
  return null
}

// The venue's current park name, for an older record with no name of its own.
function currentName(venueId) {
  const cur = CONFIGURATIONS.find((cfg) => cfg.venueId === venueId && cfg.park)
  return cur ? BALLPARKS[cur.park].name : null
}

function build(c) {
  const rec = c.park ? BALLPARKS[c.park] : null
  const dist = rec ? rec.dist : c.dist
  const wall = rec ? rec.wall : c.wall
  const measured = measuredFor(c)
  const fence = fenceFor(c, dist)
  const soft = softLayersFor(c)
  return {
    venueId: c.venueId,
    configurationId: c.id,
    name: rec?.name ?? c.names?.[0] ?? currentName(c.venueId),
    validFrom: c.from,
    validTo: c.to,
    // `dist` is the posted signs (what the labels say); `measured` is Savant's
    // survey of the current wall, five distances and five heights. They differ
    // on purpose: Fenway posts 420 at the triangle, Savant measures 388 at
    // straightaway. `wall` is Savant's line/CF/line heights when measured.
    measurements: { dist, wall, measured },
    geometry: { fence: fence.points, cfMarkerAngle: fence.cfMarkerAngle, ...soft },
    // One quality per layer: a checked fence does not make its foul ground
    // checked. The infield is the regulation drawing in every park (no source
    // measures one; Gameday's is the same stamp in every SVG).
    quality: {
      fence: fence.quality,
      wall: measured ? 'measured' : wall ? 'posted' : 'missing',
      foul: soft.surface ? 'estimated' : 'stylized',
      track: soft.trackInner ? 'estimated' : 'stylized',
      infield: 'regulation',
    },
    audit: fence.audit,
    accuracyNote: accuracyNote(fence.quality, fence.source?.kind),
    provenance: {
      fence: fence.source?.kind === 'seed' ? { kind: 'seed', ...SEED, key: c.seedKey } : fence.source,
      sources: c.sources ?? [],
      note: c.note ?? null,
    },
  }
}

// One layout per configuration, built once (an audit is a few hundred ray casts).
const LAYOUTS = new Map(ALL.map((c) => [c.id, build(c)]))

// The configuration a venue had on a date. `venueId` wins over `venueName` when
// both are given (a neutral site or a renamed park still has its own id).
// Returns null for a venue with no record (most MiLB parks, a spring park used
// for a season), so callers fall back to their "not on file" state.
export function resolveBallparkLayout({ venueId, venueName, gameDate } = {}) {
  const id = venueId != null && venueId !== '' ? Number(venueId) : VENUE_BY_NAME.get(normalizeVenue(venueName))
  if (id == null) return null
  const day = dayOf(gameDate)
  const c = ALL.find((cfg) => cfg.venueId === id && covers(cfg, day))
  return c ? LAYOUTS.get(c.id) : null
}

// Every configuration's layout, for the coverage report and the tests.
export function allBallparkLayouts() {
  return [...LAYOUTS.values()]
}
