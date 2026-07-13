// The Awards History page's data — who won each major MLB award (MVP, Cy
// Young, Rookie of the Year, Silver Slugger, Gold Glove, Platinum Glove,
// Reliever of the Year, Comeback Player, Hank Aaron, Roberto Clemente,
// All-MLB First/Second Team) over the last several seasons, read from a
// static same-origin file (public/data/awards-history.json) rather than
// computed live.
//
// scripts/gen-awards-history.mjs builds it — a hand-run regenerate, not a
// cron, since a completed season's award winners are immutable. This module
// just reads it. Same build-time-fetch pattern as milestones.js/rehab.js (see
// docs/data-enrichment.md §5). Historical award winners carry no individual
// game's score — same footing as the (ungated) League Leaders/WAR/Milestone
// Watch pages — so this file needs no spoiler cutoff.
//
// Degrades to an empty list before the file exists or on any failure — a
// friendly empty state, not a broken page. Cached in-memory for the session
// since the file only changes on a hand-run regenerate.
let cached = null

export async function loadAwardsHistory() {
  if (cached) return cached
  try {
    const res = await fetch('/data/awards-history.json')
    if (!res.ok) throw new Error(`awards-history.json ${res.status}`)
    const data = await res.json()
    cached = {
      seasons: data.seasons ?? [],
      families: data.families ?? [],
      generatedAt: data.generatedAt ?? null,
    }
  } catch {
    cached = { seasons: [], families: [], generatedAt: null }
  }
  return cached
}
