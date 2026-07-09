// The Rehab Assignments page's data — the players currently on a major-league
// rehab assignment, league-wide — read from a static same-origin file
// (public/data/rehab.json) rather than computed live.
//
// Building the list is expensive and can't be done spoiler-cheaply on a page
// load: the transaction feed says who STARTS a rehab but not reliably when one
// ENDS, so each candidate has to be verified against his game log and his club's
// schedule (a few statsapi calls apiece) to drop stints that have really
// finished — the player activated back to the majors, sent down, or shut down
// for the season. That's dozens of requests, so scripts/gen-rehab.mjs does it on
// a cron and commits the shaped result (see .github/workflows/update-rehab.yml);
// this module just reads it. Same build-time-fetch pattern as war.js (see
// docs/data-enrichment.md §5). Roster moves + game *dates* carry no score, so
// the file is spoiler-free like the rest of the roster surfaces.
//
// Degrades to an empty list before the file exists or on any failure — a
// friendly empty state, not a broken page. Cached in-memory for the session
// since the file only changes once a day.
let cached = null

export async function loadRehabAssignments() {
  if (cached) return cached
  try {
    const res = await fetch('/data/rehab.json')
    if (!res.ok) throw new Error(`rehab.json ${res.status}`)
    const data = await res.json()
    cached = { players: data.players ?? [], generatedAt: data.generatedAt ?? null }
  } catch {
    cached = { players: [], generatedAt: null }
  }
  return cached
}
