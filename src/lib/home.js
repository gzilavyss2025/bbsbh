// The Tally wordmark (SiteHeader on every in-game page, and the slate's
// own title) sends you home — but as a full-page reload rather than a client-side
// route change, so it doubles as a "refresh" from wherever you are. On the slate
// itself this simply reloads the day's games.
export function goHome() {
  window.location.assign('/')
}
