// Postseason History page's data — the completed bracket (who played, who
// won, how many games, and the round MVP where one exists) for the last
// several MLB postseasons, read from a static same-origin file
// (public/data/postseason-history.json) rather than computed live.
//
// scripts/gen-postseason-history.mjs builds it — a hand-run regenerate, not
// a cron, since a finished postseason's results are immutable. Same
// build-time-fetch pattern as awardsHistory.js/milbHistory.js. A past
// series' final score carries no LIVE game's spoiler risk — same footing as
// the (ungated) Awards History/WAR/Milestone Watch pages — so this file
// needs no spoiler cutoff or SealBox.
//
// Degrades to an empty list before the file exists or on any failure — a
// friendly empty state, not a broken page. Cached in-memory for the session
// since the file only changes on a hand-run regenerate.
let cached = null

export async function loadPostseasonHistory() {
  if (cached) return cached
  try {
    const res = await fetch('/data/postseason-history.json')
    if (!res.ok) throw new Error(`postseason-history.json ${res.status}`)
    const data = await res.json()
    cached = {
      seasons: data.seasons ?? [],
      generatedAt: data.generatedAt ?? null,
    }
  } catch {
    cached = { seasons: [], generatedAt: null }
  }
  return cached
}
