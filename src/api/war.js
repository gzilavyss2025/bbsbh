// Season WAR, read from a static same-origin file (public/data/war.json)
// rather than fetched live from FanGraphs. That file is regenerated nightly
// by scripts/gen-war.mjs (see .github/workflows/update-war.yml) — this module
// just reads it. Keyed by MLB Stats API personId (FanGraphs' xMLBAMID is the
// same id), so callers can index straight off a roster entry's person.id.
// Degrades to empty maps before the file exists or on any fetch failure — a
// missing WAR badge, not a broken page. Cached in-memory for the session
// since the file only changes once a day.
let cached = null

export async function fetchWarData() {
  if (cached) return cached
  try {
    const res = await fetch('/data/war.json')
    if (!res.ok) throw new Error(`war.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = { season: null, bat: {}, pit: {} }
  }
  return cached
}

// Season WAR for COMPLETED seasons — the multi-year companion to war.json above.
// Same shape but keyed by season: { seasons, bat: { [season]: {id: war} }, pit }.
// Hand-generated (scripts/gen-war-history.mjs), not on the nightly cron, since a
// finished season's WAR never changes. Degrades to empty like the current-season
// file. Separately cached (a page may want one, both, or neither).
let cachedHistory = null

export async function fetchWarHistory() {
  if (cachedHistory) return cachedHistory
  try {
    const res = await fetch('/data/war-history.json')
    if (!res.ok) throw new Error(`war-history.json ${res.status}`)
    cachedHistory = await res.json()
  } catch {
    cachedHistory = { seasons: [], bat: {}, pit: {} }
  }
  return cachedHistory
}

// A single player's WAR by season for one group — a { [season]: number } map
// unioning the live-season file (current, still-moving season) with the history
// file (every completed season). The live file wins for its own season. Group
// picks bat vs pit WAR (a two-way player has both). MLB-only at the source, so a
// season the player spent entirely in the minors simply won't have a key.
export function warByYearFor(personId, group, current, history) {
  const key = group === 'pitching' ? 'pit' : 'bat'
  const out = {}
  for (const season of history?.seasons ?? []) {
    const w = history[key]?.[season]?.[personId]
    if (w != null) out[season] = w
  }
  if (current?.season != null) {
    const w = current[key]?.[personId]
    if (w != null) out[current.season] = w
  }
  return out
}
