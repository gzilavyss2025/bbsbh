// The closed field catalog behind the club-identity override overlay — this
// feature's `src/copy/registry.js`, and it exists for the same reason.
//
// A club's identity (tile tuning, brand colours, header triad, stamp placement,
// WPA band) ships as hand-tuned JSON in src/lib/data/*.json and is edited in
// /identity-lab, which writes those files through a dev-only endpoint (ADR-0029).
// An override lets the site owner retune ONE club from the page that renders it,
// at runtime, with no deploy — the same shape the Ballpark card's gear already
// has (ADR-0044). What makes that safe to expose is this file: an override id
// that is not an own field of a dimension below cannot be stored, and a value
// that does not coerce cleanly for that field's kind cannot be stored either.
//
// AN ID IS `identity.{dimension}.{teamId}.{…}` and names exactly one leaf.
//
//   identity.mlbTuning.158.city-connect.scale     a tile's edge-bleed scale
//   identity.colors.158.primary                   a club-level brand colour
//   identity.mlbHeader.158.main.onBar             the ink on that club's bar
//   identity.stamp.158.away.offsetY               a stamp mark's nudge
//
// Last-write-wins per id, and an EMPTY value clears the override rather than
// storing a blank — the same delete semantics `mergeOverrides` has for copy, and
// for the same reason: "clear this back to what ships" has to be expressible, and
// a store full of empty strings is a store that has stopped meaning anything.
//
// TWO DIMENSIONS PER HEADER TRIAD, not the one the issue sketched. MLB clubs are
// keyed by treatment and MiLB affiliates by game side — the split the rest of
// src/lib keeps everywhere (src/lib/CLAUDE.md) — and the two triads live in two
// different stores. One dimension would have had to classify a team id to know
// which store it meant, which is a `teams.js` import this file must not take:
// teams.js reads the overlay, so that edge would close a cycle. The id says
// which vocabulary it is in, the same way the store files do.

import { contrastRatio } from '../contrast.js'

// The one prefix, so a stray key in a Redis hash can never be mistaken for a
// field id and vice versa.
const PREFIX = 'identity'

// The jerseys.json/mlb-treatment-tuning.json treatment vocabulary. Deliberately
// a literal here rather than an import of teams.js's MLB_TREATMENT_KEYS — see
// the header's note about the cycle. test/identity-overrides.test.js asserts the
// two lists stay identical, so this copy cannot drift silently.
export const MLB_TREATMENTS = ['main', 'alternate', 'alternate-2', 'alternate-3', 'alternate-4', 'city-connect']

// MiLB's whole vocabulary: two variations, no exceptions.
export const MILB_SIDES = ['home', 'away']

// The two bars an MLB club owns. Every treatment but City Connect wears the
// club's shared Main bar (teams.js's treatmentHeaderColorOverride), so those are
// the only two slots a header override may name — writing 'alternate-3' here
// would land a record no resolver ever reads.
const MLB_BAR_KEYS = ['main', 'city-connect']

// Which swatch store a non-Main MLB treatment's tile fill lives in. Main has no
// entry: its fill is the club's own `bgHex`/`bg` role in the tuning store, which
// is why `bgHex` is an mlbTuning field and this map has five keys, not six.
const TILE_BG_STORES = {
  alternate: 'alt-colors',
  'alternate-2': 'alt2-colors',
  'alternate-3': 'alt3-colors',
  'alternate-4': 'alt4-colors',
  'city-connect': 'city-connect-colors',
}

// ---------------------------------------------------------------------------
// Field kinds. A kind owns one question — "is this string a value for this
// field, and what does it become in the store?" — and answers it identically in
// the browser (instant, specific) and in the endpoint (authoritative). Same
// two-ends-one-implementation rule logoArt.js's PNG header reader keeps.
// ---------------------------------------------------------------------------

// #rgb / #rrggbb, or a CSS rgb()/rgba() — the pinstripe tables carry
// 'rgba(0, 0, 0, 0.16)', so this cannot be hex-only. Deliberately TIGHTER than
// dev-data-stores.mjs's isColorish (any bounded string): that validator guards a
// file a human wrote and reviewed, this one guards a value that arrives over the
// wire and lands in a `style` attribute.
const HEX = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i
const RGB = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/i

// The transform-origin-y vocabulary treatmentOriginY answers with: the two
// keywords the tuning store actually uses today, plus a percentage.
const ORIGIN_Y = /^(?:center|top|bottom|-?\d{1,3}(?:\.\d+)?%)$/

const color = () => ({ kind: 'color' })
const number = (min, max, step) => ({ kind: 'number', min, max, step })
const pick = (values) => ({ kind: 'pick', values })

// A raw string as it would LAND in the store, or undefined for "not a value for
// this field". Never throws — a caller distinguishes the two by `undefined`,
// exactly as sanitizeOverrides distinguishes a dropped id.
export function coerceIdentityValue(spec, raw) {
  if (typeof raw !== 'string') return undefined
  const value = raw.trim()
  if (!value) return undefined
  if (spec.kind === 'color') return HEX.test(value) || RGB.test(value) ? value : undefined
  if (spec.kind === 'originY') return ORIGIN_Y.test(value) ? value : undefined
  if (spec.kind === 'pick') return spec.values.includes(value) ? value : undefined
  if (spec.kind === 'number') {
    const n = Number(value)
    if (!Number.isFinite(n)) return undefined
    return n >= spec.min && n <= spec.max ? n : undefined
  }
  return undefined
}

// ---------------------------------------------------------------------------
// The dimensions. `path` is where a field's value lives inside its store — so
// this table, and nothing else, knows that a header triad hides under
// `treatments.{bar}.header` while a tile's scale sits directly on
// `treatments.{key}`.
// ---------------------------------------------------------------------------

export const IDENTITY_DIMENSIONS = {
  // An MLB club's per-treatment tile tuning — the record treatmentTile() reads.
  mlbTuning: {
    store: () => 'mlb-treatment-tuning',
    keys: MLB_TREATMENTS,
    path: (teamId, key, field) => [teamId, 'treatments', key, field],
    fields: {
      scale: number(0.4, 3, 0.01),
      offsetX: number(-100, 100, 0.5),
      offsetY: number(-100, 100, 0.5),
      originY: { kind: 'originY' },
      pinstripeColor: color(),
      pinstripeBg: color(),
      // Main's own flat fill. Only meaningful on 'main' (mainTreatmentTint reads
      // it); on any other treatment the tile fill is a tileBg swatch instead.
      bgHex: color(),
    },
  },

  // The MiLB counterpart, keyed by side and nested one level deeper — a MiLB
  // record's tile fields live under `position`, not on the record itself.
  milbTuning: {
    store: () => 'milb-treatment-tuning',
    keys: MILB_SIDES,
    path: (teamId, key, field) => [teamId, 'treatments', key, 'position', field],
    fields: {
      scale: number(0.4, 3, 0.01),
      offsetX: number(-100, 100, 0.5),
      offsetY: number(-100, 100, 0.5),
      bg: color(),
      pinstripeBg: color(),
    },
  },

  // The MLB half of the header chrome (ADR-0030). `triad: true` is what puts a
  // save through the contrast gate below — see headerTriadRefusal.
  mlbHeader: {
    store: () => 'mlb-treatment-tuning',
    keys: MLB_BAR_KEYS,
    path: (teamId, key, field) => [teamId, 'treatments', key, 'header', field],
    fields: {
      bar: color(),
      accent: color(),
      onBar: color(),
      markScale: number(0.5, 2.5, 0.05),
    },
    triad: true,
  },

  // The MiLB half. Both sides collapse onto one bar in milbHeaderColorOverride,
  // but the store still holds a record per side, so both keys are addressable.
  milbHeader: {
    store: () => 'milb-treatment-tuning',
    keys: MILB_SIDES,
    path: (teamId, key, field) => [teamId, 'treatments', key, 'header', field],
    fields: {
      bar: color(),
      accent: color(),
      onBar: color(),
      markScale: number(0.5, 2.5, 0.05),
    },
    triad: true,
  },

  // A non-Main MLB treatment's tile fill. The one dimension whose store depends
  // on the key — five swatch files, one per treatment — and the one whose id has
  // no field segment at all: a treatment has exactly one background.
  tileBg: {
    store: (key) => TILE_BG_STORES[key] ?? null,
    keys: Object.keys(TILE_BG_STORES),
    leaf: color(),
  },

  // Club-level brand colours and the three treatment picks that ride with them.
  // `extras` is deliberately NOT here (see src/lib/CLAUDE.md): nothing on the
  // team hub renders a club's extras, so an editor for them here would be a
  // control with no visible effect on the page that holds it — which is the one
  // thing this placement is supposed to guarantee. They stay in /identity-lab,
  // which shows every swatch side by side.
  colors: {
    store: () => 'mlb-team-colors',
    teamLevel: true,
    path: (teamId, field) => [teamId, field],
    fields: {
      primary: color(),
      secondary: color(),
      accent: color(),
      accent2: color(),
      offDayTreatment: pick(MLB_TREATMENTS),
      defaultHomeTreatment: pick(MLB_TREATMENTS),
      defaultAwayTreatment: pick(MLB_TREATMENTS),
    },
  },

  // Where a club's knockout mark sits inside a Logbook stamp's slot. RANGES ARE
  // THE ONES IN dev-data-stores.mjs's STAMP_PLACEMENT_RANGES, restated so the
  // browser can refuse a bad value before a request; the endpoint re-runs that
  // validator, which is what actually decides. test/identity-overrides.test.js
  // pins the two against each other.
  stamp: {
    store: () => 'stamp-logo-tuning',
    keys: MILB_SIDES,
    path: (teamId, key, field) => [teamId, 'treatments', key, field],
    fields: {
      scale: number(0.4, 2, 0.01),
      offsetX: number(-60, 60, 0.5),
      offsetY: number(-60, 60, 0.5),
      rotation: number(-90, 90, 0.5),
    },
    // Surfaced in the drawer beside these fields, because it is the one thing
    // about this dimension a person editing it has to be told: the store is read
    // at RENDER time, so retuning a club restyles stamps already minted and
    // placed in a Game Log (ADR-0035's amendment).
    retroactive: true,
  },

  // The win-probability band's fill for a club. Team-level, like the store's own
  // `bandColor`.
  wpa: {
    store: () => 'wpa-tuning',
    teamLevel: true,
    path: (teamId, field) => [teamId, field],
    fields: { bandColor: color() },
  },
}

const isTeamIdSegment = (s) => /^[1-9]\d*$/.test(s)

// An id's parts, or null for anything this catalog does not name. The single
// choke point: sanitize, merge, apply and the drawer all resolve an id through
// here, so there is exactly one answer to "what does this string mean".
export function parseIdentityFieldId(id) {
  if (typeof id !== 'string') return null
  const parts = id.split('.')
  if (parts.length < 3 || parts[0] !== PREFIX) return null
  const [, name, teamId, ...rest] = parts
  const dimension = Object.hasOwn(IDENTITY_DIMENSIONS, name) ? IDENTITY_DIMENSIONS[name] : null
  if (!dimension || !isTeamIdSegment(teamId)) return null

  if (dimension.leaf) {
    if (rest.length !== 1) return null
    const [key] = rest
    const store = dimension.store(key)
    if (!store) return null
    return { id, dimension: name, store, teamId, key, field: null, spec: dimension.leaf, path: null }
  }

  if (dimension.teamLevel) {
    if (rest.length !== 1) return null
    const [field] = rest
    if (!Object.hasOwn(dimension.fields, field)) return null
    return {
      id,
      dimension: name,
      store: dimension.store(),
      teamId,
      key: null,
      field,
      spec: dimension.fields[field],
      path: dimension.path(teamId, field),
    }
  }

  if (rest.length !== 2) return null
  const [key, field] = rest
  if (!dimension.keys.includes(key)) return null
  if (!Object.hasOwn(dimension.fields, field)) return null
  return {
    id,
    dimension: name,
    store: dimension.store(key),
    teamId,
    key,
    field,
    spec: dimension.fields[field],
    path: dimension.path(teamId, key, field),
  }
}

// The id for a field, built rather than typed at a call site — so the drawer and
// the save path cannot disagree about the naming scheme, the same reason
// ballparkArt.js's `fieldIds` exists.
export function identityFieldId(dimension, teamId, ...segments) {
  return [PREFIX, dimension, teamId, ...segments].join('.')
}

// Only known ids with values their field's kind accepts survive. Run on every
// source — the endpoint's body, the Redis read, the localStorage cache, and the
// live GET — so no path can put a value into the overlay that the others would
// have refused. Values stay STRINGS here; coercion to the store's own types
// happens when the overlay is applied, one layer up (apply.js).
export function sanitizeIdentityOverrides(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, value] of Object.entries(raw)) {
    const field = parseIdentityFieldId(id)
    if (!field) continue
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed) continue // empty = "use what ships", never stored
    if (coerceIdentityValue(field.spec, trimmed) === undefined) continue
    out[id] = trimmed
  }
  return out
}

// Layer `patch` over `current`. A patch value of '' CLEARS that id; an id absent
// from the patch is left exactly as it was. Both ends of the write use this one
// function, for the reason mergeOverrides' header gives at length: two
// implementations of a merge rule decide, silently, that a save means different
// things depending on which end ran it.
export function mergeIdentityOverrides(current, patch) {
  const merged = { ...sanitizeIdentityOverrides(current) }
  for (const [id, value] of Object.entries(patch || {})) {
    if (typeof value === 'string' && value.trim()) merged[id] = value.trim()
    else delete merged[id]
  }
  return sanitizeIdentityOverrides(merged)
}

// ---------------------------------------------------------------------------
// The contrast gate.
// ---------------------------------------------------------------------------

// WCAG 2.1 AA for normal-size text. The SAME number scripts/check-contrast.mjs
// asserts every committed header triad against, and the same one
// test/header-theme.test.js repeats. A runtime edit passes through neither of
// those, which is exactly why it is restated here and checked twice — in the
// browser for an instant, specific refusal, and in the endpoint because that is
// the answer that counts. Never lower it; retune the pair instead.
export const HEADER_CONTRAST_MIN = 4.5

// A ratio only compares real colours, and a triad may be half-written: `bar`
// overridden while `onBar` still comes off disk. So the caller hands in the
// EFFECTIVE triad — override layered on what ships — and this only judges a pair
// that exists. An incomplete triad is not a failure here; headerThemeFor already
// answers null for one, which leaves the club on the app's default navy chrome.
export function headerTriadRefusal(triad) {
  const bar = triad?.bar
  const onBar = triad?.onBar
  if (!bar || !onBar) return null
  const ratio = contrastRatio(onBar, bar)
  if (ratio >= HEADER_CONTRAST_MIN) return null
  return (
    `${onBar} on ${bar} reads at ${ratio.toFixed(2)}:1, under the ${HEADER_CONTRAST_MIN}:1 ` +
    'this app holds every club bar to. Darken the bar or lighten the ink.'
  )
}
