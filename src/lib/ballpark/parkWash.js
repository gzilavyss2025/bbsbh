// The hover/press tint over a slate card's ballpark backdrop — normally the
// home club's own tile colour at a fixed opacity (GameCardParts.jsx's
// `tileColorFor`, 06a-gamecard-parkart.css's hard-coded 0.55) — overridable
// per club from the team hub's identity drawer, the same runtime-override
// shape every other identity field uses (ADR-0050).
//
// A team-level store with no `treatments` nesting, like wpa-tuning.json's
// `bandColor`: the wash is a fact about the CLUB, not about which jersey it's
// wearing that day. Starts empty (`{}`) — nothing ships curated here, only
// what an admin writes.

import PARK_WASH_TUNING from '../data/park-wash-tuning.json' with { type: 'json' }
import { registerIdentityStore } from '../identity/overlay.js'
import { byTeam } from '../tuningStore.js'
import { isMlbTeamId, treatmentTile } from '../teams.js'
import { milbTreatmentTile } from '../milbColors.js'

// The one solid colour a team's tile actually wears — the same MLB/MiLB
// branch TeamTreatmentMark resolves its tile from, collapsed to a single
// value. A pinstriped club's `tint` is null (its tile is mostly paper-white
// with thin colored lines), so `pinstripeColor` — the stripe's own ink — is
// the meaningful "team color" for that club instead; the two are already
// mutually exclusive in both treatmentTile and milbTreatmentTile, so reading
// either in either order is safe. Null for a team with no curated colour on
// file (see teams.js/milbColors.js's own graceful degrade).
//
// Lives here rather than in components/game/GameCardParts.jsx (its previous
// home) because the identity drawer's field builder needs it too, and that
// module is unit-tested by loading it in plain Node
// (test/identity-drawer-fields.test.js) — which cannot import a .jsx file.
// GameCardParts.jsx re-exports this for its existing importers.
export function tileColorFor(teamId, treatment, side) {
  const tile = isMlbTeamId(teamId) ? treatmentTile(teamId, treatment) : milbTreatmentTile(teamId, side)
  return tile.tint || tile.pinstripeColor || null
}

const PARK_WASH_STORE = registerIdentityStore('park-wash-tuning', PARK_WASH_TUNING)

// 06a-gamecard-parkart.css's own hard-coded hover opacity, restated here so
// the drawer's landed default and the CSS custom property's fallback can't
// drift apart. Change the CSS rule and this constant together.
export const PARK_WASH_DEFAULT_INTENSITY = 0.55

const PARK_WASH_COLOR_OVERRIDES = byTeam(PARK_WASH_STORE, (e) => e.color)
const PARK_WASH_INTENSITY_OVERRIDES = byTeam(PARK_WASH_STORE, (e) => e.intensity)

// An explicit wash colour for this club, or null to keep the automatic one
// (the home tile colour `tileColorFor` already resolves — GameCard.jsx picks
// between the two).
export function parkWashColorOverride(teamId) {
  return PARK_WASH_COLOR_OVERRIDES[teamId] ?? null
}

// This club's wash opacity on hover/press — an explicit override, or the
// app's own default.
export function parkWashIntensity(teamId) {
  const v = PARK_WASH_INTENSITY_OVERRIDES[teamId]
  return Number.isFinite(v) ? v : PARK_WASH_DEFAULT_INTENSITY
}
