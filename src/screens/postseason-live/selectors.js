// Pure selectors for the live series page (#1224/#1230, slice 6). Each reads
// one Series (src/api/postseason/bracket.js) and sorts or formats what it
// already carries — nothing here fetches, and nothing reads a game's result.
//
// A Series' games sort into three buckets, disjoint by construction:
//   - `games`      counted results, already Final before the cutoff (safe to
//                  show in full — same footing as the finished series page).
//   - `cutoffGame` the one game ON the cutoff date, if the series plays one.
//                  Never a score — the caller must not fetch this game's box
//                  score or feed.
//   - `upcoming`   the games still ahead of the cutoff game (or every
//                  remaining game, when nothing plays today).
// bracket.js's `upcomingGames()` never repeats the cutoff game inside
// `upcoming` (see that module's header), so the three never overlap.
export function seriesGameBuckets(series) {
  return {
    results: series?.games ?? [],
    today: series?.cutoffGame ?? null,
    upcoming: series?.upcoming ?? [],
  }
}

// An upcoming game's date line. `date` is null for the one game the cutoff
// game's own result could remove from the schedule (bracket.js's
// upcomingGames) — showing a date there would say the series went on past
// today, which is the result this page must not leak. "If necessary" reads
// the same whether or not the game turns out to be needed.
export function upcomingGameLabel(game) {
  return game?.date ?? 'If necessary'
}
