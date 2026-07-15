// The All-Star Rosters page's data — every MLB All-Star Game roster, year
// over year back to the game's 1933 debut, read from a static same-origin
// file (public/data/all-star-rosters.json) rather than computed live.
//
// scripts/gen-all-star-rosters.mjs builds it — a hand-run regenerate, not a
// cron, since a season's roster is decided once and never changes. Same
// build-time-fetch pattern as awardsHistory.js/milbHistory.js (see
// docs/data-enrichment.md §5). `rosters[season]` is `{ AL, NL }`, each a
// precomputed `{ starters, bullpen, substitutes }` — the generator itself
// resolves who started (from that game's boxscore) so the page does no
// grouping/sorting client-side; every named selectee still shows somewhere,
// including one who withdrew and never played (an injury, or a starter who
// pitched the Sunday before) — the source endpoint is the official
// selections, not a boxscore scan, so he still shows (in bullpen/substitutes
// when he never played). `games` is season -> gamePk only; the screen
// resolves each game's live team/date info via fetchGameCardsByPk
// (schedule.js), same as TopGamesPage, so a franchise rename never goes
// stale in this file.
//
// Roster membership carries no individual game's score — same footing as
// Awards History/League Leaders/WAR — so this file needs no spoiler cutoff.
// `scores[season]` is `{ al, nl }`, the game's final score straight off the
// schedule row the generator already fetches for `games` — see ADR-0019 for
// why this page (uniquely) shows a final score plainly. Degrades to an empty
// list before the file exists or on any failure. Cached in-memory for the
// session since the file only changes on a hand-run regenerate.
let cached = null

export async function loadAllStarRosters() {
  if (cached) return cached
  try {
    const res = await fetch('/data/all-star-rosters.json')
    if (!res.ok) throw new Error(`all-star-rosters.json ${res.status}`)
    const data = await res.json()
    cached = {
      seasons: data.seasons ?? [],
      rosters: data.rosters ?? {},
      games: data.games ?? {},
      scores: data.scores ?? {},
      generatedAt: data.generatedAt ?? null,
    }
  } catch {
    cached = { seasons: [], rosters: {}, games: {}, scores: {}, generatedAt: null }
  }
  return cached
}
