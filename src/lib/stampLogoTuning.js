// Where a club's knockout mark sits inside a Logbook stamp's mark slot — the
// hand-tuned half of GameStamp's club marks (ADR-0035, and the "Per-club mark
// placement" block in stampArt.js, which owns the geometry this file only
// feeds).
//
// Why a store rather than numbers in the art: the stamp slot is one square for
// all 150-odd clubs, and the marks that letterbox into it are portrait caps,
// square roundels and wide wordmarks. The automatic answer (centre it, fit it)
// is right for most and visibly wrong for some — the same "a heuristic over art
// nobody controls" situation mono-ink.json exists for, one layer further on.
// Picked by eye in /identity-lab's Stamp placement editor, which writes this
// file through the dev-only save endpoint (ADR-0029).
//
// Keyed per club and then per SIDE (`away` / `home`), because the two slots are
// not mirror images of one thing: each bleeds off the opposite edge of the clip
// circle, so a mark that needs pulling in on the left needs pushing out on the
// right. Same two-key vocabulary MiLB's own stores use (src/lib/CLAUDE.md).
//
// Unlike mono-ink.json this IS read at runtime, on every stamp render — a stamp
// stores game facts and no art, so it is redrawn from these numbers each time.
// Retuning a club restyles that club's stamps everywhere, including ones
// already placed in someone's passport book, as soon as the change ships.

import store from './data/stamp-logo-tuning.json' with { type: 'json' }
import { markPlacement, resolveMarkPlacement } from './stampArt.js'

// The raw fields on file for one (club, side), or null. Only the lab reads this
// — the app wants the resolved placement below.
export function stampLogoTuningRecord(teamId, side) {
  return store[String(teamId)]?.treatments?.[side] ?? null
}

// The four numbers, defaulted and clamped — always an answer, so a caller never
// branches on coverage. An untuned club gets the identity placement.
export function stampLogoTuning(teamId, side) {
  return resolveMarkPlacement(stampLogoTuningRecord(teamId, side))
}

// What GameStamp draws one mark with: the slot, plus the transform (or null) the
// club's tuning asks for.
export function stampMarkPlacement(teamId, side, override) {
  return markPlacement(side, override ?? stampLogoTuningRecord(teamId, side))
}

// The whole store, for the lab's save path (which posts it back in full, like
// every other dev store).
export function stampLogoTuningStore() {
  return store
}
