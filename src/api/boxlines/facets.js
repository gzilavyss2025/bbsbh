// BOX LINES — the facet half (ADR-0069). One tagged object says WHICH of a
// player's career games a sheet is about; this module turns it into the three
// things the fetch and the gate need, and nothing else:
//
//   opponentId    — a club id when the facet can narrow the game log itself
//   gameTypes     — which game types may produce a row at all
//   keep(row)     — a predicate over FINISHED rows, applied by boxLineRows
//                   AFTER its cutoff and Final checks
//
// WHY A PREDICATE OVER ROWS, NOT A SECOND FILTER OVER SPLITS. The gate in
// rows.js is the whole spoiler defense, and a facet must not be able to reach
// around it. Handing the facet a `keep` that runs last makes that structural:
// a facet can only ever narrow a row set the gate already approved. It has no
// way to widen one, because the rows it never sees do not exist (ADR-0069).
//
// WHY MOST FACETS DO NOT NARROW THE GAME LOG. `club` is decidable from the
// split alone (`split.opponent.id`), so it filters before the schedule join and
// the sheet pulls the schedule for a handful of games — that is the lineup
// page's one door, and it stays cheap. Every other facet either reads a
// SCHEDULE field the split does not carry (`venue`, and `dayNight`, which the
// game log reports wrongly — verified 2026-09-02) or is one of nine doors on
// the player page's card, where nine narrow fetches would repeat the same join
// nine times. Those share ONE career join instead (fetch.js memoizes it), and
// pay for themselves from the second door on.
//
// Class: spoiler-free (spoiler-manifest.json). Nothing here reads a score, a
// date cutoff or a reveal mark: it is a description of a question, handed to
// the module that already owns the answer's gate.

// "2024-09-29" -> 0 (Sunday) .. 6. Manual y/m/d at midday UTC, the same
// timezone-proof construction dayBefore uses in rows.js: a local-midnight Date
// would land a west-coast night game on the previous weekday.
export function weekdayOf(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}

// "2024-09-29" -> 9. Read off the string rather than a Date for the same reason.
export function monthOf(iso) {
  return Number(String(iso).slice(5, 7))
}

// The plan for one facet, or the everything-plan when `facet` is null.
// `narrowsSplits` tells fetch.js which of its two paths this facet earns: the
// club path filters the game log first, everything else joins the career once.
export function facetPlan(facet) {
  const plan = { opponentId: null, gameTypes: null, keep: null, narrowsSplits: false }
  if (!facet) return plan
  switch (facet.kind) {
    case 'club':
      // The only facet that narrows the fetch: one club, a handful of games.
      return { ...plan, opponentId: facet.opponentId ?? null, narrowsSplits: true }
    case 'venue':
      return { ...plan, keep: (r) => r.venueId === facet.venueId }
    case 'month':
      return { ...plan, keep: (r) => monthOf(r.date) === Number(facet.month) }
    case 'dayNight':
      return { ...plan, keep: (r) => r.dayNight === facet.value }
    case 'weekday':
      return { ...plan, keep: (r) => weekdayOf(r.date) === Number(facet.day) }
    case 'side':
      // `isHome` is on the split too, but the row's `home` is derived from the
      // SCHEDULE's away/home clubs, which is the same fact checked against the
      // record that also supplied the score. One source, no way to disagree.
      return { ...plan, keep: (r) => r.home === Boolean(facet.home) }
    case 'started':
      // Pitchers only: the hitting game log carries no gamesStarted, so a
      // hitter's `started` is null and this facet keeps nothing. That is the
      // right answer rather than a crash — the substitute facet (#1003) reads
      // the box score, not this flag.
      return { ...plan, keep: (r) => r.started === Boolean(facet.value) }
    case 'gameTypes':
      // No `keep`: the game types are applied where they belong, in
      // matchingSplits, so a non-regular row is never built in the first place.
      return { ...plan, gameTypes: facet.types?.length ? facet.types : null }
    default:
      // An unknown facet keeps nothing rather than everything. A typo in a
      // future facet issue shows as an empty sheet, never as a full one.
      return { ...plan, keep: () => false }
  }
}
