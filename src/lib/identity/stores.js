// Every bundled identity store the overlay can write into, in one map.
//
// SERVER-ONLY. Nothing under src/ may import this file, and the reason is
// measurable rather than tidy: `wpa/wpaDefaults.js` exists so that
// `data/wpa-tuning.json` stays out of the eager entry chunk (−3.7 KB gz, see
// src/lib/CLAUDE.md), and one module importing all ten stores would undo that
// for every first paint on a phone. In the browser each consuming module
// registers its own store with `registerIdentityStore`, next to the import it
// already had.
//
// `api/identity.js` is the one importer, and it needs the whole set for one
// reason: a save is authoritative only if it is checked against what SHIPS. A
// half-written header triad (`bar` overridden, `onBar` still on disk) cannot be
// judged from the patch alone, and neither can a validator that guards a store's
// whole shape. So the endpoint merges a proposed save into these and re-runs
// `scripts/lib/dev-data-stores.mjs`'s own validator over the result — the same
// function the dev-only file write runs (ADR-0029), so the two cannot drift.

import MLB_TREATMENT_TUNING from '../data/mlb-treatment-tuning.json' with { type: 'json' }
import MILB_TREATMENT_TUNING from '../data/milb-treatment-tuning.json' with { type: 'json' }
import MLB_TEAM_COLORS from '../data/mlb-team-colors.json' with { type: 'json' }
import STAMP_LOGO_TUNING from '../data/stamp-logo-tuning.json' with { type: 'json' }
import WPA_TUNING from '../data/wpa-tuning.json' with { type: 'json' }
import ALT_COLORS from '../data/alt-colors.json' with { type: 'json' }
import ALT2_COLORS from '../data/alt2-colors.json' with { type: 'json' }
import ALT3_COLORS from '../data/alt3-colors.json' with { type: 'json' }
import ALT4_COLORS from '../data/alt4-colors.json' with { type: 'json' }
import CITY_CONNECT_COLORS from '../data/city-connect-colors.json' with { type: 'json' }
import LOGO_URL_OVERRIDES from '../data/logo-url-overrides.json' with { type: 'json' }
import PARK_WASH_TUNING from '../data/park-wash-tuning.json' with { type: 'json' }
import MONO_INK from '../data/mono-ink.json' with { type: 'json' }

// Keyed by the DEV_DATA_STORES key, which is what a field id resolves to
// (fields.js's `store`). Same key on both sides means the endpoint picks the
// validator and the bundled defaults with one lookup and no second table.
export const BUNDLED_IDENTITY_STORES = {
  'mlb-treatment-tuning': MLB_TREATMENT_TUNING,
  'milb-treatment-tuning': MILB_TREATMENT_TUNING,
  'mlb-team-colors': MLB_TEAM_COLORS,
  'stamp-logo-tuning': STAMP_LOGO_TUNING,
  'wpa-tuning': WPA_TUNING,
  'alt-colors': ALT_COLORS,
  'alt2-colors': ALT2_COLORS,
  'alt3-colors': ALT3_COLORS,
  'alt4-colors': ALT4_COLORS,
  'city-connect-colors': CITY_CONNECT_COLORS,
  'logo-url-overrides': LOGO_URL_OVERRIDES,
  'park-wash-tuning': PARK_WASH_TUNING,
  'mono-ink': MONO_INK,
}

// The bundled store for a key, or null. `Object.hasOwn` so a hand-crafted key of
// 'constructor' reaches nothing inherited — the same care the dev-save
// allowlist's `devDataStore` takes for the identical reason.
export function bundledIdentityStore(storeKey) {
  return Object.hasOwn(BUNDLED_IDENTITY_STORES, storeKey) ? BUNDLED_IDENTITY_STORES[storeKey] : null
}
