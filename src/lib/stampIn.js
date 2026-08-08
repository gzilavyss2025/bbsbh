// The Stamp In page's pure rules — React-free, storage-free, unit-tested in
// test/stamp-in.test.js. The React wiring is in screens/team/StampInPage.jsx;
// this file is the part nothing can get wrong quietly.
//
// The page lists a club's whole played season with every result showing, so a
// reader can press a stamp for each game they watched. That is a deliberate,
// consented departure from the spoiler rule and it is scoped to this one
// address — read docs/adr/0042-stamp-in-is-a-consented-season-of-results.md
// before changing anything here.
//
// WHAT THIS MODULE MAY NEVER GROW: a reveal mark. The page is render-only, in
// the exact sense ADR-0026 gives that word — it never writes
// `bbsbh:reveal:{gamePk}` and never advances `revealedThrough` for any game.
// Nothing in this file, or in the screen over it, may reach the reveal ratchet.

// The one-time consent, kept on this device only. A record, not a mark: it
// says "I agreed to see this page", never anything about a game. Same
// separation ADR-0026 keeps between `bbsbh:spoiledDays` and the reveal mark.
export const STAMP_IN_CONSENT_KEY = 'bbsbh:stampIn'

// Parse the stored consent, or null. FAILS CLOSED on everything: bad JSON, an
// array, a bare string, a missing flag, and — deliberately — a `consented`
// that is merely truthy rather than literally `true`. The cost of reading this
// wrong is a season of final scores drawn for someone who never agreed to
// them, so nothing here is generous about what it accepts.
export function parseStampInConsent(raw) {
  if (raw == null) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if (parsed.consented !== true) return null
  return {
    consented: true,
    at: Number.isInteger(parsed.at) && parsed.at >= 0 ? parsed.at : 0,
  }
}

export function serializeStampInConsent(now = Date.now()) {
  return JSON.stringify({
    consented: true,
    at: Number.isInteger(now) && now >= 0 ? now : 0,
  })
}

export function hasStampInConsent(state) {
  return Boolean(state && state.consented === true)
}

// A game counts as PLAYED once it carries a result — which is `won` on an
// ordinary decided game, and both clubs' run totals on the rare final that
// carries no winner (a MiLB game called as a tie). Anything else is a game
// still on the calendar: no result, nothing to stamp, so it never reaches the
// page. This is also what keeps a dated (`?d=`) visit honest — fetchTeamSchedule
// nulls both fields for anything past its cutoff, so a cut-off game simply is
// not on the list.
function hasBeenPlayed(game) {
  if (!game || typeof game !== 'object') return false
  if (game.won === true || game.won === false) return true
  return game.runs != null && game.oppRuns != null
}

// The page's list: every played game, MOST RECENT FIRST. A doubleheader's
// second game leads its first, since "most recent at the top" has to hold
// within a date as well as across dates. Copies before sorting — the schedule
// array belongs to its loader, and sorting it in place would silently reverse
// the Games tab's own strip if the two ever shared one.
export function stampInGames(schedule) {
  if (!Array.isArray(schedule)) return []
  return schedule
    .filter(hasBeenPlayed)
    .sort(
      (a, b) =>
        String(b.apiDate ?? '').localeCompare(String(a.apiDate ?? '')) ||
        (b.gameNumber ?? 1) - (a.gameNumber ?? 1),
    )
}

// What one row's action reads as. Three states, no fourth:
//
//   'stamped' — you already hold this one.
//   'ready'   — press it and a stamp is minted into your collection.
//   'full'    — this season's shard is at MAX_STAMPS_PER_SEASON, which
//               REFUSES rather than prunes (ADR-0035). The refusal is said out
//               loud on the row; a control that looks live and does nothing is
//               the one outcome this state exists to prevent.
//
// A stamp you already hold survives a full season — the cap bounds new mints,
// it never takes one back.
export function stampButtonState({ stamped = false, seasonFull = false } = {}) {
  if (stamped) return 'stamped'
  return seasonFull ? 'full' : 'ready'
}
