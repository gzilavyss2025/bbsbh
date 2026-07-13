// The Milestone Watch data — every MLB active-roster player within reach of a
// round career-total milestone, league-wide — read from a static same-origin
// file (public/data/milestones.json) rather than computed live.
//
// Building the list needs a full MLB year-by-year stat line per active-roster
// player (~800 players) plus each team's season schedule, to scale a
// projection by how often the player actually plays — dozens of statsapi
// calls per team, hundreds league-wide. scripts/gen-milestones.mjs does it on
// a cron and commits the shaped result (see .github/workflows/update-nightly-data.yml);
// this module just reads it. Same build-time-fetch pattern as rehab.js/war.js
// (see docs/data-enrichment.md §5). Counting-stat totals and projections carry
// no individual game's score — same footing as the (ungated) League Leaders
// and WAR pages — so this file needs no spoiler cutoff.
//
// Degrades to an empty list before the file exists or on any failure — a
// friendly empty state, not a broken page. Cached in-memory for the session
// since the file only changes once a day.
let cached = null

export async function loadMilestoneWatch() {
  if (cached) return cached
  try {
    const res = await fetch('/data/milestones.json')
    if (!res.ok) throw new Error(`milestones.json ${res.status}`)
    const data = await res.json()
    cached = { players: data.players ?? [], season: data.season ?? null, generatedAt: data.generatedAt ?? null }
  } catch {
    cached = { players: [], season: null, generatedAt: null }
  }
  return cached
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A future-season projection is just the year (per the product ask — a
// specific date two years out would be false precision); an in-season one
// gets the projected month, read off the team's actual remaining schedule.
// Shared by the player page's Milestone Watch card and the league-wide page.
export function formatMilestoneProjection(p) {
  if (!p) return null
  if (p.kind === 'year') return String(p.year)
  if (p.kind === 'date' && p.date) {
    const [y, m] = p.date.split('-')
    return m ? `${MONTHS[Number(m) - 1]} ${y}` : y
  }
  return null
}

// This one player's rows (he can be chasing more than one milestone at
// once — e.g. both 3,000 hits and 500 doubles), nearest-first. Used by the
// player page's Milestone Watch card.
export function milestonesForPlayer(watch, playerId) {
  const id = Number(playerId)
  return (watch?.players ?? [])
    .filter((p) => p.playerId === id)
    .sort((a, b) => a.remaining - b.remaining)
}
