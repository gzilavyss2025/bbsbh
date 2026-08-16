// Layer an override map onto one bundled identity store, producing the store the
// app should actually read.
//
// The bundled JSON stays the default, exactly as `src/copy/registry.js`'s
// defaults do — this never mutates it. A store that no override touches is
// returned BY IDENTITY, not copied, which is what keeps a deploy with no
// override store (the common case, and every unit test) byte-for-byte the
// application it was before this file existed.
//
// It is deliberately a pure function of `(storeKey, bundled, overrides)` and
// knows nothing about React, fetching, or where the overrides came from. The
// endpoint calls it to validate a proposed save against the SAME shapes
// scripts/lib/dev-data-stores.mjs guards; the browser calls it through
// overlay.js to render one. One implementation, so a value that renders is a
// value that would have validated.

import { coerceIdentityValue, parseIdentityFieldId } from './fields.js'

// Split a clean override map into `{ [storeKey]: { id: value } }`, so a caller
// that only cares about one store does not walk the whole map, and the endpoint
// can validate exactly the stores a save touches.
export function overridesByStore(overrides) {
  const out = {}
  for (const [id, value] of Object.entries(overrides || {})) {
    const field = parseIdentityFieldId(id)
    if (!field) continue
    out[field.store] ??= {}
    out[field.store][id] = value
  }
  return out
}

// Every team id an override map names, as strings. The endpoint uses it to
// re-check just the header triads a save could have affected rather than all of
// them.
export function teamsInOverrides(overrides) {
  const ids = new Set()
  for (const id of Object.keys(overrides || {})) {
    const field = parseIdentityFieldId(id)
    if (field) ids.add(field.teamId)
  }
  return ids
}

// Clone just enough of `store` to write `path`, then write it. Copy-on-write per
// node rather than a deep clone of the whole store: the stores run to tens of
// thousands of entries between them, a save touches one club, and every
// untouched entry stays the exact object the bundled JSON already holds.
function setPath(store, path, value) {
  const [head, ...rest] = path
  const next = { ...store }
  if (rest.length === 0) {
    next[head] = value
    return next
  }
  const child = next[head]
  next[head] = setPath(child && typeof child === 'object' && !Array.isArray(child) ? child : {}, rest, value)
  return next
}

// The one dimension that is not a leaf write. A treatment's tile fill lives in a
// swatch LIST whose `bg: true` member is the fill (teams.js's
// swatchesFromColorStore -> treatmentBgColor), so an override replaces that
// member's hex — or appends one when the club has no background on file yet.
// The other swatches are curation notes about the jersey and are left alone.
function setTileBg(store, teamId, hex) {
  const entry = store[teamId]
  const swatches = Array.isArray(entry?.swatches) ? entry.swatches : []
  const at = swatches.findIndex((s) => s?.bg)
  const next =
    at >= 0
      ? swatches.map((s, i) => (i === at ? { ...s, hex } : s))
      : [...swatches, { label: 'Background', hex, bg: true }]
  return { ...store, [teamId]: { ...(entry ?? {}), swatches: next } }
}

// `bundled` with every override for `storeKey` written into it, or `bundled`
// itself when there are none. Values arrive as strings and land as the store's
// own types (a scale is a number on disk, a colour is a string) — that coercion
// is the field catalog's, so what lands here is what `coerceIdentityValue`
// already agreed was a value for the field.
export function applyIdentityOverrides(storeKey, bundled, overrides) {
  const mine = overridesByStore(overrides)[storeKey]
  if (!mine) return bundled
  let store = bundled
  for (const [id, raw] of Object.entries(mine)) {
    const field = parseIdentityFieldId(id)
    if (!field) continue
    const value = coerceIdentityValue(field.spec, raw)
    if (value === undefined) continue
    store = field.path ? setPath(store, field.path, value) : setTileBg(store, field.teamId, value)
  }
  return store
}
