// The live overlay the identity stores are read THROUGH — module state, a
// version counter, and a subscribe function. Nothing below src/lib became async
// to get this, and no pure resolver changed its signature.
//
// WHY AN OVERLAY AND NOT A FETCH. Identity data has the opposite shape to the
// admin-editable copy the Ballpark gear writes. Copy resolves through React
// context, so a provider can re-resolve it. These stores are imported at MODULE
// LOAD and rebuilt into flat lookup tables (tuningStore.js -> teams.js,
// milbColors.js, headerTheme.js, wpa/*), and their consumers — `treatmentTile`,
// `headerThemeFor`, `markTransform` — are pure synchronous functions called from
// many components and from outside React entirely. Making any of that async
// would have rewritten half the identity layer for one gear.
//
// So the seam is here instead, in two pieces:
//
//   1. `effectiveStore(bundled)` — the bundled JSON with the overrides written
//      in, memoized per version. A store nothing overrides is returned by
//      identity, so an unconfigured deploy behaves exactly as it did before.
//   2. `liveTable(build)` — a derived lookup table that REFILLS IN PLACE when
//      the overlay changes. The tables are module-level `export const`s read as
//      `TABLE[teamId]?.[treatment]` at call time, so refilling one is enough;
//      the exported object identity never changes, and not one call site,
//      resolver or test had to learn about the overlay. (Mutating an exported
//      table is already this layer's convention — test/header-theme.test.js
//      writes into MILB_HEADER_COLOR_OVERRIDES and deletes the key after.)
//
// TWO LAYERS, ONE PERSISTED. `overrides` is what the store holds and what a
// reload restores. `preview` is the drawer's unsaved draft, applied so the page
// the owner is editing IS the preview (there must be no second layout only the
// owner sees) and dropped on Cancel. Nothing ever writes `preview` anywhere.
//
// THE SPOILER RULE IS UNTOUCHED. Every id here names `(teamId, treatment)` and a
// colour, a nudge or a scale. Identity, never state — src/lib/CLAUDE.md's "rule
// that must not drift" is not weakened by making that identity editable.

import { applyIdentityOverrides } from './apply.js'
import { sanitizeIdentityOverrides } from './fields.js'

let overrides = {}
let preview = {}
let layered = {}
let version = 0

const listeners = new Set()

// bundled store object -> its DEV_DATA_STORES key. A WeakMap because the key is
// a fact about that module's imported JSON, and registering must not be able to
// keep a store alive on its own.
const storeKeys = new WeakMap()
// bundled store object -> { version, store } — the memo behind effectiveStore.
const effective = new WeakMap()
// Every table liveTable() handed out, with the recipe to rebuild it.
const tables = new Set()

// Tag a bundled store with the key its overrides are filed under, and hand it
// straight back so a consuming module can write
// `const STORE = registerIdentityStore('wpa-tuning', WPA_TUNING_JSON)`.
//
// REGISTRATION LIVES IN THE CONSUMING MODULE, not in one file that imports every
// store, and that is load-bearing rather than stylistic: wpa/wpaDefaults.js
// exists precisely so `data/wpa-tuning.json` stays out of the eager entry chunk
// (src/lib/CLAUDE.md), and a central registry would drag all ten stores into it.
export function registerIdentityStore(storeKey, bundled) {
  storeKeys.set(bundled, storeKey)
  return bundled
}

// `bundled` with the overlay written in, or `bundled` itself when nothing
// touches it. Memoized on the version counter, so the per-call cost of a
// resolver reading through this is one WeakMap lookup and an integer compare.
export function effectiveStore(bundled) {
  const storeKey = storeKeys.get(bundled)
  if (!storeKey) return bundled
  const cached = effective.get(bundled)
  if (cached && cached.version === version) return cached.store
  const store = applyIdentityOverrides(storeKey, bundled, layered)
  effective.set(bundled, { version, store })
  return store
}

// Replace a table's contents without replacing the table. Deletes first, so a
// cleared override really disappears rather than lingering as a stale key.
function refill(table, next) {
  for (const key of Object.keys(table)) if (!Object.hasOwn(next, key)) delete table[key]
  Object.assign(table, next)
}

// A derived lookup table that tracks the overlay. `build` must be a pure
// function of the stores it reads — it is re-run on every overlay change.
export function liveTable(build) {
  const table = {}
  refill(table, build())
  tables.add({ table, build })
  return table
}

export function identityVersion() {
  return version
}

// The persisted override map. Read by the drawer (to show which fields carry an
// override) and by the save path (to compose a patch). Never the preview layer —
// a draft is not an override until it lands.
export function identityOverrides() {
  return overrides
}

// Subscribe to overlay changes. Returns the unsubscribe function, so it drops
// straight into useSyncExternalStore.
export function subscribeIdentity(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Recompute everything derived from the two layers, in the one order that is
// correct: bump the version FIRST (so effectiveStore's memo misses), then refill
// every derived table, and only then tell React. A listener that ran before the
// refill would re-render off the tables it was called to replace.
function republish() {
  layered = { ...overrides, ...preview }
  version += 1
  for (const { table, build } of tables) refill(table, build())
  for (const listener of listeners) listener()
}

// Same map, field for field? The overlay is republished from four places — the
// cache, the API, a save, and every draft keystroke — and three of the four
// routinely hand back what is already there. Bumping the version for those would
// re-render the whole app for nothing, most visibly on a deploy with no override
// store at all, where the API's empty answer would still cost a repaint.
function same(a, b) {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
}

// Adopt a persisted override map — from the localStorage cache, from
// /api/identity, or from the response to a save (which IS the new authoritative
// map, the same hand-back CopyProvider's applyOverrides does).
export function setIdentityOverrides(next) {
  const clean = sanitizeIdentityOverrides(next)
  if (same(clean, overrides)) return
  overrides = clean
  republish()
}

// Paint an unsaved draft. Render-only: it never reaches localStorage, the API,
// or `identityOverrides()`. Pass {} to drop it.
export function setIdentityPreview(next) {
  const clean = sanitizeIdentityOverrides(next)
  if (same(clean, preview)) return
  preview = clean
  republish()
}
