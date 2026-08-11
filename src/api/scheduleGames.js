// Pure post-fetch filters over fetchTeamSchedule's (schedule.js) already
// cutoff-respecting rows — split out into their own file once schedule.js
// hit the 600-line size cap (ADR-0038). Every row here already carries
// `won`/`runs`/`innings` gated by fetchTeamSchedule's own `resultsCutoff`
// (or left null past it), and `started` ungated (see schedule.js's own
// header on that field) — nothing in this file reaches the network or
// re-derives either.

// The Last 10 Games card's window (TeamPage.jsx's LastTenGamesStrip) — the
// most recently DECIDED games from a team's fetchTeamSchedule() list, oldest
// -> newest (the list is already sorted ascending). Filters on `won != null`,
// which fetchTeamSchedule already cutoff-gates, NEVER on Final status
// directly — that would bypass the cutoff and could surface the very game a
// mid-scoring visitor opened this page from. Pulled out as its own pure
// function (rather than left inline in the component) specifically so this
// invariant is pinned by a test, not just a comment.
export function recentDecidedGames(schedule, limit = 10) {
  return schedule.filter((g) => g.won != null).slice(-limit)
}

// The same window's full backing list, oldest -> newest — the Last 10 Games
// strip opens scrolled to recentDecidedGames' last-10 view, then grows its
// rendered window toward the front of THIS list as the user scrolls left,
// all the way back to Opening Day. Same `won != null` filter/invariant as
// recentDecidedGames (no separate cutoff to drift out of sync with it).
export function allDecidedGames(schedule) {
  return schedule.filter((g) => g.won != null)
}

// Every game the club has already taken the field for, live or Final —
// TeamPhotosPage's own walk list, and its one deliberate departure from the
// `won != null` invariant every other consumer above holds to. That page is
// already unsealed by design (root CLAUDE.md's scored-game flow explicitly
// excludes it, same footing as GamePhotosPage), and its owner's call is that
// a photo from tonight's game carries no different an expectation there than
// one from last week's — so unlike `allDecidedGames`, this doesn't wait for
// `won` to land. A not-yet-started game still has `started: false` and stays
// out, since it can carry no photo yet regardless.
export function allStartedGames(schedule) {
  return schedule.filter((g) => g.started)
}
