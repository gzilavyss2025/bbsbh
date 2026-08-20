// The Tally wordmark (SiteHeader on every in-game page, and the slate's
// own title) sends you home — but as a full-page reload rather than a client-side
// route change, so it doubles as a "refresh" from wherever you are. On the slate
// itself this simply reloads the day's games.
//
// `path` exists for the slate's own wordmark, which has to land on today's
// games in the league you are already reading rather than dropping you back to
// MLB: the league is part of the address now (ADR-0056), so "home" has to be
// built rather than assumed. Everywhere else calls it bare and gets '/'.
export function goHome(path = '/') {
  window.location.assign(path)
}
