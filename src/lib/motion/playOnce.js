// An entrance animation plays once per key (a game) for one card, not on every mount. The running
// line remounts as the reader pages between halves and when a page-turn preview
// mounts a second copy, and the design system says a stamp-in is not replayed on
// a return visit. Pure: the caller passes the set, so a test owns its own.
//
// `shouldPlay` is a read, safe in render. `markPlayed` is the write, run in an
// effect, so a StrictMode double render cannot spend the animation before it plays.
export function shouldPlay(key, seen) {
  return key == null || !seen.has(key)
}

export function markPlayed(key, seen) {
  if (key != null) seen.add(key)
}
