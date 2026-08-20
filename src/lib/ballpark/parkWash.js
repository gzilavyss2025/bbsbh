// The tint over a slate card's ballpark backdrop — the home club's own tile
// colour (GameCardParts.jsx's `tileColorFor`), laid over the grayscale
// photograph at FULL strength (06a-gamecard-parkart.css's `opacity: 1`) — with
// the colour itself overridable per club from the team hub's identity drawer,
// the same runtime-override shape every other identity field uses (ADR-0050).
//
// ONE STRENGTH FOR EVERY CLUB, and that is deliberate rather than a default
// nobody got round to tuning. The wash used to carry a per-club `intensity`
// field beside the colour, landed at 0.55 and tuned to ~0.8 for most of the
// thirty; the site owner asked for a single full-strength wash instead, so the
// field left the closed catalog in fields.js and the stored per-club values
// went inert with it (an id the catalog does not name is dropped by
// sanitizeIdentityOverrides on both the read and the write). The colour stays
// per-club, because WHICH colour a park wears is a fact about the club; how
// hard it is pressed is a fact about the app.
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

const PARK_WASH_COLOR_OVERRIDES = byTeam(PARK_WASH_STORE, (e) => e.color)

// An explicit wash colour for this club, or null to keep the automatic one
// (the home tile colour `tileColorFor` already resolves — GameCard.jsx picks
// between the two).
export function parkWashColorOverride(teamId) {
  return PARK_WASH_COLOR_OVERRIDES[teamId] ?? null
}
