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
