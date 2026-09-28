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
// bracket.js's `upcomingGames()` starts at the first unplayed game, which is
// the cutoff game itself when the series plays today. It shows once, under
// Today, so `upcoming` drops it here and the three never overlap.
export function seriesGameBuckets(series) {
  const today = series?.cutoffGame ?? null
  return {
    results: series?.games ?? [],
    today,
    upcoming: (series?.upcoming ?? []).filter((g) => !today || g.gameNumber !== today.gameNumber),
  }
}

// An upcoming game's date line. `date` is null for the one game the cutoff
// game's own result could remove from the schedule (bracket.js's
// upcomingGames) — showing a date there would say the series went on past
// today, which is the result this page must not leak. "If necessary" reads
// the same whether or not the game turns out to be needed.
// A dated game that the series may not need says "If necessary" beside its
// date. `formatDate` turns the ISO date into the page's own form.
export function upcomingGameLabel(game, formatDate = (d) => d) {
  if (!game?.date) return 'If necessary'
  const date = formatDate(game.date)
  return game.ifNecessary ? `${date} · If necessary` : date
}
