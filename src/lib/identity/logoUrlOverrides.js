// The runtime logo-art overrides the team hub's admin drawer saves — a URL per
// (club, slot), slots being the MLB treatment vocabulary plus MiLB's home/away
// (fields.js's `logo` dimension, ADR-0050). The bundled store ships EMPTY, so
// with no override every resolver answers exactly as it always did; a value
// here outranks every disk/CDN rung because it is the one layered on at
// runtime by an explicit act about this club.
//
// A module of its own rather than a block in teams.js for a measurable reason:
// teams.js sits at its file-size ceiling (check-file-size.mjs), and both it AND
// milbColors.js need the reader — importing it from a leaf keeps that edge out
// of teams.js entirely for the MiLB side. Registration still sits beside the
// one JSON import, per overlay.js's registration-lives-with-the-store rule.
//
// Deliberately NOT consulted for the decorative 'base'/'mono' variants: those
// surfaces carry no jersey context for an override to key into ("override-
// blind", src/lib/CLAUDE.md), and the mono knockout is generated art.

import LOGO_URL_OVERRIDES_JSON from '../data/logo-url-overrides.json' with { type: 'json' }
import { registerIdentityStore } from './overlay.js'
import { liveStore } from '../tuningStore.js'

const STORE = registerIdentityStore('logo-url-overrides', LOGO_URL_OVERRIDES_JSON)
const OVERLAID = liveStore(STORE)

// The overridden mark URL for one (club, slot), or null.
export function logoUrlOverride(teamId, slot) {
  return OVERLAID[teamId]?.[slot] ?? null
}

// teamLogoUrl's `variant` vocabulary mapped onto the store's slots. 'main' is
// absent on purpose — Main's tile never reaches teamLogoUrl under that name;
// its override answers from mainOverrideLogoUrl, which routes the tile through
// the 'main-recolor' variant.
const VARIANT_SLOTS = {
  alternate: 'alternate',
  'alternate-2': 'alternate-2',
  'alternate-3': 'alternate-3',
  'alternate-4': 'alternate-4',
  'city-connect': 'city-connect',
  'milb-home': 'home',
  'milb-away': 'away',
}

// The override a teamLogoUrl variant resolves to, or null for a variant no
// override may touch.
export function logoUrlOverrideForVariant(teamId, variant) {
  const slot = VARIANT_SLOTS[variant]
  return slot ? logoUrlOverride(teamId, slot) : null
}
