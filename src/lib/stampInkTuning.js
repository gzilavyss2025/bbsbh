// Which ink a club's Logbook stamp is pressed in when it wins — the hand-picked
// override of ADR-0036's addendum default (the winner's darkest brand colour).
// A flat `{ teamId: "#hex" }` map, since a stamp carries one ink for the whole
// club, not one per side the way stamp-logo-tuning.json's mark placement is.
//
// Read at runtime on every stamp render, same as stampLogoTuning.js and for the
// same reason: a stamp stores game facts and no art, so it is redrawn from
// these numbers each time. Retuning a club's ink restyles every stamp of that
// club already sitting in someone's Logbook the moment the change ships.
//
// Picked by eye in /identity-lab's Stamp ink editor, which writes this file
// through the dev-only save endpoint (ADR-0029). Still walked through
// deepenToContrast (src/lib/stampInk.js) before it ever reaches the art — a
// club's own pick is not exempt from the contrast floor ADR-0036 argued for,
// only from the "darkest of what the club owns" part of the pick.

import store from './data/stamp-ink.json' with { type: 'json' }

// The raw hex on file for a club, or null — untouched by contrast math, so the
// lab can show a pick exactly as typed alongside what it will actually print.
export function stampInkOverrideFor(teamId) {
  if (teamId == null) return null
  return store[String(teamId)] ?? null
}

// The whole store, for the lab's save path (which posts it back in full, like
// every other dev store).
export function stampInkStore() {
  return store
}
